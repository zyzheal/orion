package service

import (
	"context"
	"fmt"

	"gopkg.in/yaml.v3"

	"orion/ci-cd-svc-go/internal/pipeline/models"


	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// GraphService handles pipeline graph and YAML conversion operations.
type GraphService struct {
	pipelineSvc *PipelineService
}

func NewGraphService(pipelineSvc *PipelineService) *GraphService {
	return &GraphService{pipelineSvc: pipelineSvc}
}

// BuildGraph constructs a dependency graph from a pipeline's YAML config.
func (s *GraphService) BuildGraph(ctx context.Context, tenantID, pipelineID string) (*models.PipelineGraph, error) {
	ctx, span := tracer.Start(ctx, "GraphService.BuildGraph",
		trace.WithAttributes(
			attribute.String("pipeline.id", pipelineID),
		))
	defer span.End()

	pipeline, err := s.pipelineSvc.GetByID(ctx, tenantID, pipelineID)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("pipeline not found: %w", err)
	}

	// Parse the YAML config to extract stages and dependencies
	yamlDef, err := parseYAMLDef(pipeline.YAMLConfig)
	if err != nil {
		// If we can't parse YAML, fall back to default stages
		span.AddEvent("yaml_parse_fallback", trace.WithAttributes(
			attribute.String("error", err.Error()),
		))
		return buildDefaultGraph(pipelineID), nil
	}

	return buildGraphFromDef(pipelineID, yamlDef), nil
}

// ParseYAML parses a pipeline YAML definition into a structured model.
func (s *GraphService) ParseYAML(ctx context.Context, yamlContent string) (*models.PipelineYAMLDef, error) {
	ctx, span := tracer.Start(ctx, "GraphService.ParseYAML",
		trace.WithAttributes(attribute.Int("yaml.length", len(yamlContent))))
	defer span.End()

	def, err := parseYAMLDef(yamlContent)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, fmt.Errorf("failed to parse YAML: %w", err)
	}
	return def, nil
}

// ToYAML converts a pipeline YAML definition back to YAML string.
func (s *GraphService) ToYAML(ctx context.Context, def *models.PipelineYAMLDef) (string, error) {
	ctx, span := tracer.Start(ctx, "GraphService.ToYAML")
	defer span.End()

	// Validate before converting
	if def.APIVersion == "" {
		def.APIVersion = "v1"
	}
	if def.Kind == "" {
		def.Kind = "Pipeline"
	}
	if def.Metadata.Name == "" {
		return "", fmt.Errorf("pipeline name is required")
	}
	if len(def.Spec.Stages) == 0 {
		return "", fmt.Errorf("at least one stage is required")
	}

	out, err := yaml.Marshal(def)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return "", fmt.Errorf("failed to marshal YAML: %w", err)
	}

	return string(out), nil
}

// ValidateYAML validates a pipeline YAML definition.
func (s *GraphService) ValidateYAML(ctx context.Context, yamlContent string) (*models.YAMLValidationResult, error) {
	ctx, span := tracer.Start(ctx, "GraphService.ValidateYAML",
		trace.WithAttributes(attribute.Int("yaml.length", len(yamlContent))))
	defer span.End()

	result := &models.YAMLValidationResult{
		Valid:   true,
		Errors:  []models.YAMLValidationErr{},
		Warnings: []string{},
	}

	def, err := parseYAMLDef(yamlContent)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, models.YAMLValidationErr{
			Field:   "yaml",
			Message: fmt.Sprintf("invalid YAML: %v", err),
		})
		span.SetStatus(codes.Error, err.Error())
		return result, nil
	}

	// Validate required fields
	if def.Metadata.Name == "" {
		result.Valid = false
		result.Errors = append(result.Errors, models.YAMLValidationErr{
			Field:   "metadata.name",
			Message: "pipeline name is required",
		})
	}

	if len(def.Spec.Stages) == 0 {
		result.Valid = false
		result.Errors = append(result.Errors, models.YAMLValidationErr{
			Field:   "spec.stages",
			Message: "at least one stage is required",
		})
	}

	// Validate stage dependencies
	stageNames := make(map[string]bool)
	for _, stage := range def.Spec.Stages {
		stageNames[stage.Name] = true
	}
	for _, stage := range def.Spec.Stages {
		for _, dep := range stage.DependsOn {
			if !stageNames[dep] {
				result.Valid = false
				result.Errors = append(result.Errors, models.YAMLValidationErr{
					Field:   fmt.Sprintf("spec.stages[%s].dependsOn", stage.Name),
					Message: fmt.Sprintf("dependency %q not found in stages", dep),
				})
			}
		}
	}

	// Add warnings for missing but non-critical fields
	if def.APIVersion == "" {
		result.Warnings = append(result.Warnings, "apiVersion not set, defaulting to 'v1'")
	}
	if def.Kind == "" {
		result.Warnings = append(result.Warnings, "kind not set, defaulting to 'Pipeline'")
	}

	return result, nil
}

