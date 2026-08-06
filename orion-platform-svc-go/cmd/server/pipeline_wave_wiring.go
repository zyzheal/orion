package main

import (
	"orion/go-common/pkg/database"

	pb_repo "orion/platform-svc-go/internal/pipeline-batch/repository"
	pb_service "orion/platform-svc-go/internal/pipeline-batch/service"
	pb_handler "orion/platform-svc-go/internal/pipeline-batch/handler"
	pal_repo "orion/platform-svc-go/internal/pipeline-audit-log/repository"
	pal_service "orion/platform-svc-go/internal/pipeline-audit-log/service"
	pal_handler "orion/platform-svc-go/internal/pipeline-audit-log/handler"
	ptmpl_repo "orion/platform-svc-go/internal/pipeline-template/repository"
	ptmpl_service "orion/platform-svc-go/internal/pipeline-template/service"
	ptmpl_handler "orion/platform-svc-go/internal/pipeline-template/handler"
	pver_repo "orion/platform-svc-go/internal/pipeline-version/repository"
	pver_service "orion/platform-svc-go/internal/pipeline-version/service"
	pver_handler "orion/platform-svc-go/internal/pipeline-version/handler"
	phist_repo "orion/platform-svc-go/internal/pipeline-run-history/repository"
	phist_service "orion/platform-svc-go/internal/pipeline-run-history/service"
	phist_handler "orion/platform-svc-go/internal/pipeline-run-history/handler"
	pbo_repo "orion/platform-svc-go/internal/pipeline-batch-operations/repository"
	pbo_service "orion/platform-svc-go/internal/pipeline-batch-operations/service"
	pbo_handler "orion/platform-svc-go/internal/pipeline-batch-operations/handler"
	psse_repo "orion/platform-svc-go/internal/pipeline-sse/repository"
	psse_service "orion/platform-svc-go/internal/pipeline-sse/service"
	psse_handler "orion/platform-svc-go/internal/pipeline-sse/handler"
	pec_repo "orion/platform-svc-go/internal/pipeline-execution-control/repository"
	pec_service "orion/platform-svc-go/internal/pipeline-execution-control/service"
	pec_handler "orion/platform-svc-go/internal/pipeline-execution-control/handler"
	pgraph_repo "orion/platform-svc-go/internal/pipeline-graph/repository"
	pgraph_service "orion/platform-svc-go/internal/pipeline-graph/service"
	pgraph_handler "orion/platform-svc-go/internal/pipeline-graph/handler"
	ptrend_repo "orion/platform-svc-go/internal/pipeline-trend/repository"
	ptrend_service "orion/platform-svc-go/internal/pipeline-trend/service"
	ptrend_handler "orion/platform-svc-go/internal/pipeline-trend/handler"
	ci_repo "orion/platform-svc-go/internal/change-intelligence/repository"
	ci_service "orion/platform-svc-go/internal/change-intelligence/service"
	ci_handler "orion/platform-svc-go/internal/change-intelligence/handler"
	tracing_repo "orion/platform-svc-go/internal/tracing/repository"
	tracing_service "orion/platform-svc-go/internal/tracing/service"
	tracing_handler "orion/platform-svc-go/internal/tracing/handler"
	slo_repo "orion/platform-svc-go/internal/slo/repository"
	slo_service "orion/platform-svc-go/internal/slo/service"
	slo_handler "orion/platform-svc-go/internal/slo/handler"
	perf_repo "orion/platform-svc-go/internal/performance/repository"
	perf_service "orion/platform-svc-go/internal/performance/service"
	perf_handler "orion/platform-svc-go/internal/performance/handler"
	hc_repo "orion/platform-svc-go/internal/health-check/repository"
	hc_service "orion/platform-svc-go/internal/health-check/service"
	hc_handler "orion/platform-svc-go/internal/health-check/handler"
	supply_chain_repo "orion/platform-svc-go/internal/supply-chain/repository"
	supply_chain_service "orion/platform-svc-go/internal/supply-chain/service"
	supply_chain_handler "orion/platform-svc-go/internal/supply-chain/handler"
	secret_repo "orion/platform-svc-go/internal/secret/repository"
	secret_service "orion/platform-svc-go/internal/secret/service"
	secret_handler "orion/platform-svc-go/internal/secret/handler"
	chaos_enhanced_repo "orion/platform-svc-go/internal/chaos-enhanced/repository"
	chaos_enhanced_service "orion/platform-svc-go/internal/chaos-enhanced/service"
	chaos_enhanced_handler "orion/platform-svc-go/internal/chaos-enhanced/handler"
	ueba_repo "orion/platform-svc-go/internal/ueba/repository"
	ueba_service "orion/platform-svc-go/internal/ueba/service"
	ueba_handler "orion/platform-svc-go/internal/ueba/handler"
	problem_repo "orion/platform-svc-go/internal/problem/repository"
	problem_service "orion/platform-svc-go/internal/problem/service"
	problem_handler "orion/platform-svc-go/internal/problem/handler"
)

