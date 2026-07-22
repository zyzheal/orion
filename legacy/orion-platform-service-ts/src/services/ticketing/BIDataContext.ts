// @ts-nocheck
/**
 * BIDataContext - Shared data view for Ticket BI computation modules
 *
 * Provides read-only access to the data needed by dashboard builders
 * and analytics calculators. Avoids passing 6 separate parameters.
 */

import type { Ticket, TicketSLA, DispatchResult, TransferRecord, CommentRecord, EngineerProfile } from '../../types';

export interface BIDataContext {
  /** All tickets */
  tickets: Ticket[];
  /** SLA records keyed by ticket ID for fast lookup */
  slaRecords: TicketSLA[];
  /** Dispatch results */
  dispatchResults: DispatchResult[];
  /** Transfer records */
  transferRecords: TransferRecord[];
  /** Comment records */
  commentRecords: CommentRecord[];
  /** Engineer profiles keyed by engineer ID */
  engineerProfiles: Map<string, EngineerProfile>;
}

/** Create a BIDataContext from raw data arrays */
export function createBIContext(data: {
  tickets: Ticket[];
  slaRecords?: TicketSLA[];
  dispatchResults?: DispatchResult[];
  transferRecords?: TransferRecord[];
  commentRecords?: CommentRecord[];
  engineerProfiles?: EngineerProfile[];
}): BIDataContext {
  const profileMap = new Map<string, EngineerProfile>();
  if (data.engineerProfiles) {
    for (const p of data.engineerProfiles) {
      profileMap.set(p.id, p);
    }
  }

  return {
    tickets: data.tickets,
    slaRecords: data.slaRecords ?? [],
    dispatchResults: data.dispatchResults ?? [],
    transferRecords: data.transferRecords ?? [],
    commentRecords: data.commentRecords ?? [],
    engineerProfiles: profileMap,
  };
}
