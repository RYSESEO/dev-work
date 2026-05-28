import type { ClientConfig } from '../http.js';
import { sendEvent } from '../http.js';

export async function heartbeatCommand(config: ClientConfig): Promise<void> {
  const result = await sendEvent(config, 'heartbeat', {
    agentName: config.agentName,
    version: '0.1.0'
  });
  console.log(`Heartbeat sent (id: ${result.id})`);
}
