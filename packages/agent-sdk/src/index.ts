export { DevWorkClient, DevWorkApiError } from './client.js';
export type {
  ClientConfig,
  EventType,
  EventPayload,
  EventResponse,
  StatusResponse,
  ErrorResponse,
  RunPayload,
  UsagePayload,
  ArtifactPayload,
  HeartbeatPayload,
  RunTracker,
  WebhookEvent
} from './types.js';

import { DevWorkClient } from './client.js';

/**
 * Create a DevWorkClient from environment variables.
 *
 * Reads:
 * - DEVWORK_API_KEY (required)
 * - DEVWORK_HOST (default: 127.0.0.1)
 * - DEVWORK_PORT (default: 9400)
 * - DEVWORK_BASE_URL (overrides host/port)
 * - DEVWORK_AGENT_NAME (default: custom-agent)
 * - DEVWORK_AGENT_VERSION
 * - DEVWORK_HEARTBEAT_INTERVAL (ms, default: 0 = disabled)
 */
export function createClientFromEnv(): DevWorkClient {
  const apiKey = process.env['DEVWORK_API_KEY'];
  if (!apiKey) {
    throw new Error(
      'DEVWORK_API_KEY environment variable is required. ' +
        'Create an API key in the dev-work Integrations tab.'
    );
  }

  return new DevWorkClient({
    apiKey,
    host: process.env['DEVWORK_HOST'],
    port: process.env['DEVWORK_PORT'] ? parseInt(process.env['DEVWORK_PORT'], 10) : undefined,
    baseUrl: process.env['DEVWORK_BASE_URL'],
    agentName: process.env['DEVWORK_AGENT_NAME'],
    agentVersion: process.env['DEVWORK_AGENT_VERSION'],
    heartbeatInterval: process.env['DEVWORK_HEARTBEAT_INTERVAL']
      ? parseInt(process.env['DEVWORK_HEARTBEAT_INTERVAL'], 10)
      : undefined
  });
}
