#!/usr/bin/env python3
"""
Rewrite the 10 stub handlers using c.JSON directly.
Each handler uses: c.JSON(http.StatusOK, data) / c.JSON(http.StatusInternalServerError, ...) / etc.
"""
import os
import re
import sys

BASE = "/Users/heal/orion-design/orion-platform-svc-go"

# Service call signatures per module
# handler_name -> (svc_method, args_list, body_model, resp_status, resp_data, special)
# args_list: list of arg expressions (strings)
# body_model: None or "ModelName" (creates var req models.ModelName)
# resp_status: "200" | "201" | "204"
# resp_data: "result" | "result+total" | "nil" | None
# special: extra body lines

MODULE_CONFIG = {
    "ai-agent": {
        "GetAgent": {
            "svc": "Get",
            "args": ["ctx", "tenantID", "c.Param(\"id\")"],
            "body": None,
            "resp": ("200", "result"),
        },
        "ListAgents": {
            "svc": "List",
            "args": ["ctx", "tenantID",
                     "models.ListAgentsQuery{Status: c.Query(\"status\"), Limit: limit, Offset: offset}"],
            "query_params": "limit, _ := strconv.Atoi(c.DefaultQuery(\"limit\", \"50\"))\n\toffset, _ := strconv.Atoi(c.DefaultQuery(\"offset\", \"0\"))",
            "body": None,
            "resp": ("200", "result"),
        },
        "CreateAgent": {
            "svc": "Create",
            "args": ["ctx", "tenantID", "req"],
            "body": "CreateAgentRequest",
            "resp": ("201", "result"),
        },
        "UpdateAgent": {
            "svc": "Update",
            "args": ["ctx", "tenantID", "c.Param(\"id\")", "req"],
            "body": "UpdateAgentRequest",
            "resp": ("200", "result"),
        },
        "DeleteAgent": {
            "svc": "Delete",
            "args": ["ctx", "tenantID", "c.Param(\"id\")"],
            "body": None,
            "resp": ("204", None),
        },
        "RunAgent": {
            "svc": "Run",
            "args": ["ctx", "tenantID", "c.Param(\"id\")", "req"],
            "body": "RunAgentRequest",
            "resp": ("201", "result"),
        },
        "ListRuns": {
            "svc": "ListRuns",
            "args": ["ctx", "tenantID", "c.Param(\"id\")",
                     "limit", "offset"],
            "query_params": "limit, _ := strconv.Atoi(c.DefaultQuery(\"limit\", \"50\"))\n\toffset, _ := strconv.Atoi(c.DefaultQuery(\"offset\", \"0\"))",
            "body": None,
            "resp": ("200", "result"),
        },
    },
    "ai-decision": {
        "GetDecision": {
            "svc": "Get",
            "args": ["ctx", "tenantID", "c.Param(\"id\")"],
            "body": None,
            "resp": ("200", "result"),
        },
        "ListDecisions": {
            "svc": "List",
            "args": ["ctx", "tenantID",
                     "models.ListDecisionsQuery{Status: c.Query(\"status\"), Limit: limit, Offset: offset}"],
            "query_params": "limit, _ := strconv.Atoi(c.DefaultQuery(\"limit\", \"50\"))\n\toffset, _ := strconv.Atoi(c.DefaultQuery(\"offset\", \"0\"))",
            "body": None,
            "resp": ("200", "result"),
        },
        "MakeDecision": {
            "svc": "MakeDecision",
            "args": ["ctx", "tenantID", "req"],
            "body": "MakeDecisionRequest",
            "resp": ("201", "result"),
        },
        "OverrideDecision": {
            "svc": "OverrideDecision",
            "args": ["ctx", "tenantID", "c.Param(\"id\")", "req"],
            "body": "OverrideDecisionRequest",
            "resp": ("200", "result"),
        },
        "GetDecisionStats": {
            "svc": "GetStats",
            "args": ["ctx", "tenantID"],
            "body": None,
            "resp": ("200", "result"),
        },
    },
    "ai-review": {
        "CreateReview": {
            "svc": "Create",
            "args": ["ctx", "tenantID", "req"],
            "body": "CreateReviewRequest",
            "resp": ("201", "result"),
        },
        "GetReview": {
            "svc": "Get",
            "args": ["ctx", "tenantID", "c.Param(\"id\")"],
            "body": None,
            "resp": ("200", "result"),
        },
        "ListReviews": {
            "svc": "List",
            "args": ["ctx", "tenantID",
                     "models.ListReviewsQuery{Status: c.Query(\"status\"), Limit: limit, Offset: offset}"],
            "query_params": "limit, _ := strconv.Atoi(c.DefaultQuery(\"limit\", \"50\"))\n\toffset, _ := strconv.Atoi(c.DefaultQuery(\"offset\", \"0\"))",
            "body": None,
            "resp": ("200", "result"),
        },
        "ApproveReview": {
            "svc": "Approve",
            "args": ["ctx", "tenantID", "c.Param(\"id\")"],
            "body": None,
            "resp": ("200", "result"),
        },
        "RejectReview": {
            "svc": "Reject",
            "args": ["ctx", "tenantID", "c.Param(\"id\")"],
            "body": None,
            "resp": ("200", "result"),
        },
    },
    "escalation": {
        "CreateRule": {
            "svc": "CreateRule",
            "args": ["ctx", "tenantID", "req"],
            "body": "TriggerRequest",
            "resp": ("201", "result"),
        },
        "GetRule": {
            "svc": "GetRule",
            "args": ["ctx", "tenantID", "c.Param(\"id\")"],
            "body": None,
            "resp": ("200", "result"),
        },
        "ListRules": {
            "svc": "ListRules",
            "args": ["ctx", "tenantID",
                     "models.ListRulesQuery{Limit: limit, Offset: offset}"],
            "query_params": "limit, _ := strconv.Atoi(c.DefaultQuery(\"limit\", \"50\"))\n\toffset, _ := strconv.Atoi(c.DefaultQuery(\"offset\", \"0\"))",
            "body": None,
            "resp": ("200", "result"),
        },
        "UpdateRule": {
            "svc": "UpdateRule",
            "args": ["ctx", "tenantID", "c.Param(\"id\")", "req"],
            "body": "TriggerRequest",
            "resp": ("200", "result"),
        },
        "DeleteRule": {
            "svc": "DeleteRule",
            "args": ["ctx", "tenantID", "c.Param(\"id\")"],
            "body": None,
            "resp": ("204", None),
        },
        "TriggerRule": {
            "svc": "TriggerRule",
            "args": ["ctx", "tenantID", "c.Param(\"id\")", "req"],
            "body": "TriggerRequest",
            "resp": ("200", "result"),
        },
        "GetStats": {
            "svc": "GetStats",
            "args": ["ctx", "tenantID"],
            "body": None,
            "resp": ("200", "result"),
        },
    },
    "ephemeral-env": {
        "CreateEnv": {
            "svc": "CreateEnv",
            "args": ["ctx", "tenantID", "req"],
            "body": "CreateEphemeralEnvRequest",
            "resp": ("201", "result"),
        },
        "GetEnv": {
            "svc": "GetEnv",
            "args": ["ctx", "tenantID", "c.Param(\"id\")"],
            "body": None,
            "resp": ("200", "result"),
        },
        "ListEnvs": {
            "svc": "ListEnvs",
            "args": ["ctx", "tenantID", "limit", "offset"],
            "query_params": "limit, _ := strconv.Atoi(c.DefaultQuery(\"limit\", \"50\"))\n\toffset, _ := strconv.Atoi(c.DefaultQuery(\"offset\", \"0\"))",
            "body": None,
            "resp": ("200", "result"),
        },
        "ExtendTTL": {
            "svc": "ExtendTTL",
            "args": ["ctx", "tenantID", "c.Param(\"id\")", "req"],
            "body": "ExtendTTLRequest",
            "resp": ("200", "result"),
        },
        "DeleteEnv": {
            "svc": "DeleteEnv",
            "args": ["ctx", "tenantID", "c.Param(\"id\")"],
            "body": None,
            "resp": ("204", None),
        },
        "GetLogs": {
            "svc": "GetLogs",
            "args": ["ctx", "tenantID", "c.Param(\"id\")", "limit"],
            "query_params": "limit, _ := strconv.Atoi(c.DefaultQuery(\"limit\", \"100\"))",
            "body": None,
            "resp": ("200", "result"),
        },
        "DestroyEnv": {
            "svc": "DestroyEnv",
            "args": ["ctx", "tenantID", "c.Param(\"id\")"],
            "body": None,
            "resp": ("200", "result"),
        },
    },
    "vector": {
        "CreateStore": {
            "svc": "CreateStore",
            "args": ["ctx", "tenantID", "req"],
            "body": "CreateStoreRequest",
            "resp": ("201", "result"),
        },
        "GetStore": {
            "svc": "GetStore",
            "args": ["ctx", "tenantID", "c.Param(\"id\")"],
            "body": None,
            "resp": ("200", "result"),
        },
        "ListStores": {
            "svc": "ListStores",
            "args": ["ctx", "tenantID", "limit", "offset"],
            "query_params": "limit, _ := strconv.Atoi(c.DefaultQuery(\"limit\", \"50\"))\n\toffset, _ := strconv.Atoi(c.DefaultQuery(\"offset\", \"0\"))",
            "body": None,
            "resp": ("200", "result"),
        },
        "DeleteStore": {
            "svc": "DeleteStore",
            "args": ["ctx", "tenantID", "c.Param(\"id\")"],
            "body": None,
            "resp": ("204", None),
        },
        "UpsertVectors": {
            "svc": "UpsertVectors",
            "args": ["ctx", "tenantID", "c.Param(\"id\")", "req"],
            "body": "UpsertVectorsRequest",
            "resp": ("200", "result"),
        },
        "SearchVectors": {
            "svc": "SearchVectors",
            "args": ["ctx", "tenantID", "c.Param(\"id\")", "req"],
            "body": "SearchQuery",
            "resp": ("200", "result"),
        },
        "DeleteVectors": {
            "svc": "DeleteVectors",
            "args": ["ctx", "tenantID", "c.Param(\"id\")", "ids"],
            "bind_body": "ids []string",
            "resp": ("200", "result"),
        },
    },
    "artifact-lifecycle": {
        "CreateLifecycle": {
            "svc": "Create",
            "args": ["ctx", "tenantID", "req"],
            "body": "CreateArtifactLifecycleRequest",
            "resp": ("201", "result"),
        },
        "GetLifecycle": {
            "svc": "GetByArtifactID",
            "args": ["ctx", "tenantID", "c.Param(\"artifactId\")"],
            "body": None,
            "resp": ("200", "result"),
        },
        "ListLifecycle": {
            "svc": "List",
            "args": ["ctx", "tenantID", "limit", "offset"],
            "query_params": "limit, _ := strconv.Atoi(c.DefaultQuery(\"limit\", \"50\"))\n\toffset, _ := strconv.Atoi(c.DefaultQuery(\"offset\", \"0\"))",
            "body": None,
            "resp": ("200", "result"),
        },
        "AdvanceStage": {
            "svc": "AdvanceStage",
            "args": ["ctx", "tenantID", "c.Param(\"id\")", "req"],
            "body": "AdvanceStageRequest",
            "resp": ("200", "result"),
        },
        "DeleteLifecycle": {
            "svc": "Delete",
            "args": ["ctx", "tenantID", "c.Param(\"id\")"],
            "body": None,
            "resp": ("204", None),
        },
        "GetStageHistory": {
            "svc": "GetStageHistory",
            "args": ["ctx", "tenantID", "c.Query(\"artifactId\")"],
            "body": None,
            "resp": ("200", "result"),
        },
        "ArchiveArtifact": {
            "svc": "Archive",
            "args": ["ctx", "tenantID", "c.Param(\"id\")"],
            "body": None,
            "resp": ("200", "result"),
        },
    },
    "mcp": {
        "CreateServer": {
            "svc": "CreateServer",
            "args": ["ctx", "tenantID", "req"],
            "body": "CreateMCPServerRequest",
            "resp": ("201", "result"),
        },
        "GetServer": {
            "svc": "GetServer",
            "args": ["ctx", "tenantID", "c.Param(\"id\")"],
            "body": None,
            "resp": ("200", "result"),
        },
        "ListServers": {
            "svc": "ListServers",
            "args": ["ctx", "tenantID",
                     "models.ListMCPServersQuery{Limit: limit, Offset: offset}"],
            "query_params": "limit, _ := strconv.Atoi(c.DefaultQuery(\"limit\", \"50\"))\n\toffset, _ := strconv.Atoi(c.DefaultQuery(\"offset\", \"0\"))",
            "body": None,
            "resp": ("200", "result"),
        },
        "UpdateServer": {
            "svc": "UpdateServer",
            "args": ["ctx", "tenantID", "c.Param(\"id\")", "req"],
            "body": "UpdateMCPServerRequest",
            "resp": ("200", "result"),
        },
        "DeleteServer": {
            "svc": "DeleteServer",
            "args": ["ctx", "tenantID", "c.Param(\"id\")"],
            "body": None,
            "resp": ("204", None),
        },
        "ListTools": {
            "svc": "ListTools",
            "args": ["ctx",
                     "models.ListMCPToolsQuery{Limit: limit, Offset: offset}"],
            "query_params": "limit, _ := strconv.Atoi(c.DefaultQuery(\"limit\", \"50\"))\n\toffset, _ := strconv.Atoi(c.DefaultQuery(\"offset\", \"0\"))",
            "no_tenant": True,
            "body": None,
            "resp": ("200", "result"),
        },
    },
    "terminal-audit": {
        "ListAudits": {
            "svc": "ListAudits",
            "args": ["ctx", "tenantID",
                     "models.AuditQuery{Limit: limit, Offset: offset}"],
            "query_params": "limit, _ := strconv.Atoi(c.DefaultQuery(\"limit\", \"50\"))\n\toffset, _ := strconv.Atoi(c.DefaultQuery(\"offset\", \"0\"))",
            "body": None,
            "resp": ("200", "result"),
        },
        "GetAudit": {
            "svc": "GetAudit",
            "args": ["ctx", "tenantID", "c.Param(\"id\")"],
            "body": None,
            "resp": ("200", "result"),
        },
        "DeleteBatch": {
            "svc": "DeleteBatch",
            "args": ["ctx", "tenantID", "ids"],
            "bind_body": "ids []string",
            "resp": ("200", "result"),
        },
        "SearchAudits": {
            "svc": "SearchAudits",
            "args": ["ctx", "tenantID",
                     "models.AuditQuery{Limit: limit, Offset: offset}"],
            "query_params": "limit, _ := strconv.Atoi(c.DefaultQuery(\"limit\", \"50\"))\n\toffset, _ := strconv.Atoi(c.DefaultQuery(\"offset\", \"0\"))",
            "body": None,
            "resp": ("200", "result"),
        },
        "GetStats": {
            "svc": "GetStats",
            "args": ["ctx", "tenantID"],
            "body": None,
            "resp": ("200", "result"),
        },
    },
    "sso": {
        "CreateProvider": {
            "svc": "CreateProvider",
            "args": ["ctx", "tenantID", "req"],
            "body": "SSOProvider",
            "resp": ("201", "result"),
        },
        "GetProvider": {
            "svc": "GetProvider",
            "args": ["ctx", "tenantID", "c.Param(\"id\")"],
            "body": None,
            "resp": ("200", "result"),
        },
        "ListProviders": {
            "svc": "ListProviders",
            "args": ["ctx", "tenantID",
                     "models.ListProvidersQuery{Limit: limit, Offset: offset}"],
            "query_params": "limit, _ := strconv.Atoi(c.DefaultQuery(\"limit\", \"50\"))\n\toffset, _ := strconv.Atoi(c.DefaultQuery(\"offset\", \"0\"))",
            "body": None,
            "resp": ("200", "gin.H{\"items\": result, \"total\": total}", "triple_return"),
        },
        "UpdateProvider": {
            "svc": "UpdateProvider",
            "args": ["ctx", "tenantID", "c.Param(\"id\")", "updates"],
            "bind_body": "updates map[string]interface{}",
            "resp": ("204", None),
        },
        "InitiateLogin": {
            "svc": "InitiateLogin",
            "args": ["ctx", "tenantID", "req"],
            "body": "SSOLoginRequest",
            "pointer": True,
            "resp": ("200", "result"),
        },
        "HandleCallback": {
            "svc": "HandleCallback",
            "args": ["ctx", "tenantID", "c.Param(\"id\")", "c.Query(\"state\")", "c.Query(\"userID\")"],
            "body": None,
            "resp": ("200", "result"),
        },
    },
}


