package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"

	rdmstats_handler "orion/platform-svc-go/internal/rdm-statistics/handler"
	rdmstats_service "orion/platform-svc-go/internal/rdm-statistics/service"
)

// rdmStatsH is wired by wireRDMStatistics and consumed by the router
// handler list. Nil when wiring fails (safe: router loop skips nil).
var rdmStatsH *rdmstats_handler.Handler

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
