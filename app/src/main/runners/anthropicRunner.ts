import type { HostToRunnerMessage } from '../../shared/runnerProtocol.js';
import type { Runner, RunnerHandle, RunnerResult, RunnerStartRequest } from './types.js';

/**
 * Runner that calls the Anthropic Messages API.
 *
 * Expects the runner profile to have type 'anthropic' and the environment
 * variable ANTHROPIC_API_KEY to be set (either in the profile env or process env).
 */
export class AnthropicRunner implements Runner {
  async start(request: RunnerStartRequest): Promise<RunnerHandle> {
    const profile = request.profile;
    if (profile.type !== 'anthropic') {
      throw new Error(`AnthropicRunner requires an 'anthropic' profile, got '${profile.type}'`);
    }

    const apiKey = profile.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      request.onMessage({
        type: 'failed',
        message: 'ANTHROPIC_API_KEY is not set. Configure it in the runner profile environment or system environment.'
      });
      return createNoopHandle();
    }

    let aborted = false;
    const abortController = new AbortController();

    const done = (async (): Promise<RunnerResult> => {
      try {
        request.onMessage({ type: 'log', level: 'info', message: `Starting Anthropic run with model ${profile.model}` });

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: profile.model,
            max_tokens: profile.maxTokens,
            system: profile.systemPrompt || undefined,
            messages: [
              { role: 'user', content: request.prompt }
            ]
          }),
          signal: abortController.signal
        });

        if (!response.ok) {
          const errorBody = await response.text();
          request.onMessage({ type: 'failed', message: `Anthropic API error ${response.status}: ${errorBody}` });
          return { exitCode: 1, signal: null };
        }

        const data = (await response.json()) as AnthropicResponse;
        const content = data.content?.[0]?.type === 'text' ? data.content[0].text : '';
        const usage = data.usage;

        if (usage) {
          request.onMessage({
            type: 'usage',
            estimatedTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
            commandCount: 0,
            outputBytes: content.length
          });
        }

        request.onMessage({
          type: 'artifact',
          title: 'Anthropic Response',
          path: `artifacts/${request.runId}-response.md`,
          kind: 'summary'
        });

        request.onMessage({ type: 'complete', summary: content.slice(0, 500) || 'Completed with empty response.' });
        return { exitCode: 0, signal: null };
      } catch (error) {
        if (aborted) {
          return { exitCode: 1, signal: 'SIGTERM' as NodeJS.Signals };
        }
        const message = error instanceof Error ? error.message : 'Unknown error';
        request.onMessage({ type: 'failed', message: `Anthropic runner error: ${message}` });
        return { exitCode: 1, signal: null };
      }
    })();

    return {
      done,
      send(_msg: HostToRunnerMessage): void {
        void _msg;
      },
      stop(reason: string): void {
        aborted = true;
        abortController.abort(reason);
      }
    };
  }
}

function createNoopHandle(): RunnerHandle {
  return {
    done: Promise.resolve({ exitCode: 1, signal: null }),
    send(): void {},
    stop(): void {}
  };
}

interface AnthropicResponse {
  content?: Array<{ type: string; text: string }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}