def build_handler_code(name: str, cfg: dict) -> str:
    svc = cfg["svc"]
    args = cfg["args"]
    body = cfg.get("body")
    query_params = cfg.get("query_params")
    bind_body = cfg.get("bind_body")
    status, resp_data = cfg["resp"]
    pointer = cfg.get("pointer")

    lines = []
    lines.append(f"func (h *Handler) {name}(c *gin.Context) {{")
    lines.append("\tctx := c.Request.Context()")
    lines.append("\ttenantID := c.GetString(\"tenant_id\")")
    lines.append("")

    # Query params
    if query_params:
        lines.append(f"\t{query_params}")
        lines.append("")

    # Body binding
    if body:
        if pointer:
            lines.append(f"\treq := &models.{body}{{}}")
        else:
            lines.append(f"\tvar req models.{body}")
        lines.append(f"\tif err := c.ShouldBindJSON(&req); err != nil {{")
        lines.append("\t\tc.JSON(http.StatusBadRequest, gin.H{\"error\": err.Error()})")
        lines.append("\t\treturn")
        lines.append("\t}")
        lines.append("")
    elif bind_body:
        lines.append(f"\tvar {bind_body}")
        lines.append(f"\tif err := c.ShouldBindJSON(&{bind_body.split()[0]}); err != nil {{")
        lines.append("\t\tc.JSON(http.StatusBadRequest, gin.H{\"error\": err.Error()})")
        lines.append("\t\treturn")
        lines.append("\t}")
        lines.append("")

    # Service call
    call_args = ", ".join(args)
    svc_call = f"h.svc.{svc}({call_args})"

    # Result vars
    if resp_data == "triple_return":
        result_line = f"result, total, err := {svc_call}"
    else:
        result_line = f"result, err := {svc_call}"

    lines.append(f"\t{result_line}")
    lines.append("\tif err != nil {")
    lines.append("\t\tc.JSON(http.StatusInternalServerError, gin.H{\"error\": err.Error()})")
    lines.append("\t\treturn")
    lines.append("\t}")
    lines.append("")

    # Response
    if resp_data is None or resp_data == "nil":
        lines.append("\tc.JSON(http.StatusNoContent, nil)")
    elif resp_data == "triple_return":
        lines.append('\tc.JSON(http.StatusOK, gin.H{"items": result, "total": total})')
    else:
        lines.append(f"\tc.JSON(http.StatusOK, {resp_data})")

    lines.append("}")
    return "\n".join(lines)


