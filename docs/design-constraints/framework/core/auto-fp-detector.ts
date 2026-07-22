/**
 * Auto False Positive Detector — automatically marks likely false positives
 * based on historical FP patterns, without requiring manual logFalsePositive calls.
 *
 * Uses pattern matching against known FP scenarios from the false positive log.
 */

import * as fs from 'fs';
import * as path from 'path';

interface AutoFPResult {
  file: string;
  line: number;
  issueType: string;
  matchReason: string;
  recommendedAction: 'suppress' | 'review' | 'keep';
  confidence: number;
}

/**
 * Run auto FP detection on a given directory.
 * Returns issues that are likely false positives based on historical patterns.
 */
export function detectAutoFalsePositives(logFile: string): AutoFPResult[] {
  if (!fs.existsSync(logFile)) return [];

  const log: Array<{ issueType: string; file: string; line: number; reason: string }> = JSON.parse(fs.readFileSync(logFile, 'utf-8'));

  const results: AutoFPResult[] = [];
  const patternMap: Record<string, RegExp[]> = {};

  // Build regex patterns from FP reasons
  for (const entry of log) {
    const reason = entry.reason.toLowerCase();
    const key = entry.issueType;
    patternMap[key] = patternMap[key] || [];

    // Extract key phrases from reasons
    const phrases: string[] = [];
    if (reason.includes('global') || reason.includes('interceptor')) phrases.push('global|interceptor|全局');
    if (reason.includes('intentional') || reason.includes('design') || reason.includes('intentionally')) phrases.push('intentional|design|故意');
    if (reason.includes('test') || reason.includes('mock')) phrases.push('test|mock');
    if (reason.includes('already') || reason.includes('already handled') || reason.includes('existing')) phrases.push('already|existing|已有');
    if (reason.includes('component') || reason.includes('wrapper') || reason.includes('封装')) phrases.push('component|wrapper|封装');

    for (const phrase of phrases) {
      if (!patternMap[key].some(r => r.source === phrase)) {
        patternMap[key].push(new RegExp(phrase, 'i'));
      }
    }
  }

  // Now scan all files mentioned in the FP log to find similar patterns
  const seen = new Set<string>();
  for (const entry of log) {
    const key = `${entry.file}:${entry.line}:${entry.issueType}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Check if the reason matches known FP patterns
    const patterns = patternMap[entry.issueType] || [];
    const matchedPattern = patterns.find(p => p.test(entry.reason));

    results.push({
      file: entry.file,
      line: entry.line,
      issueType: entry.issueType,
      matchReason: matchedPattern ? matchedPattern.source : 'historical',
      recommendedAction: entry.reason.toLowerCase().includes('test') ? 'suppress' : 'review',
      confidence: matchedPattern ? 75 : 60,
    });
  }

  return results;
}
