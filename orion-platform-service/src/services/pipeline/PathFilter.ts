/**
 * PathFilter - Advanced path matching for CI triggers
 *
 * Supports:
 * - `*` matches everything except path separators
 * - `**` matches any number of path segments (including zero)
 * - `!` negation/exclude pattern (prefix)
 * - `[]` character class (e.g. `[abc]`, `[a-z]`)
 * - `{}` brace expansion (e.g. `*.{js,ts}`)
 * - `?` matches exactly one character
 *
 * Usage:
 *   const filter = new PathFilter();
 *   filter.matches('src/utils.ts', 'src/' + '**' + '/\*.ts');       // true
 *   filter.matches('test/utils.ts', 'src/' + '**' + '/\*.ts');      // false
 *   filter.matchesAny('src/a.ts', ['src/' + '**' + '/\*.ts', '!**/test/**']);  // false (negation wins)
 *   filter.filterChanges(['src/a.ts', 'test/b.ts'], patterns); // returns only src/a.ts
 */

export class PathFilter {
  private regexCache = new Map<string, RegExp>();

  /**
   * Convert a glob pattern to a regular expression.
   */
  private globToRegex(pattern: string): RegExp {
    const cached = this.regexCache.get(pattern);
    if (cached) return cached;

    let regex = '';
    let i = 0;

    while (i < pattern.length) {
      const char = pattern[i];
      const next = pattern[i + 1];

      switch (char) {
        case '*':
          if (next === '*') {
            // `**` — match any path segments
            // `**/` at start or middle matches zero or more directories
            if (i + 2 < pattern.length && pattern[i + 2] === '/') {
              regex += '(?:.*/)?';
              i += 3; // skip **/
            } else if (i === 0 || (i > 0 && pattern[i - 1] === '/')) {
              regex += '(?:.*/)?';
              i += 2; // skip **
            } else {
              regex += '.*';
              i += 2;
            }
          } else {
            // `*` — match anything except `/`
            regex += '[^/]*';
            i++;
          }
          break;

        case '?':
          // `?` — match exactly one non-separator character
          regex += '[^/]';
          i++;
          break;

        case '[': {
          // Character class: [abc], [a-z], [!abc]
          const closeIdx = pattern.indexOf(']', i);
          if (closeIdx === -1) {
            // No closing bracket, treat as literal
            regex += '\\[';
            i++;
          } else {
            const content = pattern.slice(i + 1, closeIdx);
            // Convert [!...] to [^...]
            const negated = content.startsWith('!') ? '^' + content.slice(1) : content;
            regex += `[${negated}]`;
            i = closeIdx + 1;
          }
          break;
        }

        case '{': {
          // Brace expansion: {a,b,c}
          const closeIdx = this.findBraceClose(pattern, i);
          if (closeIdx === -1) {
            regex += '\\{';
            i++;
          } else {
            const content = pattern.slice(i + 1, closeIdx);
            const alternatives = this.splitBraceContent(content);
            regex += `(?:${alternatives.join('|')})`;
            i = closeIdx + 1;
          }
          break;
        }

        case '.':
          // Escape `.`
          regex += '\\.';
          i++;
          break;

        case '+':
        case '(':
        case ')':
        case '^':
        case '$':
        case '|':
          // Escape regex special characters
          regex += '\\' + char;
          i++;
          break;

        case '/':
          regex += '/';
          i++;
          break;

        default:
          regex += char;
          i++;
      }
    }

    const result = new RegExp('^' + regex + '$');
    this.regexCache.set(pattern, result);
    return result;
  }

  /**
   * Find the closing `}` for a brace expression, handling nested braces.
   */
  private findBraceClose(pattern: string, start: number): number {
    let depth = 1;
    for (let i = start + 1; i < pattern.length; i++) {
      if (pattern[i] === '{') depth++;
      else if (pattern[i] === '}') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  /**
   * Split brace content by `,`, respecting nested braces.
   */
  private splitBraceContent(content: string): string[] {
    const parts: string[] = [];
    let current = '';
    let depth = 0;

    for (const char of content) {
      if (char === '{') depth++;
      else if (char === '}') depth--;

      if (char === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current) parts.push(current.trim());
    return parts;
  }

  /**
   * Test if a single path matches a single pattern (no negation).
   */
  match(path: string, pattern: string): boolean {
    const regex = this.globToRegex(pattern);
    return regex.test(path);
  }

  /**
   * Test if a path matches a set of patterns (with negation support).
   *
   * Rules:
   * - Include patterns: add to match set
   * - Negation patterns (start with `!`): remove from match set
   * - If any negation matches, final result is false (negation wins)
   * - If patterns has no includes, defaults to `**` (match all)
   * - If patterns is empty, defaults to false (no match)
   */
  matchesAny(path: string, patterns: string[]): boolean {
    if (patterns.length === 0) return false;

    // Default include if no explicit include patterns
    const hasInclude = patterns.some((p) => !p.startsWith('!'));
    if (!hasInclude) {
      // No include patterns — all patterns are negations, default match all first
      let matched = true;
      for (const pattern of patterns) {
        if (pattern.startsWith('!')) {
          const negPattern = pattern.slice(1);
          if (this.match(path, negPattern)) {
            return false; // negation wins
          }
        }
      }
      return matched;
    }

    let matched = false;
    for (const pattern of patterns) {
      if (pattern.startsWith('!')) {
        const negPattern = pattern.slice(1);
        if (this.match(path, negPattern)) {
          return false; // negation wins over any prior include
        }
      } else {
        if (this.match(path, pattern)) {
          matched = true;
        }
      }
    }
    return matched;
  }

  /**
   * Filter an array of changed paths, returning only those matching the patterns.
   */
  filterChanges(paths: string[], patterns: string[]): string[] {
    if (patterns.length === 0) return paths;
    return paths.filter((p) => this.matchesAny(p, patterns));
  }
}

export const pathFilter = new PathFilter();