def fix_file(module: str, config: dict):
    fpath = f"{BASE}/internal/{module}/handler/handler.go"
    if not os.path.exists(fpath):
        print(f"  SKIP {module}: no file")
        return
    with open(fpath) as f:
        content = f.read()

    # Fix imports block
    # Target: context, net/http, auth, service, models, strconv, gin
    target_imports = f'''\t"context"
\t"net/http"

\t"orion/go-common/pkg/auth"
\t"orion/platform-svc-go/internal/{module}/models"
\t"orion/platform-svc-go/internal/{module}/service"

\t"strconv"

\t"github.com/gin-gonic/gin"
'''
    # Replace import block
    new_content, _ = re.subn(
        r'import \(\n.*?\n\)',
        'import (\n' + target_imports + ')',
        content,
        flags=re.DOTALL,
    )
    if new_content == content:
        # Fallback: just prepend
        print(f"  WARN {module}: could not match import block")
        return
    content = new_content

    # Replace each handler function
    for handler_name, cfg in config.items():
        new_code = build_handler_code(handler_name, cfg)
        # Match the function (possibly broken)
        pattern = re.escape(f'func (h *Handler) {handler_name}(c *gin.Context)')
        m = re.search(pattern, content)
        if not m:
            print(f"  WARN {module}/{handler_name}: not found")
            continue
        start = m.start()
        # Find opening brace
        brace = content.find('{', start)
        # Find matching closing brace
        depth = 0
        i = brace
        while i < len(content):
            if content[i] == '{':
                depth += 1
            elif content[i] == '}':
                depth -= 1
                if depth == 0:
                    break
            i += 1
        # Replace [start, i+1) with new_code
        content = content[:start] + new_code + "\n\n" + content[i+1:]

    with open(fpath, 'w') as f:
        f.write(content)


def main():
    for module, handlers in MODULE_CONFIG.items():
        print(f"Fixing {module} ({len(handlers)} handlers)...")
        fix_file(module, handlers)

    print("\nDone. Run 'go build ./cmd/server/' to verify.")

if __name__ == "__main__":
    main()
