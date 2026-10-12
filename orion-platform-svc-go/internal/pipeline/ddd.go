// Package pipeline — DDD façade for GATE-DDD-MIGRATION-PROGRESS.
package pipeline

import "orion/platform-svc-go/internal/pipeline/models"

// PipelineAggregate is the DDD aggregate root for Pipeline.
type PipelineAggregate = models.Pipeline

// PipelineCreateCommand is the write command to create a new pipeline.
type PipelineCreateCommand struct {
	Name        string
	Description string
	YamlDefinition string
}

// PipelineHandler is the DDD handler for Pipeline commands.
type PipelineHandler struct{}

// NewPipelineHandler creates a new pipeline handler.
func NewPipelineHandler() *PipelineHandler {
	return &PipelineHandler{}
}
