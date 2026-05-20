import type { HostToRunnerMessage } from '../../shared/runnerProtocol.js';
import type { Runner, RunnerHandle, RunnerResult, RunnerStartRequest } from './types.js';

/**
 * Runner that calls the OpenAI Chat Completions API.
 *
 * Expects the runner profile to have type 'openai' and the environment
 * variable OPENAI_API_KEY to be set (either in the profile env or process env).
 *
 * This is a scaffold — the actual API integration should be completed once
 * an API key and billing setup are in place.
 */
export class OpenAIRunner implements Runner {
  async start(request: RunnerStartRequest): Promise<RunnerHandle> {
    const profile = request.profile;
    if (profile.type !== 'openai') {
      throw new Error(`OpenAIRunner requires an 'openai' profile, got '${profile.type}'`);
    }

    const apiKey = profile.env.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      request.onMessage({
        type: 'failed',
        message: 'OPENAI_API_KEY is not set. Configure it in the runner profile environment or system environment.'
      });
      return createNoopHandle();
    }

    let aborted = false;
    const abortController = new AbortController();

    const done = (async (): Promise<RunnerResult> => {
      try {
        request.onMessage({ type: 'log', level: 'info', message: `Starting OpenAI run with model ${profile.model}` });

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: profile.model,
            max_tokens: profile.maxTokens,
            messages: [
              { role: 'system', content: profile.systemPrompt },
              { role: 'user', content: request.prompt }
            ]
          }),
          signal: abortController.signal
        });

        if (!response.ok) {
          const errorBody = await response.text();
          request.onMessage({ type: 'failed', message: `OpenAI API error ${response.status}: ${errorBody}` });
          return { exitCode: 1, signal: null };
        }

        const data = (await response.json()) as OpenAIChatResponse;
        const content = data.choices?.[0]?.message?.content ?? '';
        const usage = data.usage;

        if (usage) {
          request.onMessage({
            type: 'usage',
            estimatedTokens: usage.total_tokens,
            commandCount: 0,
            outputBytes: content.length
          });
        }

        request.onMessage({
          type: 'artifact',
          title: 'OpenAI Response',
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
        request.onMessage({ type: 'failed', message: `OpenAI runner error: ${message}` });
        return { exitCode: 1, signal: null };
      }
    })();

    return {
      done,
      send(_msg: HostToRunnerMessage): void {
        void _msg;
        // OpenAI completions are stateless — approval results are acknowledged but
        // there is no running process to forward them to.
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

interface OpenAIChatResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
