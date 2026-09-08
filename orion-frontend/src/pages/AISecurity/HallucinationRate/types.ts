export interface HallucinationRecord {
  id: string;
  model: string;
  prompt: string;
  response: string;
  hallucinated: boolean;
  confidence: number;
  detectedBy: string;
  category: string;
  detectedAt: string;
}
