/**
 * Event Bus Service re-export
 * Corrects import path for services that import '../event-bus-service'
 */

export { EventBusService, EventBusError, ConnectionState } from './services/event-bus-service';
export type { TypedEnvelope } from './services/types/event-types';
