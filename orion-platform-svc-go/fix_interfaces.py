#!/usr/bin/env python3
"""
Add RepositoryInterface to service.go files that need it.
For each service.go:
1. Check if it already has RepositoryInterface - skip if so
2. Find all s.repo.MethodName() calls
3. Read ../repository/repository.go to get exact method signatures
4. Build interface block
5. Replace *repository.Repository -> RepositoryInterface everywhere
6. Insert interface after import block's closing )
7. Remove the repository import line
"""
import os, re, sys, glob

def read_file(path):
    with open(path, 'r') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w') as f:
        f.write(content)

def find_s_repo_calls(content):
    """Find all s.repo.MethodName() calls"""
    calls = set()
    for m in re.finditer(r's\.repo\.([A-Z][A-Za-z0-9_]*)(?:\s*\(|\s*,)', content):
        calls.add(m.group(1))
    return calls

def get_repo_method_sigs(repo_path):
    """Parse repository.go and return {MethodName: interface signature line}"""
    content = read_file(repo_path)
    pattern = r'func \(r \*Repository\) (\w+)\s*\(([^)]*)\)\s*([^{\n]*)\{'
    results = {}
    for m in re.finditer(pattern, content):
        name = m.group(1)
        params = m.group(2).strip()
        returns = m.group(3).strip()
        if returns:
            sig = f"{name}({params}) ({returns})"
        else:
            sig = f"{name}({params})"
        results[name] = sig
    return results

def find_import_bounds(lines):
    """Find (start, end) line indices for the import block. Returns (None, None) if not found."""
    started = False
    for i, line in enumerate(lines):
        if line.strip() == 'import (':
            started = True
            imp_start = i
            # find matching )
            depth = 1
            for j in range(i + 1, len(lines)):
                if lines[j].strip() == '(':
                    depth += 1
                elif lines[j].strip() == ')':
                    depth -= 1
                    if depth == 0:
                        return imp_start, j
            return imp_start, None
    return None, None

def main():
    os.chdir('/Users/heal/orion-design/orion-platform-svc-go')
    files = sorted(glob.glob('internal/*/service/service.go'))

    stats = {"fixed": 0, "skip_has_interface": 0, "skip_no_repo": 0,
             "skip_no_repo_file": 0, "skip_no_calls": 0, "error": 0}

    for fpath in files:
        content = read_file(fpath)

        # Already has interface
        if 'type RepositoryInterface interface' in content:
            stats["skip_has_interface"] += 1
            continue

        # Must use repository package
        if 'repository' not in content:
            stats["skip_no_repo"] += 1
            continue

        # Derive repository.go path
        repo_dir = os.path.join(os.path.dirname(fpath), '..', 'repository')
        repo_path = os.path.join(repo_dir, 'repository.go')

        if not os.path.exists(repo_path):
            stats["skip_no_repo_file"] += 1
            continue

        try:
            repo_sigs = get_repo_method_sigs(repo_path)
            if not repo_sigs:
                stats["error"] += 1
                print(f"  ERROR no sigs: {repo_path}")
                continue

            # Find repo methods called in service
            called = find_s_repo_calls(content)
            if not called:
                stats["skip_no_calls"] += 1
                continue

            # Build interface
            interface_methods = []
            missing = []
            for method in sorted(called):
                if method in repo_sigs:
                    interface_methods.append(f"\t{repo_sigs[method]}")
                else:
                    missing.append(method)

            if not interface_methods:
                stats["error"] += 1
                print(f"  ERROR no matching sigs for {fpath}, missing: {missing}")
                continue

            iface_body = "\n".join(interface_methods)
            iface_block = (
                "\n// RepositoryInterface defines the repository methods used by the service.\n"
                "type RepositoryInterface interface {\n"
                f"{iface_body}\n}\n"
            )

            # Step 1: Replace *repository.Repository with RepositoryInterface
            new_content = content.replace('*repository.Repository', 'RepositoryInterface')
            # Also replace "repository.Repository" (without *) just in case
            new_content = new_content.replace('repository.Repository', 'RepositoryInterface')

            # Step 2: Remove the repository import line
            lines = new_content.split('\n')
            imp_start, imp_end = find_import_bounds(lines)
            if imp_start is None:
                stats["error"] += 1
                print(f"  ERROR no import block: {fpath}")
                continue

            # Find and remove the repository import line
            for i in range(imp_start, imp_end + 1):
                stripped = lines[i].strip()
                # Match the repository import: "orion/platform-svc-go/internal/xxx/repository"
                if re.match(r'^"orion/platform-svc-go/internal/[^"]+/repository"\s*#?$|^\s*"orion/platform-svc-go/internal/[^"]+/repository"\s*$', stripped):
                    lines[i] = ""
                # Also handle the form where it's just a bare repo import
                # (check if the import line specifically ends with /repository")

            # Rejoin
            new_content = '\n'.join(lines)

            # Step 3: Insert interface after import block's closing )
            # Find the import block in the new_content
            lines2 = new_content.split('\n')
            imp_start2, imp_end2 = find_import_bounds(lines2)
            if imp_end2 is None:
                stats["error"] += 1
                print(f"  ERROR lost import close: {fpath}")
                continue

            # Insert after the ) line
            insert_at = imp_end2 + 1
            # Skip any blank lines right after ) for cleaner insertion
            while insert_at < len(lines2) and lines2[insert_at].strip() == '':
                insert_at += 1

            iface_lines = iface_block.split('\n')
            for idx, iline in enumerate(iface_lines):
                lines2.insert(insert_at + idx, iline)

            final_content = '\n'.join(lines2)

            write_file(fpath, final_content)
            stats["fixed"] += 1
            print(f"  FIXED: {fpath}")

        except Exception as e:
            stats["error"] += 1
            print(f"  ERROR {fpath}: {e}")

    print("\n=== SUMMARY ===")
    for k, v in stats.items():
        print(f"  {k}: {v}")
    return 0 if stats["error"] == 0 else 1

if __name__ == '__main__':
    sys.exit(main())
