package engine

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"orion/platform-svc-go/internal/ai/llm-provider"
)

// Orchestrator coordinates the execution of an OrchestrationDAG.
//
// It implements:
//   - Topological scheduling of leaf AgentNodes.
//   - Grouping node support (PARALLEL / SEQUENTIAL).
//   - SUPERVISOR mode: a supervisor node decides which child to run next.
//   - CRITIC mode: evaluation gates on minScore thresholds.
//   - Automatic provider degradation via ProviderRegistry.Call().
//   - Per-node retry with backoff for retriable errors.
//   - Timeout enforcement (per-node and overall).
type Orchestrator struct {
	registry *llmprovider.ProviderRegistry
	logger   *zap.Logger

	executor *agentExecutor

	mu sync.RWMutex

	// Running stores active run metadata keyed by run ID.
	running map[string]*runState
}

// runState holds transient execution data for a single run.
type runState struct {
	ctx       context.Context
	cancel    context.CancelFunc
	dag       *OrchestrationDAG
	execCtx   *ExecutionContext
	result    *RunResult
	done      atomic.Bool
	created   time.Time
}

// NewOrchestrator creates an orchestrator with the given LLM ProviderRegistry.
func NewOrchestrator(registry *llmprovider.ProviderRegistry, logger *zap.Logger) *Orchestrator {
	oe := &Orchestrator{
		registry: registry,
		logger:   logger,
		running:  make(map[string]*runState),
	}
	oe.executor = NewAgentExecutor(registry, logger)
	return oe
}

// RegisterTool registers a tool across all runs.
func (o *Orchestrator) RegisterTool(name string, fn ToolFn) {
	o.executor.RegisterTool(name, fn)
}

// Execute runs an orchestration DAG to completion and returns the aggregated result.
func (o *Orchestrator) Execute(
	parentCtx context.Context,
	dag *OrchestrationDAG,
	input map[string]interface{},
	opts RunOptions,
) *RunResult {
	// Validation.
	if dag == nil {
		return &RunResult{Status: "failed", Error: "nil DAG"}
	}
	if err := dag.DAG.Validate(); err != nil {
		return &RunResult{Status: "failed", Error: fmt.Sprintf("DAG validation failed: %s", err.Error())}
	}

	runID := uuid.New().String()[:8]

	// Execution context.
	execCtx := &ExecutionContext{
		Values:      input,
		RunID:       runID,
		OrchID:      dag.ID,
		NodeResults: make(map[string]*NodeResult),
	}

	// Overall timeout.
	ctx := parentCtx
	cancel := func() {}
	if opts.TimeoutSec > 0 {
		ctx, cancel = context.WithTimeout(ctx, time.Duration(opts.TimeoutSec)*time.Second)
	}

	result := &RunResult{
		RunID:        runID,
		OrchID:       dag.ID,
		NodeResults:  execCtx.NodeResults,
		ExecutionLog: []string{fmt.Sprintf("run %s started for orchestration %s (%s)", runID, dag.ID, dag.Name)},
	}

	o.mu.Lock()
	state := &runState{
		ctx:     ctx,
		cancel:  cancel,
		dag:     dag,
		execCtx: execCtx,
		result:  result,
		created: time.Now(),
	}
	o.running[runID] = state
	o.mu.Unlock()
	defer func() {
		cancel()
		o.mu.Lock()
		delete(o.running, runID)
		o.mu.Unlock()
	}()

	o.logger.Info("orchestration run started",
		zap.String("runId", runID),
		zap.String("orchId", dag.ID),
		zap.Int("nodeCount", len(dag.DAG.Nodes)),
	)

	// Determine max steps.
	maxSteps := dag.MaxSteps
	if maxSteps == 0 {
		maxSteps = len(dag.DAG.Nodes) * 3 // generous default
	}
	if opts.MaxSteps > 0 {
		maxSteps = opts.MaxSteps
	}

	// Dry run mode.
	if opts.DryRun {
		result.ExecutionLog = append(result.ExecutionLog, "dry-run mode: skipping LLM calls")
		// Still walk the DAG to validate structure.
		o.executeDAG(ctx, dag, execCtx, maxSteps, result, true)
		result.Status = "completed"
		return result
	}

	// Execute the DAG.
	o.executeDAG(ctx, dag, execCtx, maxSteps, result, false)

	// Finalize.
	if result.Status == "" {
		result.Status = "completed"
	}
	result.ExecutionLog = append(result.ExecutionLog,
		fmt.Sprintf("run %s finished with status=%s (%d nodes executed)",
			runID, result.Status, len(result.NodeResults)),
	)

	o.logger.Info("orchestration run finished",
		zap.String("runId", runID),
		zap.String("status", result.Status),
		zap.Int("nodes", len(result.NodeResults)),
	)

	return result
}

