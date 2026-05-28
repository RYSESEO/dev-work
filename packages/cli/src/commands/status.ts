import type { ClientConfig } from '../http.js';
import { checkStatus } from '../http.js';

export async function statusCommand(config: ClientConfig): Promise<void> {
  const status = await checkStatus(config);
  console.log(`Server: ${status.status}`);
  console.log(`Version: ${status.version}`);
  console.log(`Uptime: ${Math.round(status.uptime)}s`);
}
