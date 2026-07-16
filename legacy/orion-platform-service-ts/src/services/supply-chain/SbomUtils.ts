/**
 * SbomUtils - Shared utilities for SBOM analysis
 *
 * Provides string similarity calculations and typosquatting classification.
 */

// ==================== String Similarity ====================

export function calculateStringSimilarity(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0 || lenB === 0) return 0;

  const matrix: number[][] = [];
  for (let i = 0; i <= lenA; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= lenB; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  const distance = matrix[lenA][lenB];
  const maxLen = Math.max(lenA, lenB);
  return 1 - distance / maxLen;
}

export function classifyTyposquatting(
  suspicious: string,
  legitimate: string,
): 'typosquatting' | 'homograph' | 'combo' | 'namespace-squat' {
  if (suspicious.includes('-') && legitimate.split('-').every((p) => suspicious.includes(p))) {
    return 'namespace-squat';
  }
  if (suspicious.length > legitimate.length && suspicious.startsWith(legitimate)) {
    return 'combo';
  }
  if (Math.abs(suspicious.length - legitimate.length) <= 1) {
    return 'homograph';
  }
  return 'typosquatting';
}
