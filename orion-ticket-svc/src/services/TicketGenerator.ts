/**
 * TicketGenerator Stub - generates tickets from alerts/incidents.
 */
import { Ticket, AlertTicketSource, IncidentTicketSource } from '../types/ticketing';

export class TicketGenerator {
  generateFromAlert(source: AlertTicketSource): Ticket {
    throw new Error('NOT_IMPLEMENTED: TicketGenerator.generateFromAlert');
  }
  generateFromIncident(source: IncidentTicketSource): Ticket {
    throw new Error('NOT_IMPLEMENTED: TicketGenerator.generateFromIncident');
  }
}
