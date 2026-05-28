export interface ClientConfig {
  apiKey: string;
  host: string;
  port: number;
  agentName: string;
}

export interface EventResponse {
  id: string;
  status: string;
}

export interface StatusResponse {
  status: string;
  version: string;
  uptime: number;
}

function baseUrl(config: ClientConfig): string {
  return `http://${config.host}:${config.port}`;
}

export async function sendEvent(
  config: ClientConfig,
  type: string,
  payload: Record<string, unknown>
): Promise<EventResponse> {
  const url = `${baseUrl(config)}/api/v1/events`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({ type, payload })
  });

  const data = (await response.json()) as EventResponse & { error?: string };
  if (!response.ok) {
    throw new Error(`API error (${response.status}): ${data.error ?? 'Unknown error'}`);
  }
  return data;
}

export async function checkStatus(config: ClientConfig): Promise<StatusResponse> {
  const url = `${baseUrl(config)}/api/v1/status`;
  const response = await fetch(url);
  const data = (await response.json()) as StatusResponse;
  return data;
}
