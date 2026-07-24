#!/usr/bin/env python3
"""
Generate real handler implementations from stub handlers.

Strategy:
1. Parse each handler file to find stub methods (return WriteSuccess with "X called")
2. Parse RegisterRoutes to map route patterns → handler methods
3. Parse service/service.go to get method signatures
4. Parse models/models.go to find Request/Query structs
5. Generate real handler methods that call h.svc.X

Each handler follows one of several patterns:
- Simple CRUD: List/Get/Create/Update/Delete
- Action: POST/:id/<action> calling service.<Action>(ctx, tenantID, id, req)
- Stats: GET /stats calling service.GetStats(ctx, tenantID)
- Query with params: GET /?limit=10&offset=0 calling service.List(ctx, tenantID, limit, offset)

The generator produces the handler method body for each stub.
"""

import re
import os
import sys
from dataclasses import dataclass, field
from typing import Optional

# ---- Data structures ----

@dataclass
class ServiceMethod:
    name: str           # e.g. "Create"
    signature: str      # full "func (s *Service) ..." line
    params: list        # param names after ctx, tenantID
    returns_error: bool
    return_single: bool  # returns (*models.X, error) vs ([]models.X, error) vs (error)

@dataclass
class Route:
    method: str         # GET/POST/PUT/DELETE/PATCH
    path: str           # "", "/:id", "/:id/run", "/stats"
    handler: str        # h.ListAgents, h.CreateAgent, etc.

@dataclass
class StubMethod:
    name: str           # e.g. "GetAgent"
    route: Optional[Route]  # mapped route
    service_method: Optional[ServiceMethod]  # mapped service method

# ---- Parsing ----

def parse_service_methods(content: str) -> list[ServiceMethod]:
    methods = []
    # Match "func (s *Service) Name(ctx context.Context, tenantID string, ...) (*models.X, error) {"
    pattern = r'^func \(s \*Service\) (\w+)\(([^)]+)\)\s+(\(([^)]+)\))?\s*\{'
    for m in re.finditer(pattern, content, re.MULTILINE):
        name = m.group(1)
        params_str = m.group(2)
        returns = m.group(4) if m.group(4) else ""

        # Parse param list (skip ctx, tenantID)
        params = [p.strip() for p in params_str.split(",")]
        # Remove ctx and tenantID
        param_names = []
        for p in params:
            parts = p.split()
            if len(parts) >= 1:
                param_names.append(parts[0])
        param_names = [p for p in param_names if p not in ("ctx", "tenantID")]

        returns_error = "error" in returns
        return_single = re.search(r'\*models\.', returns) is not None

        methods.append(ServiceMethod(
            name=name,
            signature=m.group(0),
            params=param_names,
            returns_error=returns_error,
            return_single=return_single,
        ))
    return methods


def parse_routes(content: str) -> list[Route]:
    routes = []
    # Match r.GET("...", ..., h.HandlerName) etc.
    pattern = r'\b(r\.(GET|POST|PUT|DELETE|PATCH))\((["\'])(.*?)\3,([^)]+)\),\s*(h\.\w+)\)'
    for m in re.finditer(pattern, content):
        method = m.group(2)
        path = m.group(4)
        handler = m.group(5)
        routes.append(Route(method=method, path=path, handler=handler))
    return routes


def parse_request_models(content: str) -> set[str]:
    """Return names of *Request and *Query structs."""
    models = set()
    for m in re.finditer(r'^type (\w+(?:Request|Query)) struct\b', content, re.MULTILINE):
        models.add(m.group(1))
    return models


def find_stub_methods(handler_content: str) -> list[StubMethod]:
    """Find all stub handler methods and try to match them to service methods."""
    stubs = []

    # Find all handler function bodies
    func_pattern = r'func \(h \*Handler\) (\w+)\(c \*gin\.Context\)\s*\{'
    for fm in re.finditer(func_pattern, handler_content):
        method_name = fm.group(1)
        # Skip non-handler methods
        if method_name.lower() in ("getctx", "gettenant"):
            continue
        # Check if it's a stub
        start = fm.end()
        # Find closing brace (simple counting)
        brace_count = 1
        i = start
        while i < len(handler_content) and brace_count > 0:
            if handler_content[i] == '{':
                brace_count += 1
            elif handler_content[i] == '}':
                brace_count -= 1
            i += 1
        body = handler_content[start:i-1]

        if re.search(r'WriteSuccess\(c,\s*gin\.H\{"message":\s*"', body):
            stubs.append(StubMethod(name=method_name, route=None, service_method=None))

    return stubs


