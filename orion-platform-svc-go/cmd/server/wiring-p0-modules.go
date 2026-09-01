package main

import (
	"orion/go-common/pkg/database"

	aiInference_handler "orion/platform-svc-go/internal/ai/inference/handler"
	aiInference_service "orion/platform-svc-go/internal/ai/inference/service"
	aiModels_handler "orion/platform-svc-go/internal/ai/models/handler"
	aiModels_repo "orion/platform-svc-go/internal/ai/models/repository"
	aiModels_service "orion/platform-svc-go/internal/ai/models/service"
	cluster_handler "orion/platform-svc-go/internal/cluster/handler"
	cluster_repo "orion/platform-svc-go/internal/cluster/repository"
	cluster_service "orion/platform-svc-go/internal/cluster/service"
	crossover_adapter "orion/platform-svc-go/internal/crossover/adapter"
	crossover_handler "orion/platform-svc-go/internal/crossover/handler"
	crossover_repo "orion/platform-svc-go/internal/crossover/repository"
	crossover_service "orion/platform-svc-go/internal/crossover/service"
	logging_handler "orion/platform-svc-go/internal/logging/handler"
	logging_repo "orion/platform-svc-go/internal/logging/repository"
	logging_service "orion/platform-svc-go/internal/logging/service"
	message_queue_handler "orion/platform-svc-go/internal/message-queue/handler"
	message_queue_repo "orion/platform-svc-go/internal/message-queue/repository"
	message_queue_service "orion/platform-svc-go/internal/message-queue/service"
	network_handler "orion/platform-svc-go/internal/network/handler"
	network_repo "orion/platform-svc-go/internal/network/repository"
	network_service "orion/platform-svc-go/internal/network/service"
	sandbox_handler "orion/platform-svc-go/internal/sandbox/handler"
	sandbox_repo "orion/platform-svc-go/internal/sandbox/repository"
	sandbox_service "orion/platform-svc-go/internal/sandbox/service"
	storage_handler "orion/platform-svc-go/internal/storage/handler"
	storage_repo "orion/platform-svc-go/internal/storage/repository"
	storage_service "orion/platform-svc-go/internal/storage/service"

	"go.uber.org/zap"
)

var (
	sandboxH     *sandbox_handler.Handler
	loggingH     *logging_handler.Handler
	crossoverH   *crossover_handler.Handler
	storageH     *storage_handler.Handler
	clusterH     *cluster_handler.Handler
	aiInferenceH *aiInference_handler.Handler
	networkH     *network_handler.Handler
	aiModelsH    *aiModels_handler.Handler
)

// wireP0Modules wires P0/P1 core modules: sandbox, logging, crossover, storage,
// message-queue, cluster, ai-inference, network, ai-models. message_queueH is
// declared in blueprint_batch_wiring.go; this function re-assigns it (same
// override pattern as data-catalog).
func wireP0Modules(db *database.DB, logger *zap.Logger) {
	// P0-6: Agent sandbox (isolated code execution)
	sandboxRepo := sandbox_repo.NewRepository(db.DB)
	sandboxSvc := sandbox_service.NewService(sandboxRepo, logger)
	sandboxH = sandbox_handler.NewHandler(sandboxSvc)
	// P0-9: Centralized logging service
	loggingRepo := logging_repo.NewRepository(db.DB)
	loggingSvc := logging_service.NewService(loggingRepo)
	loggingH = logging_handler.NewHandler(loggingSvc)
	// P1-1: Crossover cross-module call bus
	crossoverRepo := crossover_repo.NewRepository(db.DB)
	crossoverAdapter := crossover_adapter.NewRepositoryAdapter(crossoverRepo)
	crossoverSvc := crossover_service.NewCrossoverService(crossoverAdapter)
	crossoverH = crossover_handler.NewHandler(crossoverSvc)
	// P0-5: Object storage metadata (S3/MinIO abstraction)
	storageRepo := storage_repo.NewRepository(db.DB)
	storageSvc := storage_service.NewService(storageRepo)
	storageH = storage_handler.NewHandler(storageSvc)
	// P0-8: Message queue reliable persistence
	message_queueRepo := message_queue_repo.NewRepository(db.DB)
	message_queueSvc := message_queue_service.NewService(message_queueRepo)
	message_queueH = message_queue_handler.NewHandler(message_queueSvc)
	// P0-18: K8s Provisioner
	clusterRepo := cluster_repo.NewRepository(db.DB)
	clusterSvc := cluster_service.NewService(clusterRepo)
	clusterH = cluster_handler.NewHandler(clusterSvc)
	// P0-4: AI Inference Proxy (HTTP proxy to Python AI service)
	aiInferenceSvc := aiInference_service.NewPythonInferenceService()
	aiInferenceH = aiInference_handler.NewHandler(aiInferenceSvc)
	// P0-20: Network Management Module
	networkRepo := network_repo.NewRepository(db.DB)
	networkSvc := network_service.NewService(networkRepo)
	networkH = network_handler.NewHandler(networkSvc)
	// ai-models services
	aiModelsRepo := aiModels_repo.NewRepository(db.DB)
	aiModelsSvc := aiModels_service.NewService(aiModelsRepo, logger)
	aiModelsH = aiModels_handler.NewHandler(aiModelsSvc)
}
