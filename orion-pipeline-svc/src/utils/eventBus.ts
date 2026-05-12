import { connect, NatsConnection, JSONCodec } from 'nats';
import { EventEmitter } from 'events';

let natsConn: NatsConnection | null = null;
let fallbackBus: EventEmitter | null = null;
const jc = JSONCodec();

/**
 * Get event bus connection.
 * Falls back to in-memory EventEmitter if NATS is unavailable.
 */
export async function getEventBus(): Promise<NatsConnection | EventEmitter> {
  if (natsConn) return natsConn;
  if (fallbackBus) return fallbackBus;

  try {
    natsConn = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222',
      reconnect: true,
      maxReconnectAttempts: 3,
      reconnectTimeWait: 1000,
    });
    console.log('[eventBus] Connected to NATS');
    return natsConn;
  } catch (error) {
    console.warn('[eventBus] NATS unavailable, falling back to in-memory event bus');
    natsConn = null;
    fallbackBus = new EventEmitter();
    return fallbackBus;
  }
}

export async function publishEvent(subject: string, data: unknown): Promise<void> {
  const bus = await getEventBus();

  if (bus instanceof EventEmitter) {
    bus.emit(subject, data);
  } else {
    bus.publish(subject, jc.encode(data));
  }
}

export async function subscribe(subject: string, callback: (data: unknown) => void): Promise<void> {
  const bus = await getEventBus();

  if (bus instanceof EventEmitter) {
    bus.on(subject, callback);
  } else {
    const sub = bus.subscribe(subject);
    (async () => {
      for await (const msg of sub) {
        callback(jc.decode(msg.data));
      }
    })();
  }
}

export async function closeEventBus(): Promise<void> {
  if (natsConn) {
    await natsConn.close();
    natsConn = null;
  }
  if (fallbackBus) {
    fallbackBus.removeAllListeners();
    fallbackBus = null;
  }
}