# ---- Mapping: handler method name -> service method ----

# Convention: handler CreateAgent -> service Create
#             handler GetAgent    -> service Get
#             handler ListAgents  -> service List
#             handler UpdateAgent -> service Update
#             handler DeleteAgent -> service Delete
#             handler RunAgent    -> service Run
#             handler ListRuns    -> service ListRuns
#             handler MakeDecision -> service MakeDecision
#             handler OverrideDecision -> service OverrideDecision
#             handler GetDecisionStats -> service GetStats
#             handler ApproveReview -> service Approve
#             handler RejectReview -> service Reject
#             handler CreateRule -> service CreateRule
#             handler CreateEnv -> service CreateEnv
#             handler ListEnvs -> service ListEnvs
#             handler ExtendTTL -> service ExtendTTL
#             handler DeleteEnv -> service DeleteEnv
#             handler GetLogs -> service GetLogs
#             handler DestroyEnv -> service DestroyEnv
#             handler CreateStore -> service CreateStore
#             handler CreateLifecycle -> service Create
#             handler ListLifecycle -> service List
#             handler DeleteLifecycle -> service Delete
#             handler GetLifecycle -> service GetByID or GetByArtifactID
#             handler AdvanceStage -> service AdvanceStage
#             handler GetStageHistory -> service GetStageHistory
#             handler ArchiveArtifact -> service Archive
#             handler ListAudits -> service ListAudits
#             handler GetAudit -> service GetAudit
#             handler DeleteBatch -> service DeleteBatch
#             handler SearchAudits -> service SearchAudits
#             handler GetStats -> service GetStats
#             handler ListServers -> service ListServers
#             handler GetServer -> service GetServer
#             handler CreateServer -> service CreateServer
#             handler UpdateServer -> service UpdateServer
#             handler DeleteServer -> service DeleteServer
#             handler ListTools -> service ListTools
#             handler CreateProvider -> service CreateProvider
#             handler GetProvider -> service GetProvider
#             handler UpdateProvider -> service UpdateProvider
#             handler ListProviders -> service ListProviders
#             handler InitiateLogin -> service InitiateLogin
#             handler HandleCallback -> service HandleCallback

def map_handler_to_service(handler_name: str) -> str:
    """Map handler method name to service method name."""
    # Special cases
    special = {
        "CreateLifecycle": "Create",
        "DeleteLifecycle": "Delete",
        "GetLifecycle": "GetByID",
        "ListLifecycle": "List",
        "ListAgents": "List",
        "GetAgent": "Get",
        "CreateAgent": "Create",
        "UpdateAgent": "Update",
        "DeleteAgent": "Delete",
        "RunAgent": "Run",
        "ListRuns": "ListRuns",
        "MakeDecision": "MakeDecision",
        "OverrideDecision": "OverrideDecision",
        "GetDecision": "Get",
        "ListDecisions": "List",
        "GetDecisionStats": "GetStats",
        "CreateReview": "Create",
        "GetReview": "Get",
        "ListReviews": "List",
        "ApproveReview": "Approve",
        "RejectReview": "Reject",
        "CreateRule": "CreateRule",
        "UpdateRule": "UpdateRule",
        "DeleteRule": "DeleteRule",
        "GetRule": "GetRule",
        "ListRules": "ListRules",
        "TriggerRule": "TriggerRule",
        "GetStats": "GetStats",
        "CreateEnv": "CreateEnv",
        "GetEnv": "GetEnv",
        "ListEnvs": "ListEnvs",
        "ExtendTTL": "ExtendTTL",
        "DeleteEnv": "DeleteEnv",
        "GetLogs": "GetLogs",
        "DestroyEnv": "DestroyEnv",
        "CreateStore": "CreateStore",
        "GetStore": "GetStore",
        "ListStores": "ListStores",
        "DeleteStore": "DeleteStore",
        "UpsertVectors": "UpsertVectors",
        "SearchVectors": "SearchVectors",
        "DeleteVectors": "DeleteVectors",
        "AdvanceStage": "AdvanceStage",
        "GetStageHistory": "GetStageHistory",
        "ArchiveArtifact": "Archive",
        "CreateServer": "CreateServer",
        "GetServer": "GetServer",
        "ListServers": "ListServers",
        "UpdateServer": "UpdateServer",
        "DeleteServer": "DeleteServer",
        "ListTools": "ListTools",
        "ListAudits": "ListAudits",
        "GetAudit": "GetAudit",
        "DeleteBatch": "DeleteBatch",
        "SearchAudits": "SearchAudits",
        "CreateProvider": "CreateProvider",
        "GetProvider": "GetProvider",
        "UpdateProvider": "UpdateProvider",
        "ListProviders": "ListProviders",
        "InitiateLogin": "InitiateLogin",
        "HandleCallback": "HandleCallback",
    }
    return special.get(handler_name, "")


