/** ProductLine model */

export type ProductLinePhase = 'Pending' | 'Onboarding' | 'Running' | 'Retiring' | 'Retired';

export interface ProductLine {
  id: string;
  name: string;
  description: string;
  ownerId: string;
}

export interface ProductLineCreateInput {
  name: string;
  description?: string;
  ownerId: string;
  phase?: ProductLinePhase;
}

export interface ProductLineUpdateInput {
  name?: string;
  description?: string;
  ownerId?: string;
  phase?: ProductLinePhase;
}
