import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/main/db/appStore.js';
import { createTelemetryService } from '../../src/main/services/telemetry.js';

describe('telemetry', () => {
  it('does not record events when disabled', async () => {
    const store = await createAppStore(':memory:');
    const telemetry = createTelemetryService(store);

    telemetry.track('test_event', { key: 'value' });

    const events = telemetry.getEvents();
    expect(events).toHaveLength(0);
  });

  it('records events when enabled', async () => {
    const store = await createAppStore(':memory:');
    const telemetry = createTelemetryService(store);

    telemetry.setPreferences({ enabled: true });
    telemetry.track('mission_created', { missionId: 'mission_123' });
    telemetry.track('run_started', { runId: 'run_456' });

    const events = telemetry.getEvents();
    expect(events).toHaveLength(2);
    const eventNames = events.map((e) => e.event).sort();
    expect(eventNames).toEqual(['mission_created', 'run_started']);
  });

  it('persists preferences across instances', async () => {
    const store = await createAppStore(':memory:');
    const telemetry1 = createTelemetryService(store);

    telemetry1.setPreferences({ enabled: true, webhookUrl: 'https://example.com/hook' });

    const telemetry2 = createTelemetryService(store);
    const prefs = telemetry2.getPreferences();
    expect(prefs.enabled).toBe(true);
    expect(prefs.webhookUrl).toBe('https://example.com/hook');
  });

  it('provides a summary of events', async () => {
    const store = await createAppStore(':memory:');
    const telemetry = createTelemetryService(store);

    telemetry.setPreferences({ enabled: true });
    telemetry.track('mission_created');
    telemetry.track('run_started');
    telemetry.track('run_finished', { status: 'completed' });
    telemetry.track('run_started');

    const summary = telemetry.getSummary();
    expect(summary.totalEvents).toBe(4);
    expect(summary.eventCounts['mission_created']).toBe(1);
    expect(summary.eventCounts['run_started']).toBe(2);
    expect(summary.eventCounts['run_finished']).toBe(1);
    expect(summary.lastEvent).toBeTruthy();
  });

  it('limits returned events', async () => {
    const store = await createAppStore(':memory:');
    const telemetry = createTelemetryService(store);

    telemetry.setPreferences({ enabled: true });
    for (let i = 0; i < 10; i++) {
      telemetry.track(`event_${i}`);
    }

    const limited = telemetry.getEvents(3);
    expect(limited).toHaveLength(3);
  });
});
