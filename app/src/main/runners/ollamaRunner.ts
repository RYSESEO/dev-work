import type { HostToRunnerMessage } from '../../shared/runnerProtocol.js';
import type { Runner, RunnerHandle, RunnerResult, RunnerStartRequest } from './types.js';

/**
 * Runner that connects to a local Ollama instance.
 *
 * Expects the runner profile to have type 'ollama'.
 * Uses the Ollama REST API (default: http://localhost:11434).
 */
export class OllamaRunner implements Runner {
  async start(request: RunnerStartRequest): Promise<RunnerHandle> {
    const profile = request.profile;
    if (profile.type !== 'ollama') {
      throw new Error(`OllamaRunner requires an 'ollama' profile, got '${profile.type}'`);
    }

    const host = profile.ollamaHost || profile.env.OLLAMA_HOST || 'http://localhost:11434';
    const model = profile.model || profile.env.MODEL || 'llama3';

    let aborted = false;
    const abortController = new AbortController();

    const done = (async (): Promise<RunnerResult> => {
      try {
        request.onMessage({ type: 'log', level: 'info', message: `Starting Ollama run with model ${model} at ${host}` });

        const response = await fetch(`${host}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt: request.prompt,
            stream: false
          }),
          signal: abortController.signal
        });

        if (!response.ok) {
          const errorBody = await response.text();
          request.onMessage({ type: 'failed', message: `Ollama API error ${response.status}: ${errorBody}` });
          return { exitCode: 1, signal: null };
        }

        const data = (await response.json()) as OllamaResponse;
        const content = data.response ?? '';

        if (data.eval_count || data.prompt_eval_count) {
          request.onMessage({
            type: 'usage',
            estimatedTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
            commandCount: 0,
            outputBytes: content.length
          });
        }

        request.onMessage({
          type: 'artifact',
          title: 'Ollama Response',
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
        request.onMessage({ type: 'failed', message: `Ollama runner error: ${message}` });
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

interface OllamaResponse {
  response?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}