# ---- Code Generation ----

# Mapping from service method to handler pattern
# Each pattern specifies:
#   - service call template
#   - param extraction from route/query/body
#   - response handler

# Pattern definitions
class HandlerPattern:
    def __init__(self, svc_call_template, param_bindings, response_template, extra_params=None):
        self.svc_call_template = svc_call_template
        self.param_bindings = param_bindings  # list of (name, source, default)
        self.response_template = response_template  # "respondSuccess", "respondCreated", "respondNotFound", "c.Status(204)"
        self.extra_params = extra_params or []

    def generate(self, handler_name: str, service_name: str, route: Route, model_package: str) -> str:
        ctx = "c.Request.Context()"
        tenant = "tenantID := c.GetString(\"tenant_id\")"

        lines = []
        lines.append(f"func (h *Handler) {handler_name}(c *gin.Context) {{")
        lines.append(tenant)

        # Extract params based on route
        svc_call_parts = ["h.svc." + service_name]
        svc_call_parts.append(f"({ctx}")
        svc_call_parts.append(f", tenantID")

        # Bind params from route/query/body
        for name, source, default in self.param_bindings:
            if source == "param":
                param_name = name.replace("ID", "").replace("id", "").replace("Id", "").lower()
                # Try common param names
                param_map = {
                    "id": "id",
                    "agentid": "id",
                    "agent": "id",
                    "ruleid": "id",
                    "rule": "id",
                    "env": "id",
                    "envId": "id",
                    "storeid": "id",
                    "store": "id",
                    "serverid": "id",
                    "server": "id",
                    "providerid": "id",
                    "provider": "id",
                    "auditid": "id",
                    "audit": "id",
                    "reviewid": "id",
                    "review": "id",
                    "decisionid": "id",
                    "decision": "id",
                    "artifactid": "id",
                }
                gin_param = param_map.get(param_name, param_name)
                lines.append(f"{name} := c.Param(\"{gin_param}\")")
                svc_call_parts.append(f", {name}")
            elif source == "query":
                lines.append(f"{name} := c.Query(\"{name}\")")
                if default:
                    lines.append(f"if {name} == \"\" {{ {name} = \"{default}\" }}")
                svc_call_parts.append(f", {name}")
            elif source == "body":
                req_type = self.extra_params.get("req_type", f"{handler_name}Request")
                if req_type.startswith("models."):
                    req_type_simple = req_type[len("models."):]
                else:
                    req_type_simple = req_type
                lines.append(f"var req models.{req_type_simple}")
                lines.append(f"if err := c.ShouldBindJSON(&req); err != nil {{")
                lines.append(f"\trespondBadRequest(c, err.Error())")
                lines.append(f"\treturn")
                lines.append(f"}}")
                svc_call_parts.append(f", req")
            elif source == "const":
                svc_call_parts.append(default)

        # Build service call
        svc_call = ", ".join(svc_call_parts)
        svc_call += ")"

        # Determine return variables
        returns = self.extra_params.get("returns", "result")
        lines.append(f"{returns}, err := {svc_call}")
        lines.append(f"if err != nil {{")
        lines.append(f"\trespondInternalError(c, err.Error())")
        lines.append(f"\treturn")
        lines.append(f"}}")

        # Response
        resp_type = self.extra_params.get("resp_type", "success")
        if resp_type == "no_content":
            lines.append(f"c.Status(204)")
            lines.append(f"return")
        elif resp_type == "created":
            lines.append(f"respondCreated(c, {returns})")
        else:
            lines.append(f"respondSuccess(c, {returns})")

        lines.append("}")
        return "\n".join(lines)


