#!/usr/bin/env python3
"""Reverse the statement order within every _down.sql file in migrations/.

SQL statements are separated by ';'. The header comments (lines starting
with '--' before the first SQL statement) are preserved at the top.  The
remaining statements are reversed so that rollback runs in the opposite
order of the forward migration.

A "statement" is one or more lines ending with a ';' (the semicolon is
kept on the final line of the statement).  Comments embedded inside a
statement are preserved as part of that statement.
"""

import glob
import os
import re

DIR = "/Users/heal/orion-design/orion-platform-svc-go/migrations"

SKIP_NAMES = {"002_create_pipeline_engine_tables_down.sql"}  # fixed manually (Issue 2)


def parse_file(path: str) -> tuple[list[str], list[str]]:
    """Return (header_lines, statements).

    header_lines: all leading comment lines (starting with '--') before
                  the first SQL token that isn't a comment.
    statements:   list of raw statement blocks (each ending with ';').
    """
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    # Strip trailing newline on each line but keep content
    header: list[str] = []
    body_lines: list[str] = []
    past_header = False
    for line in lines:
        stripped = line.rstrip("\n")
        if not past_header:
            # A header line is either empty or starts with '--'
            if stripped == "" or stripped.lstrip().startswith("--"):
                header.append(stripped)
                continue
            past_header = True
        body_lines.append(stripped)

    # Remove trailing blank lines from header
    while header and header[-1] == "":
        header.pop()

    # Reassemble body and split into statements by ';'
    body = "\n".join(body_lines)
    statements: list[str] = []
    buf = ""
    for line in body_lines:
        buf += line + "\n"
        if line.rstrip().endswith(";"):
            # Trim the final blank line that was added, then keep content
            statements.append(buf.rstrip("\n"))
            buf = ""
    if buf.strip():
        statements.append(buf.rstrip("\n"))

    return header, statements


def rewrite(path: str):
    header, statements = parse_file(path)
    if not statements:
        return  # nothing to reverse

    reversed_stmts = list(reversed(statements))

    parts = []
    # Header
    for line in header:
        parts.append(line)

    # Blank line separator if header is non-empty
    if header and header[-1] != "":
        parts.append("")

    # Reversed statements
    for s in reversed_stmts:
        parts.append(s)
        parts.append("")  # blank line between statements

    content = "\n".join(parts)
    # Ensure single trailing newline
    content = content.rstrip() + "\n"

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def main():
    files = sorted(glob.glob(os.path.join(DIR, "*_down.sql")))
    skipped = 0
    for f in files:
        basename = os.path.basename(f)
        if basename in SKIP_NAMES:
            skipped += 1
            continue
        rewrite(f)
    print(f"Reversed {len(files) - skipped} _down.sql files ({skipped} skipped for manual fix).")


if __name__ == "__main__":
    main()
