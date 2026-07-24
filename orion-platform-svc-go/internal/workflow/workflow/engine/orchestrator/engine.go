package orchestrator

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/workflow/workflow/engine/handler"
	"orion/platform-svc-go/internal/workflow/workflow/engine/sla"
	"orion/platform-svc-go/internal/workflow/workflow/models"

	"go.uber.org/zap"
)

// Engine orchestrates workflow step execution using the step handler factory.
// It drives the workflow instance forward, one node at a time, by dispatching
// to the appropriate StepHandler.
type Engine struct {
	factory *handler.StepHandlerFactory
	slaEngine *sla.DefaultSlaCalculateHandler
	slaMonitor *sla.SLAMonitor
	logger    *zap.Logger
}

// EngineOptions configures the execution engine.
type EngineOptions struct {
	Logger        *zap.Logger
	Factory       *handler.StepHandlerFactory
	SLACheckInterval time.Duration
}

// NewEngine creates a new execution engine.
func NewEngine(opts EngineOptions) *Engine {
	if opts.Factory == nil {
		opts.Factory = handler.GlobalFactory
	}
	return &Engine{
		factory:   opts.Factory,
		slaEngine: &sla.DefaultSlaCalculateHandler{},
		slaMonitor: sla.NewSLAMonitor(opts.SLACheckInterval),
		logger:    opts.Logger,
	}
}

// ExecuteStep runs a single workflow step and returns the result.
// This is the central method — it gets the handler for the step type,
// validates input, executes, and records the result.
func (e *Engine) ExecuteStep(ctx context.Context, taskCtx *handler.WorkflowTaskContext, stepType string, input models.JSONB) (*handler.StepResult, error) {
	// 1. Look up handler
	h, ok := e.factory.Get(stepType)
	if !ok {
		return nil, fmt.Errorf("no handler registered for step type: %s", stepType)
	}

	// 2. Validate
	if err := h.Validate(ctx, input); err != nil {
		return nil, fmt.Errorf("validation failed for step %s: %w", stepType, err)
	}

	// 3. Execute
	result, err := h.Execute(ctx, taskCtx, input)
	if err != nil {
		return nil, fmt.Errorf("step execution failed for %s: %w", stepType, err)
	}

	if e.logger != nil {
		e.logger.Info("step executed",
			zap.String("step_type", stepType),
			zap.String("node_id", taskCtx.NodeID),
			zap.String("task_id", taskCtx.TaskID),
		)
	}
	return result, nil
}

// ExecuteWorkflow runs a workflow instance to completion (or until a blocking step).
// It walks the definition's nodes sequentially and executes each one.
func (e *Engine) ExecuteWorkflow(ctx context.Context, instID, defID, tenantID string,
	input models.JSONB, definition *models.WorkflowDefinition) error {

	// Build node list from definition
	nodes := extractNodes(definition)
	if len(nodes) == 0 {
		return fmt.Errorf("no nodes in definition %s", defID)
	}

	// Workflow data aggregates state across steps
	workflowData := models.JSONB{"input": input, "startTime": time.Now().Format(time.RFC3339)}

	for i, node := range nodes {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		stepType := ""
		if t, ok := getNodeField(node, "type").(string); ok {
			stepType = t
		}
		stepConfig := models.JSONB{}
		if c, ok := getNodeField(node, "config").(map[string]interface{}); ok {
			stepConfig = models.JSONB(c)
		}

		// Build task context for this step
		taskCtx := &handler.WorkflowTaskContext{
			TenantID:     tenantID,
			InstanceID:   instID,
			DefinitionID: defID,
			NodeID:       fmt.Sprintf("node-%d", i),
			TaskID:       fmt.Sprintf("task-%s-%d", instID, i),
			StepName:     fmt.Sprintf("step-%d", i),
			StepConfig:   stepConfig,
			WorkflowData: workflowData,
			Variables:    models.JSONB{},
		}

		// Execute step
		result, err := e.ExecuteStep(ctx, taskCtx, stepType, models.JSONB{})
		if err != nil {
			return fmt.Errorf("workflow halted at step %d (%s): %w", i, stepType, err)
		}

		// Merge output into workflow data
		for k, v := range result.Output {
			workflowData[k] = v
		}

		// If next_node_id is nil, this step is waiting (e.g., human approval)
		if result.NextNodeID == nil {
            // Step is blocking — return; caller should resume later
            if e.logger != nil {
                e.logger.Info("workflow paused at step",
                    zap.String("step_type", stepType),
                    zap.String("instance_id", instID),
                )
            }
            return nil
        }
	}

	return nil
}

// ComputeSLA computes the SLA result for a task using the configured SLA engine.
func (e *Engine) ComputeSLA(ctx context.Context, slaConfig *sla.SLAConfig, task *sla.TaskContext) (*sla.SLAResult, error) {
	return e.slaEngine.Calculate(ctx, slaConfig, task, time.Now())
}

// GetSLAMonitor returns the SLA monitor for registering/unregistering tasks.
func (e *Engine) GetSLAMonitor() *sla.SLAMonitor {
	return e.slaMonitor
}

// SLAMonitor() starts the background SLA monitoring loop.
func (e *Engine) RunSLAMonitor(ctx context.Context, callback sla.SLABreachCallback) error {
	return e.slaMonitor.Run(ctx, callback)
}

// ========== Helpers ==========

// extractNodes pulls the nodes array from a WorkflowDefinition's Nodes JSONB.
func extractNodes(def *models.WorkflowDefinition) []models.JSONB {
	if def.Nodes == nil {
		return nil
	}
	if nodes, ok := def.Nodes["nodes"].([]interface{}); ok {
		result := make([]models.JSONB, len(nodes))
		for i, n := range nodes {
            if m, ok := n.(map[string]interface{}); ok {
                result[i] = models.JSONB(m)
            }
		}
		return result
	}
	return nil
}

// getNodeField is a safe getter for a JSONB field.
func getNodeField(node models.JSONB, key string) interface{} {
	if node == nil {
		return nil
	}
	return node[key]
}
