package main

import (
	"orion/go-common/pkg/database"

	ciArtReg_handler "orion/platform-svc-go/internal/ci-cd/artifact-registry/handler"
	ciArtReg_repo "orion/platform-svc-go/internal/ci-cd/artifact-registry/repository"
	ciArtReg_service "orion/platform-svc-go/internal/ci-cd/artifact-registry/service"
	ciArtVer_handler "orion/platform-svc-go/internal/ci-cd/artifact-version/handler"
	ciArtVer_repo "orion/platform-svc-go/internal/ci-cd/artifact-version/repository"
	ciArtVer_service "orion/platform-svc-go/internal/ci-cd/artifact-version/service"
	ciBuild_handler "orion/platform-svc-go/internal/ci-cd/build/handler"
	ciDeploy_handler "orion/platform-svc-go/internal/ci-cd/deploy/handler"
	ciPTmpl_handler "orion/platform-svc-go/internal/ci-cd/pipeline-template/handler"
	ciPTmpl_repo "orion/platform-svc-go/internal/ci-cd/pipeline-template/repository"
	ciPTmpl_service "orion/platform-svc-go/internal/ci-cd/pipeline-template/service"
	ciRunner_handler "orion/platform-svc-go/internal/ci-cd/runner/handler"
	ciRunner_repo "orion/platform-svc-go/internal/ci-cd/runner/repository"
	ciRunner_service "orion/platform-svc-go/internal/ci-cd/runner/service"

	"go.uber.org/zap"
)

var (
	ciArtRegH *ciArtReg_handler.ArtifactRegistryHandler
	ciArtVerH *ciArtVer_handler.ArtifactVersionHandler
	ciBuildH  *ciBuild_handler.Handler
	ciDeployH *ciDeploy_handler.Handler
	ciPTmplH  *ciPTmpl_handler.Handler
	ciRunnerH *ciRunner_handler.Handler
)

// wireBlueprintCICD wires the Blueprint CI-CD merge subdomain handlers:
// artifact-registry, artifact-version, build, deploy, pipeline-template, runner.
func wireBlueprintCICD(db *database.DB, logger *zap.Logger) {
	// artifact-registry: repo -> service -> handler
	ciArtRegRepo := ciArtReg_repo.NewArtifactRegistryRepository(db.DB.DB)
	ciArtRegSvc := ciArtReg_service.NewArtifactRegistryService(ciArtRegRepo, logger)
	ciArtRegH = ciArtReg_handler.NewArtifactRegistryHandler(ciArtRegSvc)
	// artifact-version: repo -> service -> handler
	ciArtVerSvc := ciArtVer_service.NewArtifactVersionServiceWithRepo(ciArtVer_repo.NewArtifactVersionRepository(db.DB), logger)
	ciArtVerH = ciArtVer_handler.NewArtifactVersionHandler(ciArtVerSvc)
	// build: repo -> service -> handler (requires db + logger)
	ciBuildH = ciBuild_handler.New(db, logger)
	// deploy: repo -> service -> handler (requires db + logger)
	ciDeployH = ciDeploy_handler.New(db, logger)
	// pipeline-template: repo -> service -> handler
	ciPTmplRepo := ciPTmpl_repo.NewRepository(db.DB)
	ciPTmplSvc := ciPTmpl_service.NewService(ciPTmplRepo)
	ciPTmplH = ciPTmpl_handler.NewHandler(ciPTmplSvc)
	// runner: repo -> service -> handler
	ciRunnerRepo := ciRunner_repo.NewRepository(db.DB)
	ciRunnerSvc := ciRunner_service.NewService(ciRunnerRepo)
	ciRunnerH = ciRunner_handler.NewHandler(ciRunnerSvc)
}
