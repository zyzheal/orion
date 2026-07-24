#!/usr/bin/env python3
"""
Migrate blueprint .go files to platform-svc-go/internal/<domain>/,
fixing import paths. Processes one domain at a time.
"""
import sys, os, shutil, re
from pathlib import Path

ROOT = Path("/Users/heal/orion-design")
PLATFORM = ROOT / "orion-platform-svc-go"
BLUEPRINTS = ROOT / "blueprints"

# Domain configs: for each domain, mapping blueprint internal prefix -> platform internal suffix
# and reverse import path fixup maps
DOMAINS = {}

# ---- CI-CD ----
# Blueprint: internal/ci-cd/<sub>/...  Platform: internal/<sub>/...
DOMAINS["ci-cd"] = {
    "src_bp": BLUEPRINTS / "orion-ci-cd-svc-go",
    "bp_prefix": "internal/ci-cd",
    "pl_prefix": "internal",
    "bp_module": "orion/ci-cd-svc-go",
    "pl_module": "orion/platform-svc-go",
    # extra import fixups (blueprint had weird flat imports)
    "extra_fixups": [
        ("orion/ci-cd-svc-go/internal/pipeline/models", "orion/platform-svc-go/internal/pipeline/models"),
        ("orion/ci-cd-svc-go/internal/runner/service", "orion/platform-svc-go/internal/runner/service"),
    ],
}

# ---- NOTIFICATION ----
# Blueprint: internal/notification/<sub>/... or internal/<sub>/...
# Platform: internal/notification/<sub>/...
# The blueprint has subdirs like channel/, chatops/, do-not-disturb/,
# notification-management/, notification-policy/, notification-template/,
# notification/, scheduled-notification/ — all at the top level of blueprint internal.
# But they map to notification/<sub>/ in platform.
DOMAINS["notification"] = {
    "src_bp": BLUEPRINTS / "orion-notification-svc-go",
    "bp_prefix": "internal",
    "pl_prefix": "internal/notification",
    "bp_module": "orion/notification-svc-go",
    "pl_module": "orion/platform-svc-go",
    # The blueprint uses flat imports like "orion/notification-svc-go/internal/channel/models"
    # which become "orion/platform-svc-go/internal/notification/channel/models"
    "extra_fixups": [],
}

# ---- WORKFLOW ----
# Blueprint: internal/<sub>/...  Platform: internal/workflow/<sub>/...
# Subdirs: approval, workflow, workflow-dependency, workflow-task, workflow-trigger, workflow-webhook
DOMAINS["workflow"] = {
    "src_bp": BLUEPRINTS / "orion-workflow-svc-go",
    "bp_prefix": "internal",
    "pl_prefix": "internal/workflow",
    "bp_module": "orion/workflow-svc-go",
    "pl_module": "orion/platform-svc-go",
    "extra_fixups": [
        ("orion/platform-svc-go/internal/workflow/service", "orion/platform-svc-go/internal/workflow/workflow/service"),
        ("orion/platform-svc-go/internal/workflow/repository", "orion/platform-svc-go/internal/workflow/workflow/repository"),
        ("orion/platform-svc-go/internal/workflow/models", "orion/platform-svc-go/internal/workflow/workflow/models"),
    ],
}

# ---- GOVERNANCE ----
# Blueprint: internal/<sub>/...  Platform: internal/governance/<sub>/...
DOMAINS["governance"] = {
    "src_bp": BLUEPRINTS / "orion-governance-svc-go",
    "bp_prefix": "internal",
    "pl_prefix": "internal/governance",
    "bp_module": "orion/governance-svc-go",
    "pl_module": "orion/platform-svc-go",
    "extra_fixups": [
        ("orion/platform-svc-go/internal/governance/models", "orion/platform-svc-go/internal/governance/governance/models"),
        ("orion/platform-svc-go/internal/governance/service", "orion/platform-svc-go/internal/governance/governance/service"),
        ("orion/platform-svc-go/internal/governance/repository", "orion/platform-svc-go/internal/governance/governance/repository"),
        ("orion/platform-svc-go/internal/governance/handler", "orion/platform-svc-go/internal/governance/governance/handler"),
    ],
}

# ---- SECURITY ----
# Blueprint: internal/<sub>/...  Platform: internal/security/<sub>/...
DOMAINS["security"] = {
    "src_bp": BLUEPRINTS / "orion-security-svc-go",
    "bp_prefix": "internal",
    "pl_prefix": "internal/security",
    "bp_module": "orion/security-svc-go",
    "pl_module": "orion/platform-svc-go",
    "extra_fixups": [
        ("orion/platform-svc-go/internal/security/models", "orion/platform-svc-go/internal/security/security/models"),
        ("orion/platform-svc-go/internal/security/service", "orion/platform-svc-go/internal/security/security/service"),
        ("orion/platform-svc-go/internal/security/repository", "orion/platform-svc-go/internal/security/security/repository"),
        ("orion/platform-svc-go/internal/security/handler", "orion/platform-svc-go/internal/security/security/handler"),
    ],
}

