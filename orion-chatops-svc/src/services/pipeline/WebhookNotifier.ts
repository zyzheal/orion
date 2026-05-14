/**
 * Webhook Notifier - Stub
 */

export type WebhookEventType = 'pipeline' | 'deployment' | 'alert' | 'code' | 'config';

export class WebhookNotifier {
  async notify(url: string, payload: any): Promise<void> {}
}