# ---- Module-specific handler generation ----
# Define mappings for each module

MODULES = {
    "ai-agent": {
        "model_package": "models",
        "handlers": {
            "CreateAgent": {
                "svc": "Create",
                "params": [],
                "body_type": "CreateAgentRequest",
                "resp": "created",
            },
            "GetAgent": {
                "svc": "Get",
                "params": [("id", "param", None)],
                "body_type": None,
                "resp": "success",
            },
            "ListAgents": {
                "svc": "List",
                "params": [("status", "query", None), ("limit", "query", "50"), ("offset", "query", "0")],
                "body_type": None,
                "resp": "success",
            },
            "UpdateAgent": {
                "svc": "Update",
                "params": [("id", "param", None)],
                "body_type": "UpdateAgentRequest",
                "resp": "success",
            },
            "DeleteAgent": {
                "svc": "Delete",
                "params": [("id", "param", None)],
                "body_type": None,
                "resp": "no_content",
            },
            "RunAgent": {
                "svc": "Run",
                "params": [("agentID", "param", None)],
                "body_type": "RunAgentRequest",
                "resp": "created",
            },
            "ListRuns": {
                "svc": "ListRuns",
                "params": [("agentID", "param", None), ("limit", "query", "50"), ("offset", "query", "0")],
                "body_type": None,
                "resp": "success",
            },
        },
    },
    "ai-decision": {
        "model_package": "models",
        "handlers": {
            "GetDecision": {
                "svc": "Get",
                "params": [("id", "param", None)],
                "body_type": None,
                "resp": "success",
            },
            "ListDecisions": {
                "svc": "List",
                "params": [("status", "query", None), ("limit", "query", "50"), ("offset", "query", "0")],
                "body_type": None,
                "resp": "success",
            },
            "MakeDecision": {
                "svc": "MakeDecision",
                "params": [],
                "body_type": "MakeDecisionRequest",
                "resp": "created",
            },
            "OverrideDecision": {
                "svc": "OverrideDecision",
                "params": [("id", "param", None)],
                "body_type": "OverrideDecisionRequest",
                "resp": "success",
            },
            "GetDecisionStats": {
                "svc": "GetStats",
                "params": [],
                "body_type": None,
                "resp": "success",
            },
        },
    },
    "ai-review": {
        "model_package": "models",
        "handlers": {
            "CreateReview": {
                "svc": "Create",
                "params": [],
                "body_type": "CreateReviewRequest",
                "resp": "created",
            },
            "GetReview": {
                "svc": "Get",
                "params": [("id", "param", None)],
                "body_type": None,
                "resp": "success",
            },
            "ListReviews": {
                "svc": "List",
                "params": [("status", "query", None), ("limit", "query", "50"), ("offset", "query", "0")],
                "body_type": None,
                "resp": "success",
            },
            "ApproveReview": {
                "svc": "Approve",
                "params": [("id", "param", None)],
                "body_type": None,
                "resp": "success",
            },
            "RejectReview": {
                "svc": "Reject",
                "params": [("id", "param", None)],
                "body_type": None,
                "resp": "success",
            },
        },
    },
    "escalation": {
        "model_package": "models",
        "handlers": {
            "CreateRule": {
                "svc": "CreateRule",
                "params": [],
                "body_type": "TriggerRequest",
                "resp": "created",
            },
            "GetRule": {
                "svc": "GetRule",
                "params": [("id", "param", None)],
                "body_type": None,
                "resp": "success",
            },
            "ListRules": {
                "svc": "ListRules",
                "params": [("limit", "query", "50"), ("offset", "query", "0")],
                "body_type": None,
                "resp": "success",
            },
            "UpdateRule": {
                "svc": "UpdateRule",
                "params": [("id", "param", None)],
                "body_type": "TriggerRequest",
                "resp": "success",
            },
            "DeleteRule": {
                "svc": "DeleteRule",
                "params": [("id", "param", None)],
                "body_type": None,
                "resp": "no_content",
            },
            "TriggerRule": {
                "svc": "TriggerRule",
                "params": [("id", "param", None)],
                "body_type": "TriggerRequest",
                "resp": "success",
            },
            "GetStats": {
                "svc": "GetStats",
                "params": [],
                "body_type": None,
                "resp": "success",
            },
        },
    },
    "ephemeral-env": {
        "model_package": "models",
        "handlers": {
            "CreateEnv": {
                "svc": "CreateEnv",
                "params": [],
                "body_type": "CreateEphemeralEnvRequest",
                "resp": "created",
            },
            "GetEnv": {
                "svc": "GetEnv",
                "params": [("id", "param", None)],
                "body_type": None,
                "resp": "success",
            },
            "ListEnvs": {
                "svc": "ListEnvs",
                "params": [("limit", "query", "50"), ("offset", "query", "0")],
                "body_type": None,
                "resp": "success",
            },
            "ExtendTTL": {
                "svc": "ExtendTTL",
                "params": [("id", "param", None)],
                "body_type": "ExtendTTLRequest",
                "resp": "success",
            },
            "DeleteEnv": {
                "svc": "DeleteEnv",
                "params": [("id", "param", None)],
                "body_type": None,
                "resp": "no_content",
            },
            "GetLogs": {
                "svc": "GetLogs",
                "params": [("envID", "param", None), ("limit", "query", "100")],
                "body_type": None,
                "resp": "success",
            },
            "DestroyEnv": {
                "svc": "DestroyEnv",
                "params": [("id", "param", None)],
                "body_type": None,
                "resp": "success",
            },
        },
    },
    "vector": {
        "model_package": "models",
        "handlers": {
            "CreateStore": {
                "svc": "CreateStore",
                "params": [],
                "body_type": "CreateStoreRequest",
                "resp": "created",
            },
            "GetStore": {
                "svc": "GetStore",
                "params": [("id", "param", None)],
                "body_type": None,
                "resp": "success",
            },
            "ListStores": {
                "svc": "ListStores",
                "params": [("limit", "query", "50"), ("offset", "query", "0")],
                "body_type": None,
                "resp": "success",
            },
            "DeleteStore": {
                "svc": "DeleteStore",
                "params": [("id", "param", None)],
                "body_type": None,
                "resp": "no_content",
            },
            "UpsertVectors": {
                "svc": "UpsertVectors",
                "params": [("storeID", "param", None)],
                "body_type": "UpsertVectorsRequest",
                "resp": "success",
            },
            "SearchVectors": {
                "svc": "SearchVectors",
                "params": [("storeID", "param", None)],
                "body_type": "SearchQuery",
                "resp": "success",
            },
            "DeleteVectors": {
                "svc": "DeleteVectors",
                "params": [("storeID", "param", None)],
                "body_type": None,
                "resp": "success",
            },
        },
    },
    "artifact-lifecycle": {
        "model_package": "models",
        "handlers": {
            "CreateLifecycle": {
                "svc": "Create",
                "params": [],
                "body_type": "CreateArtifactLifecycleRequest",
                "resp": "created",
            },
            "GetLifecycle": {
                "svc": "GetByArtifactID",
                "params": [("artifactID", "param", None)],
                "body_type": None,
                "resp": "success",
            },
            "ListLifecycle": {
                "svc": "List",
                "params": [("limit", "query", "50"), ("offset", "query", "0")],
                "body_type": None,
                "resp": "success",
            },
            "AdvanceStage": {
                "svc": "AdvanceStage",
                "params": [("id", "param", None)],
                "body_type": "AdvanceStageRequest",
                "resp": "success",
            },
            "DeleteLifecycle": {
                "svc": "Delete",
                "params": [("id", "param", None)],
                "body_type": None,
                "resp": "no_content",
            },
            "GetStageHistory": {
                "svc": "GetStageHistory",
                "params": [("artifactID", "param", None)],
                "body_type": None,
                "resp": "success",
            },
            "ArchiveArtifact": {
                "svc": "Archive",
                "params": [("id", "param", None)],
                "body_type": None,
                "resp": "success",
            },
        },
    },
    "mcp": {
        "model_package": "models",
        "handlers": {
            "CreateServer": {
                "svc": "CreateServer",
                "params": [],
                "body_type": "CreateMCPServerRequest",
                "resp": "created",
            },
            "GetServer": {
                "svc": "GetServer",
                "params": [("id", "param", None)],
                "body_type": None,
                "resp": "success",
            },
            "ListServers": {
                "svc": "ListServers",
                "params": [("limit", "query", "50"), ("offset", "query", "0")],
                "body_type": None,
                "resp": "success",
            },
            "UpdateServer": {
                "svc": "UpdateServer",
                "params": [("id", "param", None)],
                "body_type": "UpdateMCPServerRequest",
                "resp": "success",
            },
            "DeleteServer": {
                "svc": "DeleteServer",
                "params": [("id", "param", None)],
                "body_type": None,
                "resp": "no_content",
            },
            "ListTools": {
                "svc": "ListTools",
                "params": [("limit", "query", "50"), ("offset", "query", "0")],
                "body_type": None,
                "resp": "success",
            },
        },
    },
    "terminal-audit": {
        "model_package": "models",
        "handlers": {
            "ListAudits": {
                "svc": "ListAudits",
                "params": [("limit", "query", "50"), ("offset", "query", "0")],
                "body_type": None,
                "resp": "success",
            },
            "GetAudit": {
                "svc": "GetAudit",
                "params": [("id", "param", None)],
                "body_type": None,
                "resp": "success",
            },
            "DeleteBatch": {
                "svc": "DeleteBatch",
                "params": [],
                "body_type": "DeleteBatchRequest",
                "resp": "success",
            },
            "SearchAudits": {
                "svc": "SearchAudits",
                "params": [("limit", "query", "50"), ("offset", "query", "0")],
                "body_type": None,
                "resp": "success",
            },
            "GetStats": {
                "svc": "GetStats",
                "params": [],
                "body_type": None,
                "resp": "success",
            },
        },
    },
    "sso": {
        "model_package": "models",
        "handlers": {
            "CreateProvider": {
                "svc": "CreateProvider",
                "params": [],
                "body_type": "SSOProvider",
                "resp": "created",
                "special_body": True,
            },
            "GetProvider": {
                "svc": "GetProvider",
                "params": [("id", "param", None)],
                "body_type": None,
                "resp": "success",
            },
            "ListProviders": {
                "svc": "ListProviders",
                "params": [("limit", "query", "50"), ("offset", "query", "0")],
                "body_type": None,
                "resp": "success",
                "special_return": True,
            },
            "UpdateProvider": {
                "svc": "UpdateProvider",
                "params": [("id", "param", None)],
                "body_type": None,
                "resp": "no_content",
                "map_body": True,
            },
            "InitiateLogin": {
                "svc": "InitiateLogin",
                "params": [],
                "body_type": "SSOLoginRequest",
                "resp": "success",
                "pointer_body": True,
            },
            "HandleCallback": {
                "svc": "HandleCallback",
                "params": [("id", "param", None), ("state", "query", None), ("userID", "query", None)],
                "body_type": None,
                "resp": "success",
                "callback_params": True,
            },
        },
    },
}


