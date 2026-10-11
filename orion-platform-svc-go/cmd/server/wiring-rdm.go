package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"

	rdmcr_handler "orion/platform-svc-go/internal/rdm-code-reviews/handler"
	rdmcr_service "orion/platform-svc-go/internal/rdm-code-reviews/service"
	rdmstats_handler "orion/platform-svc-go/internal/rdm-statistics/handler"
	rdmstats_service "orion/platform-svc-go/internal/rdm-statistics/service"
)

// rdmStatsH is wired by wireRDMStatistics and consumed by the router
// handler list. Nil when wiring fails (safe: router loop skips nil).
var rdmStatsH *rdmstats_handler.Handler

// rdmCodeReviewH is wired by wireRDMCodeReviews and consumed by the
// router handler list. Nil when wiring fails.
var rdmCodeReviewH *rdmcr_handler.Handler

// wireRDMStatistics wires the RDM statistics module (R-P0-04).
//
// Current phase: stub — no DB dependency. The 4 statistics endpoints
// return empty-but-typed responses so frontend rdm.ts calls stop 404ing.
// Once RDM entity tables (rdm_requirements / rdm_defects / rdm_tasks)
// land, replace the NewService(nil) call with NewService(repo) where
// repo implements the rdm.Repository interface.
//
// Logger is accepted for signature consistency with other wire* funcs
// but unused in the stub phase.
func wireRDMStatistics(db *database.DB, logger *zap.Logger) {
	_ = db
	_ = logger
	svc := rdmstats_service.NewService(nil)
	rdmStatsH = rdmstats_handler.NewHandler(svc)
}

// wireRDMCodeReviews wires the RDM code-reviews module (R-P0-05).
//
// Stub phase mirrors wireRDMStatistics: no DB persistence yet.
// Frontend rdm.ts code-review endpoints (list/get/create/delete +
// comments CRUD) return 200 with the declared shapes. Once
// rdm_code_reviews + rdm_code_review_comments tables land, inject
// *rdm.Repository into NewService.
func wireRDMCodeReviews(db *database.DB, logger *zap.Logger) {
	_ = db
	_ = logger
	svc := rdmcr_service.NewService(nil)
	rdmCodeReviewH = rdmcr_handler.NewHandler(svc)
}
