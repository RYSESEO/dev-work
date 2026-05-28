import type { ClientConfig } from '../http.js';
import { sendEvent } from '../http.js';

export async function reportCommand(
  config: ClientConfig,
  args: string[],
  model: string | undefined,
  provider: string | undefined
): Promise<void> {
  if (args.length < 2) {
    console.error('Usage: dw-agent report <tokens> <costUsd> [--model <model>] [--provider <provider>]');
    console.error('Example: dw-agent report 1500 0.045 --model gpt-4o --provider openai');
    process.exit(1);
  }

  const tokens = parseInt(args[0]!, 10);
  const costUsd = parseFloat(args[1]!);

  if (isNaN(tokens) || isNaN(costUsd)) {
    console.error('Error: tokens and costUsd must be numbers');
    process.exit(1);
  }

  const payload: Record<string, unknown> = { tokens, costUsd };
  if (model) payload['model'] = model;
  if (provider) payload['provider'] = provider;

  const result = await sendEvent(config, 'usage.report', payload);
  console.log(`Usage reported: ${tokens} tokens, $${costUsd.toFixed(4)} (id: ${result.id})`);
}
