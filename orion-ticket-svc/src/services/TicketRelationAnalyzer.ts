/**
 * TicketRelationAnalyzer - analyzes ticket relations and detects duplicates.
 */
import { Ticket, TicketRelation, TicketRelationType } from '../types/ticketing';

export interface TicketRelationAnalyzerOptions {
  ticketingRepository?: any;
}

export class TicketRelationAnalyzer {
  private tickets: Map<string, Ticket> = new Map();
  private relations: Map<string, TicketRelation> = new Map();

  constructor(private options?: TicketRelationAnalyzerOptions) {}

  registerTicket(ticket: Ticket): void {
    this.tickets.set(ticket.id, ticket);
  }

  unregisterTicket(ticketId: string): void {
    this.tickets.delete(ticketId);
    // Also remove relations involving this ticket
    for (const [key, rel] of this.relations.entries()) {
      if (rel.ticketId === ticketId || rel.relatedTicketId === ticketId) {
        this.relations.delete(key);
      }
    }
  }

  detectDuplicates(ticketId: string, threshold: number = 0.7): { ticket: Ticket; confidence: number }[] {
    const source = this.tickets.get(ticketId);
    if (!source) return [];

    const results: { ticket: Ticket; confidence: number }[] = [];
    for (const [id, ticket] of this.tickets.entries()) {
      if (id === ticketId || ticket.status === 'closed' || ticket.status === 'resolved') continue;

      let similarity = 0;
      // Title similarity (simple word overlap)
      const srcWords = new Set(source.title.toLowerCase().split(/\s+/));
      const tgtWords = new Set(ticket.title.toLowerCase().split(/\s+/));
      const intersection = [...srcWords].filter(w => tgtWords.has(w));
      if (srcWords.size > 0) {
        similarity += (intersection.length / srcWords.size) * 0.5;
      }
      // Category match
      if (source.category === ticket.category) similarity += 0.3;
      // Priority match
      if (source.priority === ticket.priority) similarity += 0.2;

      if (similarity >= threshold) {
        results.push({ ticket, confidence: similarity });
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  correlateRootCause(ticketIds: string[]): Record<string, unknown> {
    const tickets = ticketIds.map(id => this.tickets.get(id)).filter(Boolean) as Ticket[];
    if (tickets.length === 0) return {};

    // Find common tags and categories
    const categoryCount: Record<string, number> = {};
    const tagCount: Record<string, number> = {};

    for (const t of tickets) {
      categoryCount[t.category] = (categoryCount[t.category] || 0) + 1;
      if (t.tags) {
        for (const [key, value] of Object.entries(t.tags)) {
          const tagKey = `${key}:${value}`;
          tagCount[tagKey] = (tagCount[tagKey] || 0) + 1;
        }
      }
    }

    // Find most common category
    const dominantCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0];
    // Find most common tags (appearing in >50% of tickets)
    const commonTags = Object.entries(tagCount)
      .filter(([, count]) => count > tickets.length * 0.5)
      .map(([tag]) => tag);

    return {
      correlatedTickets: ticketIds,
      dominantCategory: dominantCategory?.[0],
      commonTags,
      confidence: tickets.length > 1 ? 0.8 : 0,
    };
  }

  getRelationsForTicket(ticketId: string): TicketRelation[] {
    return Array.from(this.relations.values()).filter(
      r => r.ticketId === ticketId || r.relatedTicketId === ticketId
    );
  }

  findRelatedTickets(ticketId: string, options?: { maxResults?: number; minConfidence?: number }): { ticket: Ticket; confidence: number }[] {
    const limit = options?.maxResults ?? 20;
    const minConf = options?.minConfidence ?? 0;

    const relatedIds = new Map<string, number>();
    for (const rel of this.relations.values()) {
      if (rel.ticketId === ticketId) {
        relatedIds.set(rel.relatedTicketId, rel.confidence ?? 0.5);
      } else if (rel.relatedTicketId === ticketId) {
        relatedIds.set(rel.ticketId, rel.confidence ?? 0.5);
      }
    }

    const results: { ticket: Ticket; confidence: number }[] = [];
    for (const [id, conf] of relatedIds.entries()) {
      if (conf < minConf) continue;
      const ticket = this.tickets.get(id);
      if (ticket) results.push({ ticket, confidence: conf });
    }

    return results.sort((a, b) => b.confidence - a.confidence).slice(0, limit);
  }

  addRelation(
    ticketId: string,
    relatedTicketId: string,
    relationType: TicketRelationType,
    createdBy: string,
    description?: string,
    confidence?: number
  ): TicketRelation {
    const relation: TicketRelation = {
      id: `REL-${crypto.randomUUID().slice(0, 8)}`,
      ticketId,
      relatedTicketId,
      relationType: relationType as TicketRelationType,
      confidence: confidence ?? 1.0,
      createdBy,
      createdAt: new Date(),
      description,
    };
    this.relations.set(relation.id, relation);
    return relation;
  }

  clearAll(): void {
    this.tickets.clear();
    this.relations.clear();
  }
}