def generate_handler_code(handler_name: str, config: dict, mod: str) -> str:
    """Generate one handler method."""
    svc_name = config["svc"]
    params = config["params"]
    body_type = config["body_type"]
    resp_type = config["resp"]

    lines = []
    lines.append(f"func (h *Handler) {handler_name}(c *gin.Context) {{")
    lines.append("\tctx := c.Request.Context()")
    lines.append("\ttenantID := c.GetString(\"tenant_id\")")
    lines.append("")

    # Extract params
    param_assignments = []
    svc_args = ["ctx", "tenantID"]
    for pname, source, default in params:
        if source == "param":
            gin_param = pname.lower()
            # Map to gin param names
            param_map = {
                "agentid": "id", "agent": "id", "ruleid": "id", "rule": "id",
                "env": "id", "envId": "id", "storeid": "id", "store": "id",
                "serverid": "id", "server": "id", "providerid": "id", "provider": "id",
                "auditid": "id", "audit": "id", "reviewid": "id", "review": "id",
                "decisionid": "id", "decision": "id", "artifactid": "artifactId",
            }
            gp = param_map.get(gin_param, gin_param)
            param_assignments.append(f"\t{pname} := c.Param(\"{gp}\")")
            svc_args.append(pname)
        elif source == "query":
            if pname in ("limit", "offset"):
                param_assignments.append(f"\t{pname}, _ := strconv.Atoi(c.DefaultQuery(\"{pname}\", \"{default}\"))")
            elif default:
                param_assignments.append(f"\t{pname} := c.DefaultQuery(\"{pname}\", \"{default}\")")
            else:
                param_assignments.append(f"\t{pname} := c.Query(\"{pname}\")")
            svc_args.append(pname)

    lines.extend(param_assignments)

    # Body binding
    if body_type:
        if config.get("pointer_body"):
            lines.append(f"\treq := &models.{body_type}{{}}")
        elif config.get("special_body"):
            lines.append(f"\tvar req models.{body_type}")
        else:
            lines.append(f"\tvar req models.{body_type}")
        lines.append(f"\tif err := c.ShouldBindJSON(&req); err != nil {{")
        lines.append(f"\t\trespondBadRequest(c, err.Error())")
        lines.append(f"\t\treturn")
        lines.append(f"\t}}")
        svc_args.append("req" if not config.get("pointer_body") else "req")

    # Map body for UpdateProvider
    if config.get("map_body"):
        lines.append(f"\tupdates := make(map[string]interface{{}})")
        lines.append(f"\tif err := c.ShouldBindJSON(&updates); err != nil {{")
        lines.append(f"\t\trespondBadRequest(c, err.Error())")
        lines.append(f"\t\treturn")
        lines.append(f"\t}}")
        # Replace last req with updates
        svc_args[-1] = "updates" if "updates" in svc_args else "updates"

    # Build service call
    svc_call_args = ", ".join(svc_args)
    svc_call = f"h.svc.{svc_name}({svc_call_args})"

    # Determine result vars based on return type
    if config.get("special_return"):
        result_line = f"result, total, err := {svc_call}"
        success_arg = f"gin.H{{\"items\": result, \"total\": total}}"
    elif resp_type == "no_content":
        result_line = f"err := {svc_call}"
        success_arg = None
    else:
        result_line = f"result, err := {svc_call}"
        success_arg = "result"

    lines.append(f"\t{result_line}")
    lines.append(f"\tif err != nil {{")
    lines.append(f"\t\trespondInternalError(c, err.Error())")
    lines.append(f"\t\treturn")
    lines.append(f"\t}}")

    # Response
    if resp_type == "no_content":
        lines.append(f"\tc.Status(204)")
    elif resp_type == "created":
        lines.append(f"\trespondCreated(c, result)")
    elif success_arg:
        if config.get("special_return"):
            lines.append(f"\trespondSuccess(c, gin.H{{\"items\": result, \"total\": total}})")
        else:
            lines.append(f"\trespondSuccess(c, {success_arg})")

    lines.append("}")
    return "\n".join(lines)


