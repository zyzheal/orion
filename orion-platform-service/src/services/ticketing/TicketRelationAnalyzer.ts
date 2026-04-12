/**
 * TASK-801: Ticket Relation Analyzer
 *
 * Analyzes relationships between tickets:
 * - Find related tickets by similarity
 * - Duplicate detection
 * - Root cause correlation across tickets
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Ticket,
  TicketRelation,
  TicketRelationType,
  TicketCategory,
  TicketPriority,
} from './types';

/**
 * Ticket Relation Analyzer
 *
 * Provides:
 * - Finding related tickets by category, tags, and text similarity
 * - Duplicate detection based on content similarity
 * - Root cause correlation across multiple related tickets
 */
export class TicketRelationAnalyzer {
  /** Stored relations */
  private relations: TicketRelation[] = [];

  /** Ticket store for lookups */
  private tickets: Map<string, Ticket> = new Map();

  /**
   * Register a ticket for analysis
   */
  registerTicket(ticket: Ticket): void {
    this.tickets.set(ticket.id, ticket);
  }

  /**
   * Remove a ticket from analysis
   */
  unregisterTicket(ticketId: string): void {
    this.tickets.delete(ticketId);
  }

  /**
   * Manually add a relation between tickets
   */
  addRelation(
    ticketId: string,
    relatedTicketId: string,
    relationType: TicketRelationType,
    createdBy: string,
    description?: string,
    confidence?: number
  ): TicketRelation {
    const relation: TicketRelation = {
      id: `REL-${uuidv4()}`,
      ticketId,
      relatedTicketId,
      relationType,
      confidence: confidence ?? 1.0,
      createdAt: new Date(),
      createdBy,
      description,
    };

    this.relations.push(relation);

    // Register tickets if not already
    const t1 = this.tickets.get(ticketId);
    const t2 = this.tickets.get(relatedTicketId);
    if (t1) this.registerTicket(t1);
    if (t2) this.registerTicket(t2);

    return relation;
  }

  /**
   * Find related tickets for a given ticket
   *
   * Uses multiple signals:
   * - Same category
   - Matching tags
   - Text similarity in title/description
   - Temporal proximity
   */
  findRelatedTickets(ticketId: string, options?: {
    maxResults?: number;
    minConfidence?: number;
    excludeTypes?: TicketRelationType[];
  }): { ticket: Ticket; relation: TicketRelation; confidence: number }[] {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return [];

    const maxResults = options?.maxResults ?? 10;
    const minConfidence = options?.minConfidence ?? 0.1;

    const candidates: { ticket: Ticket; score: number }[] = [];

    for (const other of this.tickets.values()) {
      if (other.id === ticketId) continue;

      let score = 0;

      // Category match (strong signal)
      if (ticket.category === other.category) {
        score += 0.3;
      }

      // Priority match
      if (ticket.priority === other.priority) {
        score += 0.1;
      }

      // Tag overlap
      if (ticket.tags && other.tags) {
        const tagOverlap = this.calculateTagOverlap(ticket.tags, other.tags);
        score += tagOverlap * 0.3;
      }

      // Text similarity
      const textSim = this.calculateTextSimilarity(ticket, other);
      score += textSim * 0.3;

      // Temporal proximity (tickets created close together are more likely related)
      const timeDiff = Math.abs(ticket.createdAt.getTime() - other.createdAt.getTime());
      const maxTimeDiff = 24 * 60 * 60 * 1000; // 24 hours
      if (timeDiff < maxTimeDiff) {
        score += 0.1 * (1 - timeDiff / maxTimeDiff);
      }

      // Same source type
      if (ticket.source === other.source) {
        score += 0.05;
      }

      // Same reporter
      if (ticket.reporter === other.reporter) {
        score += 0.05;
      }

      if (score >= minConfidence) {
        candidates.push({ ticket: other, score });
      }
    }

    // Sort by score and take top N
    candidates.sort((a, b) => b.score - a.score);

    return candidates.slice(0, maxResults).map(c => {
      // Check if a relation already exists
      const existingRelation = this.relations.find(
        r => (r.ticketId === ticketId && r.relatedTicketId === c.ticket.id) ||
             (r.ticketId === c.ticket.id && r.relatedTicketId === ticketId)
      );

      const relation: TicketRelation = existingRelation || {
        id: `REL-${uuidv4()}`,
        ticketId,
        relatedTicketId: c.ticket.id,
        relationType: 'related',
        confidence: c.score,
        createdAt: new Date(),
      };

      return { ticket: c.ticket, relation, confidence: c.score };
    });
  }

