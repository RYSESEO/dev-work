import type { HostToRunnerMessage } from '../../shared/runnerProtocol.js';
import type { Runner, RunnerHandle, RunnerResult, RunnerStartRequest } from './types.js';

/**
 * Runner that sends tasks to a custom HTTP endpoint.
 *
 * Expects the runner profile to have type 'custom-http' with an endpointUrl.
 * The endpoint should accept POST requests with JSON body and return a response
 * following the standard format.
 */
export class CustomHttpRunner implements Runner {
  async start(request: RunnerStartRequest): Promise<RunnerHandle> {
    const profile = request.profile;
    if (profile.type !== 'custom-http') {
      throw new Error(`CustomHttpRunner requires a 'custom-http' profile, got '${profile.type}'`);
    }

    const endpointUrl = profile.endpointUrl || profile.env.ENDPOINT_URL;
    if (!endpointUrl) {
      request.onMessage({
        type: 'failed',
        message: 'ENDPOINT_URL is not configured. Set it in the runner profile.'
      });
      return createNoopHandle();
    }

    let aborted = false;
    const abortController = new AbortController();

    const done = (async (): Promise<RunnerResult> => {
      try {
        request.onMessage({ type: 'log', level: 'info', message: `Starting Custom HTTP run to ${endpointUrl}` });

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...profile.headers,
          ...Object.fromEntries(
            Object.entries(profile.env)
              .filter(([k]) => k.startsWith('HEADER_'))
              .map(([k, v]) => [k.replace('HEADER_', ''), v])
          )
        };

        if (profile.env.API_KEY) {
          headers['Authorization'] = `Bearer ${profile.env.API_KEY}`;
        }

        const response = await fetch(endpointUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            runId: request.runId,
            prompt: request.prompt,
            profile: {
              name: profile.name,
              env: profile.env
            }
          }),
          signal: abortController.signal
        });

        if (!response.ok) {
          const errorBody = await response.text();
          request.onMessage({ type: 'failed', message: `HTTP endpoint error ${response.status}: ${errorBody}` });
          return { exitCode: 1, signal: null };
        }

        const data = (await response.json()) as CustomHttpResponse;
        const content = data.content ?? data.response ?? data.text ?? '';

        if (data.usage) {
          request.onMessage({
            type: 'usage',
            estimatedTokens: data.usage.totalTokens ?? 0,
            commandCount: 0,
            outputBytes: content.length
          });
        }

        request.onMessage({
          type: 'artifact',
          title: 'HTTP Response',
          path: `artifacts/${request.runId}-response.md`,
          kind: 'summary'
        });

        request.onMessage({
          type: 'complete',
          summary: content.slice(0, 500) || 'Completed with response from endpoint.'
        });
        return { exitCode: 0, signal: null };
      } catch (error) {
        if (aborted) {
          return { exitCode: 1, signal: 'SIGTERM' as NodeJS.Signals };
        }
        const message = error instanceof Error ? error.message : 'Unknown error';
        request.onMessage({ type: 'failed', message: `Custom HTTP runner error: ${message}` });
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

interface CustomHttpResponse {
  content?: string;
  response?: string;
  text?: string;
  usage?: {
    totalTokens?: number;
  };
}
