#!/usr/bin/env python3
"""
Replace stub handlers with real implementations.
Strategy: fix imports, fix service calls, fix response helpers.
"""
import os
import re
import sys

BASE = "/Users/heal/orion-design/orion-platform-svc-go"

# Each module: dict of handler_name -> (svc_call_str, response_str, imports_needed, uses_query)
# svc_call: the service call body
# response: what to write on success
# uses_query: True if the service takes a Query struct

# Pattern: handler -> (import additions, handler_body_replacement)

def fix_module(module: str):
    hpath = f"{BASE}/internal/{module}/handler/handler.go"
    if not os.path.exists(hpath):
        print(f"  SKIP: {hpath} not found")
        return 0
    with open(hpath) as f:
        content = f.read()
    original = content
    count = 0

    # --- Fix imports: add strconv, models ---
    if '"encoding/json"' not in content and 'gin.H' in content:
        pass  # keep as-is
    if '"strconv"' not in content:
        content = content.replace('"github.com/gin-gonic/gin"', '"strconv"\n\n\t"github.com/gin-gonic/gin"')
    mod_import = f'"orion/platform-svc-go/internal/{module}/models"'
    if mod_import not in content:
        # Insert after the service import
        svc_import = f'"orion/platform-svc-go/internal/{module}/service"'
        if svc_import in content:
            content = content.replace(svc_import, svc_import + "\n\t" + mod_import)

    # --- Fix response helpers: respondXXX -> errors.WriteXXX ---
    content = content.replace('respondInternalError(c,', 'errors.WriteError(c, 500,')
    content = content.replace('respondSuccess(c,', 'errors.WriteSuccess(c,')
    content = content.replace('respondCreated(c,', 'errors.WriteSuccess(c,')
    content = content.replace('respondBadRequest(c,', 'errors.WriteError(c, 400,')
    content = content.replace('respondNotFound(c,', 'errors.WriteError(c, 404,')

    # --- Fix service calls that pass wrong args ---
    # Each module's specific fixes
    fixes = {
        "ai-decision": {
            # List uses Query struct, not individual args
            r'result, err := h\.svc\.List\(ctx, tenantID, status, limit, offset\)':
                'q := models.ListDecisionsQuery{Status: status, Limit: limit, Offset: offset}\n\tresult, err := h.svc.List(ctx, tenantID, q)',
            # MakeDecision/CreateDecision - no models import issue, just fix imports above
        },
        "ai-review": {
            r'result, err := h\.svc\.List\(ctx, tenantID, status, limit, offset\)':
                'q := models.ListReviewsQuery{Status: status, Limit: limit, Offset: offset}\n\tresult, err := h.svc.List(ctx, tenantID, q)',
        },
        "escalation": {
            r'result, err := h\.svc\.ListRules\(ctx, tenantID, limit, offset\)':
                'q := models.ListRulesQuery{Limit: limit, Offset: offset}\n\tresult, err := h.svc.ListRules(ctx, tenantID, q)',
            r'result, err := h\.svc\.GetStats\(ctx, tenantID\)\n\tif err != nil \{\n\t\terrors\.WriteError\(c, 500, err\.Error\(\)\)\n\t\treturn\n\t\}\n\terrors\.WriteSuccess\(c, result\)':
                None,  # keep as-is
        },
        "mcp": {
            r'result, err := h\.svc\.ListServers\(ctx, tenantID, limit, offset\)':
                'q := models.ListMCPServersQuery{Limit: limit, Offset: offset}\n\tresult, err := h.svc.ListServers(ctx, tenantID, q)',
            r'result, err := h\.svc\.ListTools\(ctx, limit, offset\)':
                'q := models.ListMCPToolsQuery{Limit: limit, Offset: offset}\n\tresult, err := h.svc.ListTools(ctx, q)',
        },
        "terminal-audit": {
            r'result, err := h\.svc\.ListAudits\(ctx, tenantID, limit, offset\)':
                'q := models.AuditQuery{Limit: limit, Offset: offset}\n\tresult, err := h.svc.ListAudits(ctx, tenantID, q)',
            r'result, err := h\.svc\.SearchAudits\(ctx, tenantID, limit, offset\)':
                'q := models.AuditQuery{Limit: limit, Offset: offset}\n\tresult, err := h.svc.SearchAudits(ctx, tenantID, q)',
        },
        "sso": {
            r'result, total, err := h\.svc\.ListProviders\(ctx, tenantID, limit, offset\)':
                'q := models.ListProvidersQuery{Limit: limit, Offset: offset}\n\tresult, total, err := h.svc.ListProviders(ctx, tenantID, q)',
        },
    }

    for old, new in fixes.get(module, {}).items():
        if new and old in content:
            content = content.replace(old, new)

    if content != original:
        with open(hpath, 'w') as f:
            f.write(content)
        count = 1

    return count


def main():
    modules = [
        "ai-agent", "ai-decision", "ai-review", "escalation",
        "ephemeral-env", "vector", "artifact-lifecycle", "mcp",
        "terminal-audit", "sso",
    ]
    for m in modules:
        print(f"Fixing {m}...")
        fix_module(m)

    print("\nDone. Run 'go build ./cmd/server/' to check.")

if __name__ == "__main__":
    main()
