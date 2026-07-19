package service

import (
	"context"

	"orion/platform-svc-go/internal/pipeline-graph/repository"
)

// PipelineGraphRepo abstracts the repository interface used by Service.
type PipelineGraphRepo interface {
	GetPipelineByID(ctx context.Context, id string) (*repository.PipelineDefinition, error)
}