// GetRun returns the current run state for a given run ID, or nil if not found.
func (o *Orchestrator) GetRun(runID string) *RunResult {
	o.mu.RLock()
	defer o.mu.RUnlock()
	s, ok := o.running[runID]
	if !ok {
		return nil
	}
	return s.result
}

// Cancel stops an active run by ID.
func (o *Orchestrator) Cancel(runID string) bool {
	o.mu.RLock()
	s, ok := o.running[runID]
	o.mu.RUnlock()
	if !ok {
		return false
	}
	s.cancel()
	return true
}

// executeDAG walks the DAG and schedules node executions.
//
// Algorithm:
//   1. Find all root nodes (no incoming edges).
//   2. For each root, dispatch execution.
//   3. When a node completes, enqueue its children.
//   4. Grouping nodes (PARALLEL/SEQUENTIAL) execute their children specially.
//   5. SUPERVISOR nodes use their decision to select the next child.
//   6. CRITIC nodes gate downstream execution on score.
func (o *Orchestrator) executeDAG(
	ctx context.Context,
	dag *OrchestrationDAG,
	execCtx *ExecutionContext,
	maxSteps int,
	result *RunResult,
	dryRun bool,
) {
	steps := 0
	completed := make(map[string]bool)

	// Resolve the default model.
	model := dag.Model
	if model == "" {
		model = "gpt-4o-mini" // sensible default
	}
	defaultTemperature := dag.Temperature

	// Start with root nodes.
	queue := dag.DAG.rootNodes()
	for _, id := range queue {
		result.ExecutionLog = append(result.ExecutionLog,
			fmt.Sprintf("enqueue root node %s", id),
		)
	}

	for len(queue) > 0 {
		select {
		case <-ctx.Done():
			result.ExecutionLog = append(result.ExecutionLog, "context done: "+ctx.Err().Error())
			if result.Status == "" {
				if ctx.Err() == context.DeadlineExceeded {
					result.Status = "timeout"
				} else {
					result.Status = "failed"
				}
				result.Error = ctx.Err().Error()
			}
			return
		default:
		}

		if steps >= maxSteps {
			result.ExecutionLog = append(result.ExecutionLog, fmt.Sprintf("max steps reached (%d)", maxSteps))
			result.Status = "max_steps"
			result.Error = fmt.Sprintf("orchestration exceeded max steps: %d", maxSteps)
			return
		}

		nodeID := queue[0]
		queue = queue[1:]

		if completed[nodeID] {
			continue
		}

		node := dag.DAG.nodeMap()[nodeID]
		if node == nil {
			result.ExecutionLog = append(result.ExecutionLog, fmt.Sprintf("node %s not found, skipping", nodeID))
			continue
		}

		// Determine if all parents are completed (unless root).
		parents := dag.DAG.parentsOf(nodeID)
		allParentsDone := true
		for _, p := range parents {
			if !completed[p] {
				allParentsDone = false
				break
			}
		}
		// Also check CRITIC gate: if any parent is a CRITIC that failed, skip.
		criticBlocked := false
		for _, p := range parents {
			if pr, ok := execCtx.NodeResults[p]; ok && pr.NodeType == AgentTypeCritic && !pr.CriticPassed {
				criticBlocked = true
				result.ExecutionLog = append(result.ExecutionLog,
					fmt.Sprintf("node %s skipped: parent critic %s failed (score=%d)", nodeID, p, pr.CriticScore),
				)
				break
			}
		}

		if !allParentsDone || criticBlocked {
			// Re-queue: the node is not ready yet; try again after other nodes run.
			// Guard against infinite loops by checking if we made progress.
			willBlock := true
			for _, p := range parents {
				if completed[p] {
					willBlock = false
					break
				}
			}
			if !willBlock || len(parents) == 0 {
				// Some parents done, others not — re-queue.
				queue = append(queue, nodeID)
			}
			continue
		}

		steps++

		// Execute node.
		kind := groupNodeKind(node.Type)
		var nr *NodeResult

		if kind == NodeKindGrouping {
			// Grouping node — dispatch its children.
			nr = o.executeGrouping(ctx, dag, execCtx, node, model, defaultTemperature, maxSteps-steps, result, dryRun)
		} else {
			// Leaf node — execute with retry.
			nr = o.executeNodeWithRetry(ctx, node, execCtx, model, defaultTemperature, dryRun)
		}

		completed[nodeID] = true
		execCtx.NodeResults[nodeID] = nr
		result.NodeResults[nodeID] = nr

		logMsg := fmt.Sprintf("node %s (%s) → %s",
			nodeID, node.Type, map[bool]string{true: "OK", false: "FAIL"}[nr.Success])
		result.ExecutionLog = append(result.ExecutionLog, logMsg)
		if !nr.Success {
			o.logger.Error("node execution failed",
				zap.String("nodeId", nodeID),
				zap.String("error", nr.Error),
				zap.String("runId", execCtx.RunID),
			)
		}

		// SUPERVISOR: use the decision to enqueue next child.
		if node.Type == AgentTypeSupervisor {
			decision := execCtx.GetString("supervisor_decision")
			if decision != "" && decision != "DONE" {
				// Check that decision is a valid child node ID.
				if _, ok := dag.DAG.nodeMap()[decision]; ok {
					queue = append(queue, decision)
					result.ExecutionLog = append(result.ExecutionLog,
						fmt.Sprintf("supervisor %s decided: run node %s", nodeID, decision),
					)
				}
			} else {
				result.ExecutionLog = append(result.ExecutionLog,
					fmt.Sprintf("supervisor %s decision: DONE", nodeID),
				)
			}
			continue
		}

		// Enqueue children.
		children := dag.DAG.childrenOf(nodeID)
		for _, childID := range children {
			if !completed[childID] {
				queue = append(queue, childID)
				result.ExecutionLog = append(result.ExecutionLog,
					fmt.Sprintf("enqueue child %s (from %s)", childID, nodeID),
				)
			}
		}
	}

	if result.Status == "" && len(completed) > 0 {
		result.Status = "completed"
	}
}