def generate_module(module_name: str, mod_config: dict, base_dir: str) -> list[str]:
    """Generate all handler methods for a module. Returns list of (old, new) pairs."""
    handler_file = os.path.join(base_dir, f"internal/{module_name}/handler/handler.go")
    if not os.path.exists(handler_file):
        return []

    with open(handler_file, "r") as f:
        content = f.read()

    changes = []
    for handler_name, config in mod_config["handlers"].items():
        # Find the stub function
        func_start = re.search(r'func \(h \*Handler\) ' + re.escape(handler_name) + r'\(c \*gin\.Context\)\s*\{', content)
        if not func_start:
            print(f"  WARNING: could not find {handler_name} in handler")
            continue

        # Find function end
        start_pos = func_start.end()
        brace_count = 1
        i = start_pos
        while i < len(content) and brace_count > 0:
            if content[i] == '{':
                brace_count += 1
            elif content[i] == '}':
                brace_count -= 1
            i += 1

        old_body = content[func_start.start():i]
        new_body = generate_handler_code(handler_name, config, module_name)
        content = content[:func_start.start()] + new_body + "\n" + content[i:]

        changes.append((handler_name, old_body, new_body))

    # Write back
    with open(handler_file, "w") as f:
        f.write(content)

    return changes


def main():
    base_dir = "/Users/heal/orion-design/orion-platform-svc-go"
    total = 0
    for module_name, mod_config in MODULES.items():
        changes = generate_module(module_name, mod_config, base_dir)
        total += len(changes)
        print(f"{module_name}: {len(changes)} handlers generated")

    print(f"\nTotal: {total} stub handlers replaced")

if __name__ == "__main__":
    main()