  /**
   * Detect potential duplicate tickets
   *
   * Returns tickets with high similarity scores
   * that might be duplicates of the given ticket.
   */
  detectDuplicates(ticketId: string, threshold: number = 0.7): { ticket: Ticket; confidence: number }[] {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return [];

    const duplicates: { ticket: Ticket; confidence: number }[] = [];

    for (const other of this.tickets.values()) {
      if (other.id === ticketId) continue;
      // Only compare with open/assigned/in-progress tickets
      if (!['open', 'assigned', 'in-progress'].includes(other.status)) continue;

      let confidence = 0;

      // Must have same category
      if (ticket.category !== other.category) continue;

      // Title similarity (very strong signal for duplicates)
      const titleSim = this.stringSimilarity(ticket.title.toLowerCase(), other.title.toLowerCase());
      confidence += titleSim * 0.5;

      // Description similarity
      const descSim = this.stringSimilarity(
        (ticket.description || '').toLowerCase(),
        (other.description || '').toLowerCase()
      );
      confidence += descSim * 0.3;

      // Same source alert (definitive duplicate)
      if (ticket.sourceAlertId && other.sourceAlertId &&
          ticket.sourceAlertId === other.sourceAlertId) {
        confidence += 0.5; // Bonus for same source
      }

      // Same metric/source
      if (ticket.metadata?.metric && other.metadata?.metric &&
          ticket.metadata.metric === other.metadata.metric) {
        confidence += 0.2;
      }

      // Tag overlap
      if (ticket.tags && other.tags) {
        const tagOverlap = this.calculateTagOverlap(ticket.tags, other.tags);
        confidence += tagOverlap * 0.1;
      }

      if (confidence >= threshold) {
        duplicates.push({ ticket: other, confidence: Math.min(confidence, 1.0) });
      }
    }

    duplicates.sort((a, b) => b.confidence - a.confidence);
    return duplicates;
  }

