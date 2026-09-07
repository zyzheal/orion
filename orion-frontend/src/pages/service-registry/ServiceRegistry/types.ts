/**
 * ServiceRegistry shared types
 * 抽取自 index.tsx (P2-9 Phase 142)
 */

export interface RegisterFormValues {
  serviceId: string;
  serviceName: string;
  serviceUrl: string;
  protocol: string;
  version: string;
}
