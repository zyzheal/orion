package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"
	job_processor_handler "orion/platform-svc-go/internal/job-processor/handler"
	jp_processor "orion/platform-svc-go/internal/job-processor/processor"
	job_processor_repo "orion/platform-svc-go/internal/job-processor/repository"
	job_processor_service "orion/platform-svc-go/internal/job-processor/service"
)

var jobProcessorH *job_processor_handler.Handler

func wireJobProcessor(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := job_processor_repo.NewRepository(db.DB)
	proc := jp_processor.NewProcessor(repo, logger)
	svc := job_processor_service.NewService(proc, repo)
	jobProcessorH = job_processor_handler.NewHandler(svc)
}
