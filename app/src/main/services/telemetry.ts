import type { AppStore } from '../db/appStore.js';
import { logger } from '../logger.js';
import { createId } from '../../shared/domain.js';

const log = logger.child('telemetry');

export interface TelemetryEvent {
  id: string;
  event: string;
  properties: Record<string, string | number | boolean>;
  timestamp: string;
}

export interface TelemetryPreferences {
  enabled: boolean;
  webhookUrl: string;
}

const defaultPrefs: TelemetryPreferences = {
  enabled: false,
  webhookUrl: ''
};

export interface TelemetryService {
  track(event: string, properties?: Record<string, string | number | boolean>): void;
  getPreferences(): TelemetryPreferences;
  setPreferences(update: Partial<TelemetryPreferences>): TelemetryPreferences;
  getEvents(limit?: number): TelemetryEvent[];
  getSummary(): { totalEvents: number; eventCounts: Record<string, number>; lastEvent: string | null };
}

export function createTelemetryService(store: AppStore): TelemetryService {
  let prefs: TelemetryPreferences = { ...defaultPrefs };

  const savedPrefs = store.getById<TelemetryPreferences & { id: string }>('settings', 'telemetry_prefs');
  if (savedPrefs) {
    prefs = { enabled: savedPrefs.enabled, webhookUrl: savedPrefs.webhookUrl };
  }

  function track(event: string, properties: Record<string, string | number | boolean> = {}): void {
    if (!prefs.enabled) return;

    const entry: TelemetryEvent = {
      id: createId('telemetry'),
      event,
      properties,
      timestamp: new Date().toISOString()
    };

    store.put('telemetry', entry.id, entry);

    if (prefs.webhookUrl) {
      void sendToWebhook(entry).catch((err) => {
        log.error('Webhook delivery failed', { error: String(err) });
      });
    }
  }

  async function sendToWebhook(entry: TelemetryEvent): Promise<void> {
    const response = await fetch(prefs.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    if (!response.ok) {
      log.error('Webhook returned non-OK status', { status: response.status });
    }
  }

  function getPreferences(): TelemetryPreferences {
    return { ...prefs };
  }

  function setPreferences(update: Partial<TelemetryPreferences>): TelemetryPreferences {
    prefs = { ...prefs, ...update };
    store.put('settings', 'telemetry_prefs', { id: 'telemetry_prefs', ...prefs });
    return { ...prefs };
  }

  function getEvents(limit = 100): TelemetryEvent[] {
    const all = store.getAll<TelemetryEvent>('telemetry');
    const sorted = all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return sorted.slice(0, limit);
  }

  function getSummary(): { totalEvents: number; eventCounts: Record<string, number>; lastEvent: string | null } {
    const all = store.getAll<TelemetryEvent>('telemetry');
    const eventCounts: Record<string, number> = {};
    let lastEvent: string | null = null;

    for (const entry of all) {
      eventCounts[entry.event] = (eventCounts[entry.event] ?? 0) + 1;
      if (!lastEvent || entry.timestamp > lastEvent) {
        lastEvent = entry.timestamp;
      }
    }

    return { totalEvents: all.length, eventCounts, lastEvent };
  }

  return { track, getPreferences, setPreferences, getEvents, getSummary };
}