// ==================== Internal Helpers ====================

func parseYAMLDef(yamlContent string) (*models.PipelineYAMLDef, error) {
	if yamlContent == "" {
		return nil, fmt.Errorf("empty YAML content")
	}

	var def models.PipelineYAMLDef
	if err := yaml.Unmarshal([]byte(yamlContent), &def); err != nil {
		return nil, fmt.Errorf("failed to unmarshal YAML: %w", err)
	}

	return &def, nil
}

func buildDefaultGraph(pipelineID string) *models.PipelineGraph {
	return &models.PipelineGraph{
		Nodes: []models.GraphNode{
			{ID: pipelineID + "-build", Label: "build", Type: "stage", Sequence: 1},
			{ID: pipelineID + "-test", Label: "test", Type: "stage", Sequence: 2},
			{ID: pipelineID + "-deploy", Label: "deploy", Type: "stage", Sequence: 3},
		},
		Edges: []models.GraphEdge{
			{From: pipelineID + "-build", To: pipelineID + "-test", Label: "depends_on", Type: "sequential"},
			{From: pipelineID + "-test", To: pipelineID + "-deploy", Label: "depends_on", Type: "sequential"},
		},
	}
}

func buildGraphFromDef(pipelineID string, def *models.PipelineYAMLDef) *models.PipelineGraph {
	graph := &models.PipelineGraph{
		Nodes: []models.GraphNode{},
		Edges: []models.GraphEdge{},
	}

	// Build stage nodes
	stageNodeIDs := make(map[string]string)
	for i, stage := range def.Spec.Stages {
		nodeID := pipelineID + "-" + stage.Name
		stageNodeIDs[stage.Name] = nodeID

		graph.Nodes = append(graph.Nodes, models.GraphNode{
			ID:       nodeID,
			Label:    stage.Name,
			Type:     "stage",
			Sequence: i + 1,
		})
	}

	// Build edges from dependsOn
	for _, stage := range def.Spec.Stages {
		for _, dep := range stage.DependsOn {
			if fromID, ok := stageNodeIDs[dep]; ok {
				toID := stageNodeIDs[stage.Name]
				graph.Edges = append(graph.Edges, models.GraphEdge{
					From:  fromID,
					To:    toID,
					Label: "depends_on",
					Type:  "sequential",
				})
			}
		}
	}

	// If no explicit dependencies, create sequential edges
	if len(graph.Edges) == 0 && len(def.Spec.Stages) > 1 {
		names := make([]string, 0, len(def.Spec.Stages))
		for _, stage := range def.Spec.Stages {
			names = append(names, stage.Name)
		}
		for i := 0; i < len(names)-1; i++ {
			graph.Edges = append(graph.Edges, models.GraphEdge{
				From:  stageNodeIDs[names[i]],
				To:    stageNodeIDs[names[i+1]],
				Label: "depends_on",
				Type:  "sequential",
			})
		}
	}

	return graph
}