// executeGrouping handles PARALLEL and SEQUENTIAL grouping nodes.
func (o *Orchestrator) executeGrouping(
	ctx context.Context,
	dag *OrchestrationDAG,
	execCtx *ExecutionContext,
	node *AgentNode,
	model string,
	defaultTemperature float64,
	remainingSteps int,
	result *RunResult,
	dryRun bool,
) *NodeResult {
	nr := &NodeResult{
		NodeID:   node.ID,
		NodeType: node.Type,
		Success:  false,
	}

	if len(node.Children) == 0 {
		nr.Output = "grouping node has no children"
		nr.Success = true
		return nr
	}

	childrenNodes := make([]*AgentNode, 0, len(node.Children))
	for _, cID := range node.Children {
		if c := dag.DAG.nodeMap()[cID]; c != nil {
			childrenNodes = append(childrenNodes, c)
		}
	}

	var childResults []*NodeResult
	var groupStatus string

	if node.Type == AgentTypeParallel {
		childResults, groupStatus = o.executeParallel(ctx, dag, execCtx, childrenNodes, model, defaultTemperature, dryRun)
	} else {
		childResults, groupStatus = o.executeSequential(ctx, dag, execCtx, childrenNodes, model, defaultTemperature, remainingSteps, result, dryRun)
	}

	nr.Success = groupStatus == "completed" || groupStatus == ""
	nr.Output = fmt.Sprintf("[%s] %d/ %d children completed", node.Type, len(childResults), len(childrenNodes))
	nr.Structured = map[string]interface{}{
		"grouping_type": string(node.Type),
		"children_executed": len(childResults),
		"status":         groupStatus,
	}

	if groupStatus != "" && groupStatus != "completed" {
		nr.Error = groupStatus
	}

	return nr
}