// wirePipelineAssistantModules wires Wave 5: Pipeline Assistant modules.
func wirePipelineAssistantModules(db *database.DB) {
	pbRepo := pb_repo.NewRepository(db.DB)
	pbSvc := pb_service.NewService(pbRepo)
	pbH = pb_handler.NewHandler(pbSvc)

	palRepo := pal_repo.NewRepository(db.DB)
	palSvc := pal_service.NewService(palRepo)
	palH = pal_handler.NewHandler(palSvc)

	ptmplRepo := ptmpl_repo.NewRepository(db.DB)
	ptmplSvc := ptmpl_service.NewService(ptmplRepo)
	ptmplH = ptmpl_handler.NewHandler(ptmplSvc)

	pverRepo := pver_repo.NewRepository(db.DB)
	pverSvc := pver_service.NewService(pverRepo)
	pverH = pver_handler.NewHandler(pverSvc)

	phistRepo := phist_repo.NewRepository(db.DB)
	phistSvc := phist_service.NewService(phistRepo)
	phistH = phist_handler.NewHandler(phistSvc)

	// Pipeline batch-operations now depends on the real pipeline service.
	// pipelineSvc is set in wireCICDModules (cicd_domain_wiring.go), which runs before this.
	pboRepo := pbo_repo.NewRepository(db.DB)
	pboSvc := pbo_service.NewService(pboRepo, pipelineSvc)
	pboH = pbo_handler.NewHandler(pboSvc)

	psseRepo := psse_repo.NewRepository(db.DB)
	psseSvc := psse_service.NewSSEHub(psseRepo)
	psseH = psse_handler.NewHandler(psseSvc)

	pecRepo := pec_repo.NewRepository(db.DB)
	pecSvc := pec_service.NewService(pecRepo)
	pecH = pec_handler.NewHandler(pecSvc)

	pgraphRepo := pgraph_repo.NewRepository(db.DB)
	pgraphSvc := pgraph_service.NewService(pgraphRepo)
	pgraphH = pgraph_handler.NewHandler(pgraphSvc)

	ptrendRepo := ptrend_repo.NewRepository(db.DB)
	ptrendSvc := ptrend_service.NewService(ptrendRepo)
	ptrendH = ptrend_handler.NewHandler(ptrendSvc)

	ciRepo := ci_repo.NewRepository(db.DB)
	ciSvc := ci_service.NewService(ciRepo)
	ciH = ci_handler.NewHandler(ciSvc)
}

// wireObservabilityWaveModules wires Wave 6: Observability modules.
func wireObservabilityWaveModules(db *database.DB) {
	tracingRepo := tracing_repo.NewRepository(db.DB)
	tracingSvc := tracing_service.NewService(tracingRepo)
	tracingH = tracing_handler.NewHandler(tracingSvc)

	sloRepo := slo_repo.NewRepository(db.DB)
	sloSvc := slo_service.NewService(sloRepo)
	sloH = slo_handler.NewHandler(sloSvc)

	perfRepo := perf_repo.NewRepository(db.DB)
	perfSvc := perf_service.NewService(perfRepo)
	perfH = perf_handler.NewHandler(perfSvc)

	hcRepo := hc_repo.NewRepository(db.DB)
	hcSvc := hc_service.NewService(hcRepo)
	hcH = hc_handler.NewHandler(hcSvc)
}

// wireP2Modules wires Wave 7a: P2 security & compliance modules.
func wireP2Modules(db *database.DB) {
	// compliance: handled by governance/compliance in wiring-core-domains.go
	supply_chainRepo := supply_chain_repo.NewRepository(db.DB)
	supply_chainSvc := supply_chain_service.NewService(supply_chainRepo)
	supply_chainH = supply_chain_handler.NewHandler(supply_chainSvc)

	secretRepo := secret_repo.NewRepository(db.DB)
	secretSvc := secret_service.NewService(secretRepo)
	secretH = secret_handler.NewHandler(secretSvc)

	chaos_enhancedRepo := chaos_enhanced_repo.NewRepository(db.DB)
	chaos_enhancedSvc := chaos_enhanced_service.NewService(chaos_enhancedRepo)
	chaos_enhancedH = chaos_enhanced_handler.NewHandler(chaos_enhancedSvc)

	uebaRepo := ueba_repo.NewRepository(db.DB)
	uebaSvc := ueba_service.NewService(uebaRepo)
	uebaH = ueba_handler.NewHandler(uebaSvc)

	// problem services
	problemRepo := problem_repo.NewRepository(db.DB)
	problemSvc := problem_service.NewService(problemRepo)
	problemH = problem_handler.NewHandler(problemSvc)
}

// Handler variables for pipeline_wave_wiring (moved from central wiring.go var block)
var (
	chaos_enhancedH     *chaos_enhanced_handler.Handler
	ciH                 *ci_handler.Handler
	// complianceH removed — merged into governance/compliance (P2-01)
	hcH                 *hc_handler.Handler
	palH                *pal_handler.Handler
	pbH                 *pb_handler.Handler
	pboH                *pbo_handler.Handler
	pecH                *pec_handler.Handler
	perfH               *perf_handler.Handler
	pgraphH             *pgraph_handler.Handler
	phistH              *phist_handler.Handler
	problemH            *problem_handler.Handler
	psseH               *psse_handler.Handler
	ptmplH              *ptmpl_handler.Handler
	ptrendH             *ptrend_handler.Handler
	pverH               *pver_handler.Handler
	secretH             *secret_handler.Handler
	sloH                *slo_handler.Handler
	supply_chainH       *supply_chain_handler.Handler
	tracingH            *tracing_handler.Handler
	uebaH               *ueba_handler.Handler
)
