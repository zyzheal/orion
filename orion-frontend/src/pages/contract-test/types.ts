export interface Contract {
  consumer: string;
  provider: string;
  endpoint: string;
  method: string;
  status: 'verified' | 'drift' | 'missing' | 'pending';
  lastVerified: string;
  version: string;
}

export interface DriftDetail {
  field: string;
  expected: string;
  actual: string;
  severity: 'breaking' | 'minor' | 'patch';
}