// executeParallel runs all children concurrently using goroutines + WaitGroup.
func (o *Orchestrator) executeParallel(
	ctx context.Context,
	dag *OrchestrationDAG,
	execCtx *ExecutionContext,
	children []*AgentNode,
	model string,
	defaultTemperature float64,
	dryRun bool,
) ([]*NodeResult, string) {
	var wg sync.WaitGroup
	results := make([]*NodeResult, len(children))
	errMu := sync.Mutex{}
	var groupErr string

	for i, child := range children {
		wg.Add(1)
		go func(idx int, child *AgentNode) {
			defer wg.Done()
			nr := o.executeNodeWithRetry(ctx, child, execCtx, model, defaultTemperature, dryRun)
			results[idx] = nr
			if !nr.Success && groupErr == "" {
				errMu.Lock()
				groupErr = fmt.Sprintf("child %s failed: %s", child.ID, nr.Error)
				errMu.Unlock()
			}
			o.logger.Info("parallel child completed",
				zap.String("childId", child.ID),
				zap.Bool("success", nr.Success),
				zap.String("runId", execCtx.RunID),
			)
		}(i, child)
	}

	wg.Wait()

	// Record child results in the parent's context.
	for i, r := range results {
		if r != nil {
			execCtx.NodeResults[children[i].ID] = r
		}
	}

	// Publish the aggregate output.
	allSuccess := true
	for _, r := range results {
		if r != nil && !r.Success {
			allSuccess = false
			break
		}
	}

	if groupErr == "" && !allSuccess {
		// Some succeeded but not all.
		var successOutputs []string
		var failOutputs []string
		for _, r := range results {
			if r == nil {
				continue
			}
			if r.Success {
				successOutputs = append(successOutputs, r.Output)
			} else {
				failOutputs = append(failOutputs, r.Error)
			}
		}
		groupErr = fmt.Sprintf("partial success: %d/%d children succeeded, failures: %v",
			len(successOutputs), len(results), failOutputs)
	}

	status := "completed"
	if groupErr != "" {
		status = "partial"
	}

	return results, status
}

// executeSequential runs children one after another, stopping on first failure
// unless the DAG edges suggest otherwise.
func (o *Orchestrator) executeSequential(
	ctx context.Context,
	dag *OrchestrationDAG,
	execCtx *ExecutionContext,
	children []*AgentNode,
	model string,
	defaultTemperature float64,
	remainingSteps int,
	result *RunResult,
	dryRun bool,
) ([]*NodeResult, string) {
	results := make([]*NodeResult, 0, len(children))

	for i, child := range children {
		select {
		case <-ctx.Done():
			return results, ctx.Err().Error()
		default:
		}

		if remainingSteps <= i {
			return results, fmt.Sprintf("max steps exceeded in sequential group (remaining=%d, index=%d)", remainingSteps, i)
		}

		nr := o.executeNodeWithRetry(ctx, child, execCtx, model, defaultTemperature, dryRun)
		results = append(results, nr)
		execCtx.NodeResults[child.ID] = nr
		result.NodeResults[child.ID] = nr

		result.ExecutionLog = append(result.ExecutionLog,
			fmt.Sprintf("sequential child %s → %s", child.ID, map[bool]string{true: "OK", false: "FAIL"}[nr.Success]),
		)

		// Stop on first failure.
		if !nr.Success {
			return results, fmt.Sprintf("sequential group stopped at child %s: %s", child.ID, nr.Error)
		}
	}

	return results, ""
}

// executeNodeWithRetry runs a leaf node, retrying on retriable errors.
func (o *Orchestrator) executeNodeWithRetry(
	ctx context.Context,
	node *AgentNode,
	execCtx *ExecutionContext,
	model string,
	defaultTemperature float64,
	dryRun bool,
) *NodeResult {
	if dryRun {
		nr := o.executor.Execute(ctx, node, execCtx, model, defaultTemperature)
		return nr
	}

	attempts := 0
	maxAttempts := node.MaxRetries + 1 // +1 for the initial attempt
	if maxAttempts < 1 {
		maxAttempts = 1
	}

	var lastResult *NodeResult
	for attempts < maxAttempts {
		nr := o.executor.Execute(ctx, node, execCtx, model, defaultTemperature)
		lastResult = nr

		if nr.Success {
			return nr
		}

		// Check if the error is retriable.
		if !isRetriable(errors.New(nr.Error)) {
			return nr // non-retriable: give up immediately
		}

		attempts++
		if attempts >= maxAttempts {
			break
		}

		// Backoff: 2^attempt seconds, capped at 30s.
		backoff := 1 << uint(attempts)
		if backoff > 30 {
			backoff = 30
		}
		o.logger.Warn("retrying node after retriable error",
			zap.String("nodeId", node.ID),
			zap.Int("attempt", attempts+1),
			zap.Int("maxAttempts", maxAttempts),
			zap.String("backoff", fmt.Sprintf("%ds", backoff)),
		)

		select {
		case <-ctx.Done():
			nr.Error = ctx.Err().Error()
			return nr
		case <-time.After(time.Duration(backoff) * time.Second):
		}
	}

	return lastResult
}
