import { Notification } from 'electron';
import { logger } from './logger.js';

const log = logger.child('notifications');

export interface NotificationPreferences {
  enabled: boolean;
  onApprovalRequest: boolean;
  onRunComplete: boolean;
  onRunFailed: boolean;
}

const defaultPrefs: NotificationPreferences = {
  enabled: true,
  onApprovalRequest: true,
  onRunComplete: true,
  onRunFailed: true
};

let prefs: NotificationPreferences = { ...defaultPrefs };

export function getNotificationPrefs(): NotificationPreferences {
  return { ...prefs };
}

export function setNotificationPrefs(update: Partial<NotificationPreferences>): NotificationPreferences {
  prefs = { ...prefs, ...update };
  return { ...prefs };
}

function send(title: string, body: string): void {
  if (!prefs.enabled) return;
  try {
    if (!Notification.isSupported()) {
      log.info('Notifications not supported on this platform');
      return;
    }
    const notification = new Notification({ title, body });
    notification.show();
  } catch (err) {
    log.error('Failed to show notification', { error: String(err) });
  }
}

export function notifyApprovalRequest(requestTitle: string): void {
  if (!prefs.onApprovalRequest) return;
  send('Approval Required', requestTitle);
}

export function notifyRunComplete(runId: string): void {
  if (!prefs.onRunComplete) return;
  send('Run Completed', `Run ${runId} finished successfully.`);
}

export function notifyRunFailed(runId: string, reason: string): void {
  if (!prefs.onRunFailed) return;
  send('Run Failed', `Run ${runId}: ${reason}`);
}
