#!/usr/bin/env python3
"""
Unified pagination ledger script.

Replaces the 5+ incompatible ad-hoc counts from Rounds 93-111
(149 / 147 / 218 / 149->156 / 36-25-81). Each round used a different
grep pattern for "how many bare Atoi sites remain?" -- this script
defines ONE fixed set of categories.

Categories (fixed definitions, reported every run):

  A. bare_atoi_query  - strconv.Atoi on c.Query/DefaultQuery with
     error discarded (the _, err pattern). Non-test files only.
     These caused 500s and silent over-fetch.

  B. bare_atoi_param  - strconv.Atoi on c.Param. Non-test files.
     Path params, not pagination -- different defect class.

  C. pagination_calls - pagination.Page/Limit/Offset/Int/
     OffsetFromPage/LimitMax calls. Non-test files.

  D. manual_caps      - if X > N within 5 lines after
     pagination.Limit. Redundant since Round 111.

  E. fmt_sscanf_query - fmt.Sscanf on c.Query/Param. Non-test.

Usage: python3 tools/ledger/count_pagination_sites.py
"""

import os
import re
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, "..", ".."))


def grep(pattern):
    """Run grep -rnE, return list of (file, lineno, line)."""
    result = subprocess.run(
        ["grep", "-rnE", "--include=*.go", pattern,
         os.path.join(ROOT, "internal")],
        capture_output=True, text=True,
    )
    out = []
    for line in result.stdout.strip().split("\n"):
        if not line:
            continue
        # Match any path : lineno : code
        m = re.match(r'^(.+?):(\d+):(.*)', line)
        if m:
            fpath = os.path.relpath(m.group(1), ROOT)
            out.append((fpath, int(m.group(2)), m.group(3)))
    return out


def is_test(fpath):
    return "_test.go" in fpath


def count_bare_atoi_query():
    """A: strconv.Atoi on c.Query/DefaultQuery, error discarded."""
    sites = grep(r'strconv\.Atoi.*(c\.Query|c\.DefaultQuery)')
    return [s for s in sites if not is_test(s[0])]


def count_bare_atoi_param():
    """B: strconv.Atoi on c.Param."""
    sites = grep(r'strconv\.Atoi.*c\.Param')
    return [s for s in sites if not is_test(s[0])]


def count_pagination_calls():
    """C: pagination.* calls."""
    sites = grep(r'pagination\.(Page|Limit|Offset|Int|OffsetFromPage|LimitMax)\(')
    return [s for s in sites if not is_test(s[0])]


def count_manual_caps():
    """D: manual if X > N after pagination.Limit."""
    sites = grep(r'pagination\.Limit')
    capped = []
    for fpath, lineno, line in sites:
        if is_test(fpath):
            continue
        full = os.path.join(ROOT, fpath)
        try:
            with open(full) as f:
                lines = f.readlines()
        except FileNotFoundError:
            continue
        found = False
        for i in range(lineno - 1, min(lineno + 5, len(lines))):
            if re.search(r'if\s+\w+\s*>\s*\d+', lines[i]):
                found = True
                break
        if found:
            capped.append((fpath, lineno, line))
    return capped


def count_fmt_sscanf_query():
    """E: fmt.Sscanf on c.Query/Param/DefaultQuery."""
    sites = grep(r'fmt\.Sscanf.*(c\.Query|c\.Param|c\.DefaultQuery)')
    return [s for s in sites if not is_test(s[0])]


def main():
    a = count_bare_atoi_query()
    b = count_bare_atoi_param()
    c = count_pagination_calls()
    d = count_manual_caps()
    e = count_fmt_sscanf_query()

    print("=== Unified Pagination Ledger ===")
    print()
    print(f"A. bare_atoi_query   (strconv.Atoi + c.Query, error discarded): {len(a)}")
    for f, n, line in a:
        print(f"   {f}:{n}: {line.strip()}")
    print()
    print(f"B. bare_atoi_param   (strconv.Atoi + c.Param):                   {len(b)}")
    for f, n, line in b:
        print(f"   {f}:{n}: {line.strip()}")
    print()
    print(f"C. pagination_calls  (pagination.Page/Limit/Offset/Int/etc.):   {len(c)}")
    print()
    print(f"D. manual_caps       (if X > N after pagination.Limit):          {len(d)}")
    print("   (redundant since Round 111: Limit caps at 100 internally)")
    print()
    print(f"E. fmt_sscanf_query  (fmt.Sscanf + c.Query/Param):               {len(e)}")
    for f, n, line in e:
        print(f"   {f}:{n}: {line.strip()}")
    print()
    print("--- Summary ---")
    print(f"  Bare Atoi on query params (A): {len(a)}  (target: 0)")
    print(f"  Bare Atoi on path params (B):  {len(b)}  (non-pagination, checks error)")
    print(f"  Migrated to pagination    (C): {len(c)}")
    print(f"  Manual caps (redundant)   (D): {len(d)}")
    print(f"  Bare Sscanf on query      (E): {len(e)}  (target: 0)")

    if len(a) == 0 and len(e) == 0:
        print()
        print("  STATUS: All query-param parsing migrated to pagination package.")
        sys.exit(0)
    else:
        print()
        print("  STATUS: Sites still need migration. See A and E above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
