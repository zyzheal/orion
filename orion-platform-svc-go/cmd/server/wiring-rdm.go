package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"

	rdmcr_handler "orion/platform-svc-go/internal/rdm-code-reviews/handler"
	rdmcr_repo "orion/platform-svc-go/internal/rdm-code-reviews/repository"
	rdmcr_service "orion/platform-svc-go/internal/rdm-code-reviews/service"
	rdmstats_handler "orion/platform-svc-go/internal/rdm-statistics/handler"
	rdmstats_repo "orion/platform-svc-go/internal/rdm-statistics/repository"
	rdmstats_service "orion/platform-svc-go/internal/rdm-statistics/service"
)

// rdmStatsH is wired by wireRDMStatistics and consumed by the router
// handler list. Nil when wiring fails (safe: router loop skips nil).
var rdmStatsH *rdmstats_handler.Handler

// rdmCodeReviewH is wired by wireRDMCodeReviews and consumed by the
// router handler list. Nil when wiring fails.
var rdmCodeReviewH *rdmcr_handler.Handler

// wireRDMStatistics wires the RDM statistics module (R-P0-04).
// Real implementation: queries rdm_requirements table for burndown,
// velocity, defect stats, and sprint summaries.
func wireRDMStatistics(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := rdmstats_repo.NewRepository(db.DB)
	svc := rdmstats_service.NewService(repo)
	rdmStatsH = rdmstats_handler.NewHandler(svc)
}

// wireRDMCodeReviews wires the RDM code-reviews module (R-P0-05).
// Real implementation: persists code reviews and comments to
// rdm_code_reviews + rdm_code_review_comments tables (migration 785).
func wireRDMCodeReviews(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := rdmcr_repo.NewRepository(db.DB)
	svc := rdmcr_service.NewService(repo)
	rdmCodeReviewH = rdmcr_handler.NewHandler(svc)
}
