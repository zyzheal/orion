#!/usr/bin/env python3
"""
Add context.WithTimeout to handler functions.

Approach: For each handler function in each handler.go:
  - Determine timeout based on function name
  - Add ctx, cancel := context.WithTimeout(...) + defer cancel() at function start
  - Replace c.Request.Context() -> ctx in service calls (if ctx was not already used)

Skips helper/non-endpoint functions.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SKIP_NAMES = {
    'RegisterRoutes', 'getTenantID', 'getUserID', 'getTenantId', 'getUserId',
    'parseTimeQuery', 'parseTimeRange', 'parseDate', 'validateRequest',
    'extractFilters', 'derefInt', 'derefString', 'derefFloat', 'derefBool',
}


def timeout_for(name: str) -> int:
    n = name.lower()
    if re.search(r'export|batch|bulk|analyze|import|report', n):
        return 60
    if re.search(r'list|summary|stats|search|overview|metrics|dashboard|trend|detail', n):
        return 30
    if re.search(r'create|add|record|update|patch|submit|deploy|trigger|execute|review|feedback|explanation|trace|decision|getexplanation|submitfeedback|gettraces|getstats|analyzedecisions|getexplanation', n):
        return 30
    if n in ('get', 'getagent', 'getdecision', 'getrecord', 'getbyid', 'getagent',
             'getglobaldeployment', 'getconfig', 'getrecord'):
        return 10
    if re.match(r'^get\b', n) and len(n) <= 12:
        return 10
    if re.match(r'^delete\b', n):
        return 10
    return 30


def find_func_blocks(lines):
    """Return list of (name, start_line_idx, end_line_idx) for handler funcs."""
    blocks = []
    # Match: func (h *Handler) Name(c *gin.Context) {
    pattern = re.compile(r'^\s*func \(h \*Handler\) (\w+)\(c \*gin\.Context\)')
    i = 0
    while i < len(lines):
        m = pattern.match(lines[i])
        if m:
            name = m.group(1)
            if name in SKIP_NAMES:
                i += 1
                continue
            start = i
            # Find function end by brace counting
            depth = 0
            j = i
            while j < len(lines):
                depth += lines[j].count('{')
                depth -= lines[j].count('}')
                if depth <= 0:
                    break
                j += 1
            blocks.append((name, start, j))
            i = j + 1
        else:
            i += 1
    return blocks


def add_import(lines, pkg):
    """Ensure import 'pkg' is in the import block. Returns new lines."""
    result = list(lines)
    # Check if already imported
    in_import = False
    imported = False
    for line in result:
        if '"%s"' % pkg in line:
            imported = True
            break
    if imported:
        return result

    # Find import block
    for i, line in enumerate(result):
        if line.strip() == 'import (':
            result.insert(i + 1, '\t"%s"\n' % pkg)
            return result
        if line.strip().startswith('import ('):
            result.insert(i + 1, '\t"%s"\n' % pkg)
            return result

    return result


def process_handler_file(filepath):
    """Process one handler.go file. Returns True if modified."""
    with open(filepath, 'r') as f:
        content = f.read()

    lines = content.split('\n')

    blocks = find_func_blocks(lines)
    if not blocks:
        return False

    modified = False
    needs_context = False
    needs_time = False

    # Check existing imports
    for line in lines:
        if '"context"' in line:
            needs_context = False
            break
    else:
        needs_context = True

    for line in lines:
        if '"time"' in line:
            needs_time = False
            break
    else:
        needs_time = True

    # Process each block (iterate backwards to preserve indices)
    for name, start, end in reversed(blocks):
        timeout = timeout_for(name)
        body_lines = lines[start:end + 1]
        body_text = '\n'.join(body_lines)

        # Check for existing ctx variable usage
        # We look for patterns like: ctx := c.Request.Context()  or  ctx, _ := ...
        has_ctx_decl = re.search(r'\bctx\s*:?\s*=', body_text)
        # But ctx from range or loop var shouldn't count; check if it's used as svc arg
        # More precise: check if ctx is assigned from c.Request.Context()
        has_ctx_from_request = re.search(r'ctx\s*:=\s*c\.Request\.Context\(\)', body_text)
        has_ctx_direct := re.search(r'\bctx\s*,?\s*:?\s*=\s*c\.Request\.Context\(\)', body_text) if False else re.search(r'\bctx.*=.*c\.Request\.Context', body_text)

        if has_ctx_from_request:
            # Replace the assignment with timeout version
            match = has_ctx_from_request
            # Find the line
            prefix = body_text[:match.start()]
            line_idx = prefix.count('\n')
            orig_line = body_lines[line_idx]
            indent = len(orig_line) - len(orig_line.lstrip())
            new_line = orig_line[:match.start() - prefix.rfind('\n') - 1]
            # Simpler: just string replace
            new_line = orig_line[:orig_line.index('ctx')] + \
                f'{" " * indent}ctx, cancel := context.WithTimeout(c.Request.Context(), {timeout}*time.Second)' + \
                orig_line[orig_line.index(match.group()) + len(match.group()):]
            body_lines[line_idx] = new_line
            body_lines.insert(line_idx + 1, f'{" " * indent}defer cancel()')
            modified = True

        elif has_ctx_direct:
            # ctx already set from request context but different syntax
            # Just wrap it
            match = has_ctx_direct
            prefix = body_text[:match.start()]
            line_idx = prefix.count('\n')
            orig_line = body_lines[line_idx]
            indent = len(orig_line) - len(orig_line.lstrip())
            new_line = orig_line[:orig_line.index('ctx')] + \
                f'{" " * indent}ctx, cancel := context.WithTimeout(c.Request.Context(), {timeout}*time.Second)' + \
                orig_line[orig_line.index(match.group()) + len(match.group()):]
            body_lines[line_idx] = new_line
            body_lines.insert(line_idx + 1, f'{" " * indent}defer cancel()')
            modified = True

        elif re.search(r'context\.Background\(\)', body_text):
            # Replace context.Background() with timeout context
            match = re.search(r'context\.Background\(\)', body_text)
            prefix = body_text[:match.start()]
            line_idx = prefix.count('\n')
            orig_line = body_lines[line_idx]
            indent = len(orig_line) - len(orig_line.lstrip())
            new_line = orig_line[:orig_line.index('context.Background')] + \
                f'{" " * indent}ctx, cancel := context.WithTimeout(c.Request.Context(), {timeout}*time.Second)'
            body_lines[line_idx] = new_line
            body_lines.insert(line_idx + 1, f'{" " * indent}defer cancel()')
            # Also replace any remaining context.Background() calls with ctx
            for k in range(len(body_lines)):
                body_lines[k] = body_lines[k].replace('context.Background()', 'ctx')
            modified = True

        else:
            # No ctx variable at all - inject at top of function
            func_line = body_lines[0]
            # Check if func line ends with {
            if func_line.rstrip().endswith('{'):
                indent = '\t'
                body_lines.insert(1, f'{indent}ctx, cancel := context.WithTimeout(c.Request.Context(), {timeout}*time.Second)')
                body_lines.insert(2, f'{indent}defer cancel()')
                # Replace h.svc.* (c.Request.Context()) -> h.svc.* (ctx) in body
                for k in range(len(body_lines)):
                    body_lines[k] = re.sub(
                        r'(h\.\w+\()c\.Request\.Context\(\)',
                        r'\1ctx)',
                        body_lines[k]
                    )
                modified = True

            # If func line doesn't end with {, find the { and insert after
            for k in range(len(body_lines)):
                if '{' in body_lines[k]:
                    indent = '\t'
                    body_lines.insert(k + 1, f'{indent}ctx, cancel := context.WithTimeout(c.Request.Context(), {timeout}*time.Second)')
                    body_lines.insert(k + 2, f'{indent}defer cancel()')
                    modified = True
                    break

        lines[start:end + 1] = body_lines
        # Note: end index changed because we inserted lines, but since we go backwards it's fine

    if modified:
        if needs_context:
            lines = add_import(lines, 'context')
        if needs_time:
            lines = add_import(lines, 'time')

        with open(filepath, 'w') as f:
            f.write('\n'.join(lines))

    return modified


def main():
    count = 0
    for dirpath, dirnames, filenames in os.walk(os.path.join(ROOT, 'internal')):
        # Skip test files and non-handler directories
        if 'handler' not in dirpath:
            continue
        if 'handler.go' not in filenames:
            continue
        filepath = os.path.join(dirpath, 'handler.go')
        try:
            if process_handler_file(filepath):
                count += 1
                print('  MODIFIED:', filepath)
        except Exception as e:
            print('  ERROR:', filepath, str(e), file=sys.stderr)
            import traceback
            traceback.print_exc()

    print(f'\nTotal modified: {count}')


if __name__ == '__main__':
    main()
