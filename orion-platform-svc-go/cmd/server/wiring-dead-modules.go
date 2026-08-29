package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	ai_knowledge_handler "orion/platform-svc-go/internal/ai/knowledge/handler"
	ai_knowledge_repo "orion/platform-svc-go/internal/ai/knowledge/repository"
	ai_knowledge_service "orion/platform-svc-go/internal/ai/knowledge/service"

	skill_handler "orion/platform-svc-go/internal/skill/handler"
	skill_repo "orion/platform-svc-go/internal/skill/repository"
	skill_service "orion/platform-svc-go/internal/skill/service"
)

// The two handler vars mounted by wireDeadModules below. They used to be
// declared in wiring.go and never assigned; router.go already nil-guards and
// mounts both.
var (
	skillH        *skill_handler.Handler
	ai_knowledgeH *ai_knowledge_handler.KnowledgeHandler
)

// wireDeadModules mounts the two handler declarations that existed in wiring.go
// but were never assigned, so their endpoints were unreachable.
//
// Prefix ownership was checked against the route dump before mounting:
//
//	/skill          -> free  (mounted here)
//	/knowledge/bases -> free  (mounted here)
//	/graph          -> already owned by graphH
//	/middleware     -> already owned by middlewareH
//	/canaries, /runs, /configs -> /runs owned by ciRunnerH+workflowH,
//	                             /configs owned by configH
//	/pipelines, /runs       -> /pipelines owned by 11 handlers, /runs as above
//
// Mounting any of the last three would re-register paths Gin already holds, and
// Gin panics on a duplicate (method, path) — the same failure that took the
// server down before the 2026-08-29 conflict cleanup. Their declarations
// were deleted from wiring.go instead of kept as dead variables.
//
// global-search was also deleted: it needs an *elasticsearch.Client, and no ES
// client is constructed anywhere in the wiring layer, so the handler could only
// have been built with a nil client.
func wireDeadModules(db *database.DB, logger *zap.Logger) {
	skillH = skill_handler.NewHandler(skill_service.NewService(skill_repo.NewRepository(db.DB)))

	ai_knowledgeH = ai_knowledge_handler.NewKnowledgeHandler(
		ai_knowledge_service.NewKnowledgeService(
			ai_knowledge_repo.NewKnowledgeRepository(db.DB), logger))
}
