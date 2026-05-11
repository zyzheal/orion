import { connect, NatsConnection, JSONCodec } from 'nats';

let natsConn: NatsConnection | null = null;
const jc = JSONCodec();

export async function getEventBus(): Promise<NatsConnection> {
  if (!natsConn) {
    natsConn = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222',
      reconnect: true,
      maxReconnectAttempts: 10,
    });
  }
  return natsConn;
}

export async function publishEvent(subject: string, data: unknown): Promise<void> {
  const conn = await getEventBus();
  conn.publish(subject, jc.encode(data));
}

export async function closeEventBus(): Promise<void> {
  if (natsConn) {
    await natsConn.close();
    natsConn = null;
  }
}