# ---- FINOPS ----
# Blueprint: internal/<sub>/...  Platform: internal/<sub>/...  (1:1 mapping)
DOMAINS["finops"] = {
    "src_bp": BLUEPRINTS / "orion-finops-svc-go",
    "bp_prefix": "internal",
    "pl_prefix": "internal",
    "bp_module": "orion/finops-svc-go",
    "pl_module": "orion/platform-svc-go",
    "extra_fixups": [],
}

# ---- AI ----
# Blueprint: internal/<sub>/...  Platform: internal/<mapped>/...
# Complex: blueprint subdirs map to various platform subdirs
DOMAINS["ai"] = {
    "src_bp": BLUEPRINTS / "orion-ai-svc-go",
    "bp_prefix": "internal",
    "pl_prefix": "internal",
    "bp_module": "orion/ai-svc-go",
    "pl_module": "orion/platform-svc-go",
    # blueprint subdir name -> platform subdir name
    "subdir_map": {
        "aiagent": "ai-agents",
        "aicost": "ai-cost",
        "aigateway": "ai-gateway",
        "aireview": "ai-review",
        "aisecurity": "ai-security",
        "degradation": "ai-degradation",
    },
    "extra_fixups": [],
}


def collect_bp_files(config):
    """Return list of (rel_path) .go files under bp_prefix, excluding go.mod etc."""
    bp = config["src_bp"]
    prefix = config["bp_prefix"]
    results = []
    for go_file in bp.rglob("*.go"):
        rel = str(go_file.relative_to(bp))
        if rel.startswith(prefix + "/"):
            # Skip go.mod, main.go, Dockerfile, .git, testdata
            if "/go.mod" in rel or rel.endswith("/main.go"):
                continue
            results.append(rel)
    return sorted(results)


def compute_target(config, rel_path):
    """Given a blueprint relative path, compute the platform target path."""
    bp_prefix = config["bp_prefix"]
    pl_prefix = config["pl_prefix"]
    # Strip bp_prefix from rel_path
    suffix = rel_path[len(bp_prefix) + 1:]  # +1 for the trailing slash
    target_rel = pl_prefix + "/" + suffix
    
    # Apply subdir_map for AI
    if "subdir_map" in config:
        parts = suffix.split("/")
        if parts and parts[0] in config["subdir_map"]:
            parts[0] = config["subdir_map"][parts[0]]
            target_rel = pl_prefix + "/" + "/".join(parts)
    
    return target_rel


def fix_imports(content, config):
    """Replace blueprint module imports with platform module imports."""
    bp_mod = config["bp_module"]
    pl_mod = config["pl_module"]
    
    # Basic module replacement
    content = content.replace(bp_mod, pl_mod)
    
    # Extra fixups
    for old, new in config.get("extra_fixups", []):
        content = content.replace(old, new)
    
    return content


def migrate_domain(name, dry_run=False):
    config = DOMAINS[name]
    print(f"\n{'='*60}")
    print(f"Migrating domain: {name}")
    print(f"{'='*60}")
    
    files = collect_bp_files(config)
    print(f"Blueprint files to process: {len(files)}")
    
    copied = 0
    for rel in files:
        src = config["src_bp"] / rel
        target_rel = compute_target(config, rel)
        dst = PLATFORM / target_rel
        
        if dry_run:
            print(f"  COPY {rel} -> {target_rel}")
            copied += 1
            continue
        
        # Create target directory
        dst.parent.mkdir(parents=True, exist_ok=True)
        
        # Read source
        content = src.read_text(encoding="utf-8", errors="replace")
        
        # Fix imports
        fixed = fix_imports(content, config)
        
        # Write
        dst.write_text(fixed, encoding="utf-8")
        copied += 1
    
    print(f"Copied: {copied} files")
    return copied


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: agent.py <domain> [--dry-run]")
        print("Domains:", list(DOMAINS.keys()))
        sys.exit(1)
    
    domain = sys.argv[1]
    dry_run = "--dry-run" in sys.argv
    
    if domain not in DOMAINS:
        print(f"Unknown domain: {domain}")
        sys.exit(1)
    
    count = migrate_domain(domain, dry_run=dry_run)
    print(f"\nDone: {count} files")
