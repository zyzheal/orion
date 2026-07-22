import { PlatformEvents } from '../types/core.js';

export interface EventPublisher {
  publish: (subject: string, payload: string) => Promise<void>;
}

let _publisher: EventPublisher | null = null;
let _connecting = false;

/**
 * 获取 NATS 事件发布者 (单例)
 */
export async function getEventPublisher(): Promise<EventPublisher> {
  if (_publisher) {
    return _publisher;
  }

  if (_connecting) {
    // Wait for existing connection attempt to finish
    await new Promise((resolve) => setTimeout(resolve, 100));
    return _publisher || { publish: noopPublish };
  }

  _connecting = true;

  try {
    const natsUrl = process.env.NATS_URL;
    if (!natsUrl) {
      console.warn('NATS_URL not set, using no-op publisher');
      _publisher = { publish: noopPublish };
      return _publisher;
    }

    const { connect } = await import('nats');
    const nc = await connect({
      servers: natsUrl,
      token: extractNatsToken(natsUrl),
    });

    _publisher = {
      publish: async (subject: string, payload: string) => {
        nc.publish(subject, new TextEncoder().encode(payload));
      },
    };

    // Handle connection close
    nc.closed().then((err) => {
      if (err) {
        console.error('NATS connection closed with error', err);
      }
      _publisher = null;
    });

    console.log('NATS connection established');
  } catch (err) {
    console.error('Failed to connect to NATS, using no-op publisher', err);
    _publisher = { publish: noopPublish };
  } finally {
    _connecting = false;
  }

  return _publisher;
}

/**
 * 关闭 NATS 连接
 */
export async function closeEventBus(): Promise<void> {
  // No explicit close needed; NATS client handles it via closed() promise
  _publisher = null;
}

/**
 * 发布平台事件 (便捷方法)
 */
export async function publishPlatformEvent(
  event: keyof typeof PlatformEvents,
  payload: Record<string, unknown>,
): Promise<void> {
  const publisher = await getEventPublisher();
  await publisher.publish(PlatformEvents[event], JSON.stringify(payload));
}

function noopPublish(_subject: string, _payload: string): Promise<void> {
  return Promise.resolve();
}

function extractNatsToken(url: string): string | undefined {
  // nats://:token@host:port or nats://user:pass@host:port
  try {
    const u = new URL(url.replace('nats://', 'http://'));
    if (u.password) return u.password;
    if (u.username && u.username !== '') return u.username;
  } catch {
    // Not a valid URL, return undefined
  }
  return undefined;
}