  /**
   * Correlate root cause across multiple tickets
   *
   * Analyzes a set of tickets to identify potential
   * root cause tickets based on temporal ordering and
   * causal relationships.
   */
  correlateRootCause(ticketIds: string[]): {
    rootCauseTicket?: Ticket;
    affectedTickets: Ticket[];
    reasoning: string[];
    confidence: number;
  } {
    const tickets = ticketIds
      .map(id => this.tickets.get(id))
      .filter((t): t is Ticket => t !== undefined);

    if (tickets.length === 0) {
      return { affectedTickets: [], reasoning: ['No tickets provided'], confidence: 0 };
    }

    if (tickets.length === 1) {
      return {
        rootCauseTicket: tickets[0],
        affectedTickets: [],
        reasoning: ['Single ticket - no correlation needed'],
        confidence: 1.0,
      };
    }

    const reasoning: string[] = [];

    // Score each ticket as potential root cause
    const scores: Record<string, number> = {};

    for (const ticket of tickets) {
      let score = 0;

      // Earliest ticket is most likely root cause
      const ages = tickets.map(t => t.createdAt.getTime());
      const earliest = Math.min(...ages);
      const timeDiff = ticket.createdAt.getTime() - earliest;
      if (timeDiff === 0) {
        score += 0.4;
        reasoning.push(`"${ticket.title}" is among the earliest tickets`);
      } else {
        const maxDiff = Math.max(...ages) - earliest;
        score += 0.4 * (1 - timeDiff / (maxDiff || 1));
      }

      // Infrastructure tickets are often root causes
      if (ticket.category === 'infrastructure' || ticket.category === 'database') {
        score += 0.2;
        reasoning.push(`"${ticket.title}" is ${ticket.category} type (common root cause)`);
      }

      // Higher severity = more likely root cause
      const severityScore: Record<TicketPriority, number> = {
        critical: 0.2,
        high: 0.15,
        medium: 0.1,
        low: 0.05,
      };
      score += severityScore[ticket.priority];

      // Has "caused-by" relations pointing to it
      const causedByRelations = this.relations.filter(
        r => r.relatedTicketId === ticket.id && r.relationType === 'caused-by'
      );
      if (causedByRelations.length > 0) {
        score += 0.2;
        reasoning.push(`"${ticket.title}" is referenced as cause by ${causedByRelations.length} ticket(s)`);
      }

      scores[ticket.id] = score;
    }

    // Find the highest scoring ticket
    let rootCauseId = ticketIds[0];
    let maxScore = 0;
    for (const [id, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        rootCauseId = id;
      }
    }

    const rootCauseTicket = this.tickets.get(rootCauseId);
    const affectedTickets = tickets.filter(t => t.id !== rootCauseId);

    // Auto-create caused-by relations
    for (const affected of affectedTickets) {
      const existing = this.relations.find(
        r => r.ticketId === affected.id &&
             r.relatedTicketId === rootCauseId &&
             r.relationType === 'caused-by'
      );

      if (!existing) {
        this.addRelation(
          affected.id,
          rootCauseId,
          'caused-by',
          'system',
          `Auto-correlated: "${affected.title}" likely caused by "${rootCauseTicket?.title}"`,
          maxScore
        );
      }
    }

    return {
      rootCauseTicket,
      affectedTickets,
      reasoning,
      confidence: Math.min(maxScore, 1.0),
    };
  }

  /**
   * Get all relations for a ticket
   */
  getRelationsForTicket(ticketId: string): TicketRelation[] {
    return this.relations.filter(
      r => r.ticketId === ticketId || r.relatedTicketId === ticketId
    );
  }

  /**
   * Get all relations
   */
  getAllRelations(): TicketRelation[] {
    return [...this.relations];
  }

  /**
   * Remove a relation
   */
  removeRelation(relationId: string): boolean {
    const idx = this.relations.findIndex(r => r.id === relationId);
    if (idx === -1) return false;
    this.relations.splice(idx, 1);
    return true;
  }

  /**
   * Clear all data (for testing)
   */
  clearAll(): void {
    this.relations = [];
    this.tickets.clear();
  }

  // ==================== Private Utility Methods ====================

  /**
   * Calculate tag overlap between two tag sets (0-1)
   */
  private calculateTagOverlap(tags1: Record<string, string>, tags2: Record<string, string>): number {
    const keys1 = new Set(Object.keys(tags1));
    const keys2 = new Set(Object.keys(tags2));

    if (keys1.size === 0 || keys2.size === 0) return 0;

    let matches = 0;
    let total = 0;

    for (const key of keys1) {
      total++;
      if (keys2.has(key) && tags1[key] === tags2[key]) {
        matches++;
      } else if (keys2.has(key)) {
        matches += 0.3; // Partial match for same key, different value
      }
    }

    for (const key of keys2) {
      if (!keys1.has(key)) {
        total++;
      }
    }

    return total > 0 ? matches / total : 0;
  }

  /**
   * Calculate text similarity between two tickets
   */
  private calculateTextSimilarity(a: Ticket, b: Ticket): number {
    const textA = `${a.title} ${a.description}`.toLowerCase();
    const textB = `${b.title} ${b.description}`.toLowerCase();
    return this.stringSimilarity(textA, textB);
  }

  /**
   * Simple string similarity using word overlap (Jaccard-like)
   */
  private stringSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1.0;

    const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2));
    const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2));

    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let intersection = 0;
    for (const word of wordsA) {
      if (wordsB.has(word)) {
        intersection++;
      }
    }

    const union = new Set([...wordsA, ...wordsB]).size;
    return union > 0 ? intersection / union : 0;
  }
}
