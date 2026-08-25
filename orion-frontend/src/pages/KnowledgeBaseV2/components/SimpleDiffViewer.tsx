/**
 * SimpleDiffViewer — Lightweight unified diff display
 * 
 * Displays line-by-line diff between two text strings.
 * Uses a simplified LCS-based diff algorithm.
 * Shows added lines in green, removed lines in red.
 */

import { useMemo } from 'react';
interface DiffLine {
  type: 'add' | 'remove' | 'equal';
  text: string;
}

/**
 * Compute unified diff between two strings using LCS (Longest Common Subsequence)
 * Operates on lines for readability.
 */
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.replace(/\r\n/g, '\n').split('\n');
  const newLines = newText.replace(/\r\n/g, '\n').split('\n');

  // Build LCS table
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to get diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: 'equal', text: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'add', text: newLines[j - 1] });
      j--;
    } else if (i > 0) {
      result.unshift({ type: 'remove', text: oldLines[i - 1] });
      i--;
    }
  }

  return result;
}

interface SimpleDiffViewerProps {
  oldValue: string;
  newValue: string;
  oldLabel?: string;
  newLabel?: string;
  showDiffOnly?: boolean;
  maxHeight?: number;
}

export const SimpleDiffViewer: React.FC<SimpleDiffViewerProps> = ({
  oldValue,
  newValue,
  oldLabel = 'Old',
  newLabel = 'New',
  showDiffOnly = false,
  maxHeight = 500,
}) => {
  const diff = useMemo(() => computeDiff(oldValue, newValue), [oldValue, newValue]);

  // Precompute line numbers for each side (increments for equal + removed/added)
  const { numbered, oldNums, newNums } = useMemo(() => {
    let oldLine = 0;
    let newLine = 0;
    return diff.reduce(
      (acc, line) => {
        if (line.type === 'add') {
          newLine++;
        } else if (line.type === 'remove') {
          oldLine++;
        } else {
          oldLine++;
          newLine++;
        }
        acc.numbered.push(line);
        acc.oldNums.push(line.type === 'add' ? null : oldLine);
        acc.newNums.push(line.type === 'remove' ? null : newLine);
        return acc;
      },
      { numbered: [] as DiffLine[], oldNums: [] as (number | null)[], newNums: [] as (number | null)[] }
    );
  }, [diff]);

  return (
    <div
      style={{
        display: 'flex',
        border: '1px solid #f0f0f0',
        borderRadius: 4,
        maxHeight,
        overflow: 'auto',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 12,
      }}
    >
      {/* Left: old */}
      <div
        style={{
          flex: 1,
          borderRight: '1px solid #f0f0f0',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: 0,
            backgroundColor: '#fafafa',
            padding: '4px 12px',
            fontWeight: 'bold',
            fontSize: 11,
            color: '#8c8c8c',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          {oldLabel}
        </div>
        {numbered.map((line, idx) => {
          if (showDiffOnly && line.type === 'equal') return null;
          const ln = oldNums[idx];
          const style: React.CSSProperties = {
            display: 'flex',
            padding: '2px 8px',
            minHeight: '20px',
            overflowWrap: 'break-word',
            whiteSpace: 'pre-wrap',
            ...(line.type === 'remove' && {
              backgroundColor: '#ffe7e7',
              color: '#c0392b',
            }),
            ...(line.type === 'equal' && {
              color: '#595959',
            }),
          };
          return (
            <div key={`old-${idx}`} style={style}>
              <span style={{ width: 28, flex: 'none', textAlign: 'right', color: '#bfbfbf', marginRight: 8, userSelect: 'none' }}>
                {ln ?? ''}
              </span>
              <span style={{ flex: 1 }}>
                {line.type === 'remove' ? '-' : line.type === 'equal' ? ' ' : ''}
                {line.text}
              </span>
            </div>
          );
        })}
      </div>

      {/* Right: new */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: 0,
            backgroundColor: '#fafafa',
            padding: '4px 12px',
            fontWeight: 'bold',
            fontSize: 11,
            color: '#8c8c8c',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          {newLabel}
        </div>
        {numbered.map((line, idx) => {
          if (showDiffOnly && line.type === 'equal') return null;
          const ln = newNums[idx];
          const style: React.CSSProperties = {
            display: 'flex',
            padding: '2px 8px',
            minHeight: '20px',
            overflowWrap: 'break-word',
            whiteSpace: 'pre-wrap',
            ...(line.type === 'add' && {
              backgroundColor: '#e7f7e7',
              color: '#137333',
            }),
            ...(line.type === 'equal' && {
              color: '#595959',
            }),
          };
          return (
            <div key={`new-${idx}`} style={style}>
              <span style={{ width: 28, flex: 'none', textAlign: 'right', color: '#bfbfbf', marginRight: 8, userSelect: 'none' }}>
                {ln ?? ''}
              </span>
              <span style={{ flex: 1 }}>
                {line.type === 'add' ? '+' : line.type === 'equal' ? ' ' : ''}
                {line.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
