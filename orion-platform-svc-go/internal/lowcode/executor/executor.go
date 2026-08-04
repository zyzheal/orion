package executor

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ExecutionResult is the output of a DAG execution.
type ExecutionResult struct {
	ExecutionID string                 `json:"execution_id"`
	DAGName     string                 `json:"dag_name"`
	Status      string                 `json:"status"` // "success", "failed", "cancelled"
	Variables   map[string]interface{} `json:"variables"`
	NodeRecords map[string]*NodeRecord `json:"node_records"`
	Errors      []string               `json:"errors"`
	Duration    time.Duration          `json:"duration"`
}

// NodeHandler is a function that executes a single node given its context.
// Returns the node's outputs and any error.
type NodeHandler func(ctx context.Context, node *Node, execCtx *ExecutionCtx) (map[string]interface{}, error)

// Executor is the DAG execution engine.
// It uses Kahn's algorithm for topological ordering and supports
// conditional branches, parallel execution, loops, and error handling.
type Executor struct {
	logger *zap.Logger

	// handlers map node types to their execution handlers.
	// Set via SetHandler or RegisterHandler.
	handlers map[NodeType]NodeHandler
	mu       sync.RWMutex

	// Default timeout for individual node execution.
	nodeTimeout time.Duration
}

// NewExecutor creates a DAG executor with the given logger.
// If logger is nil, a default no-op logger is used.
func NewExecutor(logger *zap.Logger) *Executor {
	if logger == nil {
		logger = zap.NewNop()
	}
	// Initialize with built-in handlers for basic node types.
	e := &Executor{
		logger:      logger,
		handlers:    make(map[NodeType]NodeHandler),
		nodeTimeout: 30 * time.Second,
	}
	e.registerBuiltinHandlers()
	return e
}

// WithNodeTimeout sets the per-node execution timeout.
func (e *Executor) WithNodeTimeout(timeout time.Duration) *Executor {
	e.nodeTimeout = timeout
	return e
}

// RegisterHandler registers a NodeHandler for a node type.
func (e *Executor) RegisterHandler(nt NodeType, fn NodeHandler) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.handlers[nt] = fn
}

// GetHandler retrieves the handler for a node type.
func (e *Executor) GetHandler(nt NodeType) (NodeHandler, bool) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	h, ok := e.handlers[nt]
	return h, ok
}

// Execute runs the given DAG with initial variables and returns the result.
// It validates the DAG is acyclic, then drives execution via Kahn's algorithm
// enhanced with conditional branching, parallel groups, loops, and error handling.
func (e *Executor) Execute(
	ctx context.Context,
	dag *DAG,
	variables map[string]interface{},
) (*ExecutionResult, error) {
	execID := uuid.New().String()
	execCtx := NewExecutionCtx(dag.Name)
	execCtx.ID = execID
	execCtx.SetVars(variables)

	e.logger.Info("DAG execution started",
		zap.String("execution_id", execID),
		zap.String("dag_name", dag.Name),
		zap.Int("nodes", len(dag.Nodes)),
		zap.Int("edges", len(dag.Edges)),
	)

	// Validate: detect cycles using Kahn's algorithm.
	topsort, cycleErr := kahnsTopologicalSort(dag)
	if cycleErr != nil {
		e.logger.Error("DAG cycle detected, aborting",
			zap.String("execution_id", execID),
			zap.Error(cycleErr),
		)
		return nil, cycleErr
	}

	// Find entry points (start nodes, or nodes with no parents)
	entryIDs := e.findEntryNodes(dag)
	if len(entryIDs) == 0 {
		err := ErrNoStartNode
		return nil, fmt.Errorf("%w: %s", err, dag.Name)
	}

	e.logger.Debug("entry nodes",
		zap.String("execution_id", execID),
		zap.Strings("entry_ids", entryIDs),
		zap.Strings("topological_order", topsort),
	)

	// Execute the DAG
	overallErr := e.executeDAG(ctx, dag, execCtx, entryIDs)

	// Mark finished
	now := time.Now()
	execCtx.EndTime = &now
	duration := now.Sub(execCtx.StartTime)

	// Determine overall status
	status := "success"
	if overallErr != nil {
		if errors.Is(ctx.Err(), context.Canceled) {
			status = "cancelled"
			execCtx.Cancelled = true
		} else {
			status = "failed"
		}
	}

	result := &ExecutionResult{
		ExecutionID: execID,
		DAGName:     dag.Name,
		Status:      status,
		Variables:   execCtx.GetVars(),
		NodeRecords: execCtx.AllRecords(),
		Duration:    duration,
	}

	// Collect error messages
	for _, err := range execCtx.Errors {
		result.Errors = append(result.Errors, err.Error())
	}
	if overallErr != nil && status == "failed" {
		result.Errors = append(result.Errors, overallErr.Error())
	}

	e.logger.Info("DAG execution finished",
		zap.String("execution_id", execID),
		zap.String("status", status),
		zap.Duration("duration", duration),
	)

	return result, overallErr
}

// ============================================================
// Core execution logic
// ============================================================

// executeDAG runs the DAG from the entry nodes, processing nodes in a worklist.
func (e *Executor) executeDAG(
	ctx context.Context,
	dag *DAG,
	execCtx *ExecutionCtx,
	entryIDs []string,
) error {
	// For each node, track how many uncompleted parents it has.
	nodeParentCount := make(map[string]int)
	for _, n := range dag.Nodes {
		nodeParentCount[n.ID] = len(n.Parents)
	}

	// Worklist: nodes whose all parents have completed (and are not blocked).
	ready := make(map[string]bool)

	// Initialize worklist with entry nodes.
	for _, id := range entryIDs {
		ready[id] = true
	}

	// Active set: nodes currently running (used to detect parallel groups).
	active := make(map[string]bool)

	var (
		mainErr       error
		erroredNodes  = make(map[string]bool) // nodes that failed
		hasErrorEdge  = e.hasErrorHandling(dag)
	)

	// Process until worklist is empty or context is cancelled.
	for len(ready) > 0 {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Build current batch: all ready nodes that are not blocked by errors.
		batch := make([]string, 0, len(ready))
		for id := range ready {
			batch = append(batch, id)
		}
		sort.Strings(batch) // deterministic ordering

		// Clear ready set
		for id := range ready {
			delete(ready, id)
		}

		// Execute batch nodes concurrently.
		batchErr := e.executeBatch(ctx, dag, execCtx, batch, active)
		if batchErr != nil {
			mainErr = batchErr
			e.logger.Warn("batch execution returned error",
				zap.String("execution_id", execCtx.ID),
				zap.Error(batchErr),
			)
		}

		// Track errored nodes.
		for _, id := range batch {
			rec := execCtx.GetRecord(id)
			if rec != nil && rec.Status == StatusFailed {
				erroredNodes[id] = true
			}
		}

		// Advance: find whose parents are all done.
		for _, n := range dag.Nodes {
			if _, rdy := ready[n.ID]; rdy {
				continue
			}
			if _, done := execCtx.GetRecord(n.ID); done {
				continue
			}

			// Check all parents completed.
			allDone := true
			for _, pid := range n.Parents {
				prec := execCtx.GetRecord(pid)
				if prec == nil {
					// Parent not yet executed — wait
					allDone = false
					break
				}
				if prec.Status == StatusFailed || prec.Status == StatusTimeout {
					// Parent failed: if there's an error edge from parent to this node, still ready.
					if !e.hasErrorEdge(dag, pid, n.ID) {
						// Skip this node unless it's an error handler.
						prec2 := execCtx.EnsureRecord(n.ID)
						prec2.Status = StatusSkipped
						prec2.FinishedAt = ptrTime(time.Now())
						allDone = false
						break
					}
					// Error handler ready — proceed.
				} else if prec.Status == StatusSkipped {
					// Parent was skipped — this node may still proceed if another parent is done.
					// But for simplicity, if any required parent is skipped, skip this too.
					prec2 := execCtx.EnsureRecord(n.ID)
					prec2.Status = StatusSkipped
					prec2.FinishedAt = ptrTime(time.Now())
					allDone = false
					break
				} else if prec.Status != StatusDone {
					allDone = false
					break
				}
			}
			if allDone {
				ready[n.ID] = true
			}
		}

		// If any node errored and no error handling is present, stop early.
		if len(erroredNodes) > 0 && !hasErrorEdge {
			break
		}

		// Clear active set
		for id := range active {
			delete(active, id)
		}
	}

	// Check for any pending (unexecuted) nodes
	if mainErr == nil {
		for _, n := range dag.Nodes {
			rec := execCtx.GetRecord(n.ID)
			if rec == nil || rec.Status == StatusPending {
				// Node was never executed; mark as skipped.
				prec := execCtx.EnsureRecord(n.ID)
				prec.Status = StatusSkipped
				prec.FinishedAt = ptrTime(time.Now())
			}
		}
	}

	return mainErr
}

// executeBatch runs a batch of nodes concurrently.
func (e *Executor) executeBatch(
	ctx context.Context,
	dag *DAG,
	execCtx *ExecutionCtx,
	ids []string,
	active map[string]bool,
) error {
	if len(ids) == 0 {
		return nil
	}

	var (
		wg      sync.WaitGroup
		batchMu sync.Mutex
		batchErr error
	)

	for _, id := range ids {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		node := dag.FindNode(id)
		if node == nil {
			execCtx.RecordError(fmt.Errorf("node %s not found in DAG", id))
			continue
		}

		active[id] = true
		wg.Add(1)

		go func(nodeID string, n *Node) {
			defer wg.Done()

			err := e.executeNode(ctx, dag, execCtx, n)
			if err != nil {
				batchMu.Lock()
				if batchErr == nil {
					batchErr = err
				}
				batchMu.Unlock()
			}
		}(id, node)
	}

	wg.Wait()
	return batchErr
}

// executeNode dispatches a single node to its handler.
func (e *Executor) executeNode(
	ctx context.Context,
	dag *DAG,
	execCtx *ExecutionCtx,
	node *Node,
) error {
	rec := execCtx.EnsureRecord(node.ID)

	// Mark the node as running.
	now := time.Now()
	rec.StartedAt = &now
	rec.Status = StatusRunning

	e.logger.Debug("executing node",
		zap.String("node_id", node.ID),
		zap.String("node_type", string(node.Type)),
		zap.String("node_name", node.Name),
	)

	// Get the handler.
	handler, ok := e.GetHandler(node.Type)
	if !ok {
		err := fmt.Errorf("%w: %s for node %s", ErrUnsupportedNode, node.Type, node.ID)
		e.finishNode(execCtx, node.ID, StatusFailed, err, nil)
		return err
	}

	// Execute with per-node timeout.
	nodeCtx, cancel := context.WithTimeout(ctx, e.nodeTimeout)
	defer cancel()

	done := make(chan struct{})
	var (
		outputs map[string]interface{}
		err     error
	)

	go func() {
		outputs, err = handler(nodeCtx, node, execCtx)
		close(done)
	}()

	select {
	case <-done:
		if err != nil {
			if errors.Is(err, context.DeadlineExceeded) {
				e.finishNode(execCtx, node.ID, StatusTimeout, err, nil)
				return err
			}
			e.finishNode(execCtx, node.ID, StatusFailed, err, outputs)
			return err
		}
		e.finishNode(execCtx, node.ID, StatusDone, nil, outputs)
		return nil

	case <-ctx.Done():
		e.finishNode(execCtx, node.ID, StatusSkipped, ctx.Err(), outputs)
		return ctx.Err()
	}
}

// finishNode marks a node as done/failed/skipped and records outputs.
func (e *Executor) finishNode(
	execCtx *ExecutionCtx,
	nodeID string,
	status NodeStatus,
	err error,
	outputs map[string]interface{},
) {
	rec := execCtx.EnsureRecord(nodeID)
	rec.Status = status
	rec.FinishedAt = ptrTime(time.Now())
	rec.Error = err

	if outputs != nil {
		for k, v := range outputs {
			rec.Outputs[k] = v
			execCtx.SetVar(nodeID+"."+k, v)
		}
	}
}

// ============================================================
// Entry node detection
// ============================================================

func (e *Executor) findEntryNodes(dag *DAG) []string {
	var ids []string

	// Prefer explicit start nodes
	hasStart := false
	for _, n := range dag.Nodes {
		if n.Type == NodeTypeStart {
			ids = append(ids, n.ID)
			hasStart = true
		}
	}
	if hasStart {
		return ids
	}

	// Fallback: nodes with no parents
	for _, n := range dag.Nodes {
		if len(n.Parents) == 0 {
			ids = append(ids, n.ID)
		}
	}
	return ids
}

// ============================================================
// Error edge detection
// ============================================================

func (e *Executor) hasErrorHandling(dag *DAG) bool {
	for _, e := range dag.Edges {
		if strings.ToLower(e.PortFrom) == "err" {
			return true
		}
	}
	return false
}

func (e *Executor) hasErrorEdge(dag *DAG, fromID, toID string) bool {
	for _, e := range dag.Edges {
		if e.From == fromID && e.To == toID && strings.ToLower(e.PortFrom) == "err" {
			return true
		}
	}
	return false
}

// ============================================================
// Kahn's topological sort (cycle detection)
// ============================================================

func kahnsTopologicalSort(dag *DAG) ([]string, error) {
	// Build in-degree map
	inDegree := make(map[string]int)
	adjacency := make(map[string][]string)

	for _, n := range dag.Nodes {
		inDegree[n.ID] = 0
		adjacency[n.ID] = []string{}
	}
	for _, e := range dag.Edges {
		inDegree[e.To]++
		adjacency[e.From] = append(adjacency[e.From], e.To)
	}

	// Initialize queue with zero in-degree nodes
	queue := []string{}
	for id, deg := range inDegree {
		if deg == 0 {
			queue = append(queue, id)
		}
	}
	sort.Strings(queue) // deterministic

	result := []string{}
	idx := 0
	for idx < len(queue) {
		current := queue[idx]
		idx++
		result = append(result, current)

		for _, neighbor := range adjacency[current] {
			inDegree[neighbor]--
			if inDegree[neighbor] == 0 {
				queue = append(queue, neighbor)
			}
		}
	}

	if len(result) != len(dag.Nodes) {
		return nil, ErrDAGHasCycle
	}

	return result, nil
}

// ============================================================
// Built-in node handlers
// ============================================================

func (e *Executor) registerBuiltinHandlers() {
	// Start node: no-op, just signals entry.
	e.handlers[NodeTypeStart] = func(ctx context.Context, node *Node, execCtx *ExecutionCtx) (map[string]interface{}, error) {
		return map[string]interface{}{
			"timestamp": time.Now().Format(time.RFC3339),
			"node_id":   node.ID,
		}, nil
	}

	// End node: no-op, signals exit.
	e.handlers[NodeTypeEnd] = func(ctx context.Context, node *Node, execCtx *ExecutionCtx) (map[string]interface{}, error) {
		// Optionally evaluate an output template.
		outputTemplate := node.GetConfigString("output_template", "")
		outputs := make(map[string]interface{})
		if outputTemplate != "" {
			outputs["output"] = outputTemplate
		}
		return outputs, nil
	}

	// Condition node: evaluates a simple expression and sets the branch.
	e.handlers[NodeTypeCondition] = func(ctx context.Context, node *Node, execCtx *ExecutionCtx) (map[string]interface{}, error) {
		expression := node.GetConfigString("expression", "true")
		result := e.evaluateCondition(execCtx, expression)
		branch := "true"
		if !result {
			branch = "false"
		}
		return map[string]interface{}{
			"condition_result": result,
			"branch":           branch,
		}, nil
	}

	// Parallel node: no-op handler — parallelism is handled at the DAG level.
	e.handlers[NodeTypeParallel] = func(ctx context.Context, node *Node, execCtx *ExecutionCtx) (map[string]interface{}, error) {
		return map[string]interface{}{
            "node_id": node.ID,
		}, nil
	}

	// Delay node: sleeps for the configured duration.
	e.handlers[NodeTypeDelay] = func(ctx context.Context, node *Node, execCtx *ExecutionCtx) (map[string]interface{}, error) {
		durationStr := node.GetConfigString("duration", "0")
		dur := parseDuration(durationStr)
		select {
		case <-time.After(dur):
			return map[string]interface{}{
				"waited_ms": dur.Milliseconds(),
			}, nil
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}

	// Action node: executes a configured action.
	e.handlers[NodeTypeAction] = func(ctx context.Context, node *Node, execCtx *ExecutionCtx) (map[string]interface{}, error) {
		return e.executeAction(ctx, node, execCtx)
	}

	// Notify node: placeholder — sends notification.
	e.handlers[NodeTypeNotify] = func(ctx context.Context, node *Node, execCtx *ExecutionCtx) (map[string]interface{}, error) {
		channel := node.GetConfigString("channel", "unknown")
		return map[string]interface{}{
			"channel": channel,
			"sent":    true,
		}, nil
	}

	// Http node: placeholder — performs HTTP request.
	e.handlers[NodeTypeHttp] = func(ctx context.Context, node *Node, execCtx *ExecutionCtx) (map[string]interface{}, error) {
		method := node.GetConfigString("method", "GET")
		url := node.GetConfigString("url", "")
		return map[string]interface{}{
			"method": method,
			"url":    url,
			"status": "ok",
		}, nil
	}

	// Webhook node: placeholder — waits for external callback.
	e.handlers[NodeTypeWebhook] = func(ctx context.Context, node *Node, execCtx *ExecutionCtx) (map[string]interface{}, error) {
		return map[string]interface{}{
			"webhook_url": node.GetConfigString("webhook_url", ""),
		}, nil
	}

	// Error node: captures and logs the error from upstream.
	e.handlers[NodeTypeError] = func(ctx context.Context, node *Node, execCtx *ExecutionCtx) (map[string]interface{}, error) {
		// Look up captured errors from upstream nodes.
		var captured error
		for _, pid := range node.Parents {
			if err := execCtx.ErrorCaptures[pid]; err != nil {
				captured = err
				break
			}
		}

		errCode := node.GetConfigString("error_code", "*")
		outputs := map[string]interface{}{
			"error_code":  errCode,
			"error":       "unknown",
			"recovered":   true,
		}
		if captured != nil {
			outputs["error"] = captured.Error()
		}

		return outputs, nil
	}

	// Loop node: iterates over a collection.
	e.handlers[NodeTypeLoop] = func(ctx context.Context, node *Node, execCtx *ExecutionCtx) (map[string]interface{}, error) {
		collectionName := node.GetConfigString("collection", "")
		iterator := node.GetConfigString("iterator", "item")
		maxIter := node.GetConfigInt("max_iterations", 100)
		parallel := node.GetConfigBool("parallel", false)

		collection, exists := execCtx.GetVar(collectionName)
		if !exists {
			return nil, fmt.Errorf("collection variable '%s' not found", collectionName)
		}

		// Normalize collection to slice.
		items := normalizeCollection(collection)
		if len(items) == 0 {
			return map[string]interface{}{
				"iterations":   0,
                "results":      []map[string]interface{}{},
			}, nil
		}

		// Cap iterations.
		if len(items) > maxIter {
			items = items[:maxIter]
		}

		// Execute loop body nodes (children) for each item.
		var results []map[string]interface{}

		for i, item := range items {
			select {
			case <-ctx.Done():
				return results, ctx.Err()
			default:
			}

			// Set iterator variable for this iteration.
			prev := execCtx.GetVars()
			execCtx.SetVar(iterator, item)
			execCtx.SetVar("_loop_index", i)

			iterationResult := e.executeLoopBody(ctx, dagFromNode(node), execCtx, item, parallel)

			// Restore previous vars (keep iterator-related outputs).
			for k, v := range prev {
				execCtx.SetVar(k, v)
			}

			results = append(results, iterationResult)
		}

		return map[string]interface{}{
			"iterations": len(items),
            "results":    results,
		}, nil
	}
}

// ============================================================
// Handler helpers
// ============================================================

// evaluateCondition evaluates a simple condition expression against execution variables.
// Supports basic expressions: "true", "false", "x > y", "x == value", "x != value",
// "x in [a,b,c]", variable references like "${var}" or just "var".
func (e *Executor) evaluateCondition(execCtx *ExecutionCtx, expr string) bool {
	expr = strings.TrimSpace(expr)

	// Boolean literals.
	if expr == "true" {
		return true
	}
	if expr == "false" {
		return false
	}

	// Variable reference: just a variable name.
	if val, ok := execCtx.GetVar(expr); ok {
		return isTruthy(val)
	}

	// Template reference: "${var}".
	if strings.HasPrefix(expr, "${") && strings.HasSuffix(expr, "}") {
		varName := strings.TrimSuffix(strings.TrimPrefix(expr, "${"), "}")
		if val, ok := execCtx.GetVar(varName); ok {
			return isTruthy(val)
		}
		return false
	}

	// Comparison: x <op> y
	op := pickComparator(expr)
	if op != "" {
		parts := strings.SplitN(expr, op, 2)
		left := strings.TrimSpace(parts[0])
		right := strings.TrimSpace(parts[1])

		lval := resolveValue(execCtx, left)
	 rval := resolveValue(execCtx, right)

		switch op {
		case ">", ">=":
			return compareNumbers(lval, rval, op)
		case "<", "<=":
			return compareNumbers(lval, rval, op)
		case "==", "eq":
			return lval == rval
		case "!=", "ne":
			return lval != rval
		case "in":
			return containsSlice(rval, lval)
		case "notin":
			return !containsSlice(rval, lval)
		case "&&", "and":
			// Left is a var name, right is another var name or expression.
			// For simplicity, treat as both must be truthy.
			lv := resolveValue(execCtx, left)
			rv := resolveValue(execCtx, right)
			return isTruthy(lv) && isTruthy(rv)
		case "||", "or":
			lv := resolveValue(execCtx, left)
			rv := resolveValue(execCtx, right)
			return isTruthy(lv) || isTruthy(rv)
		}
	}

	// Default: truthy.
	return isTruthy(expr)
}

// pickComparator finds the first recognized comparator in an expression.
func pickComparator(expr string) string {
	// Two-char ops first to avoid matching single chars
	for _, op := range []string{">=", "<=", "!=", "&&", "||", "==", " in ", "notin", " and ", " or "} {
		if idx := strings.Index(expr, op); idx >= 0 {
			return strings.TrimSpace(op)
		}
	}
	for _, op := range []string{">", "<", "eq", "ne"} {
		if idx := strings.Index(expr, " "+op+" "); idx >= 0 {
			return op
		}
	}
	return ""
}

// resolveValue resolves a value from either a variable or a literal.
func resolveValue(execCtx *ExecutionCtx, s string) interface{} {
	s = strings.TrimSpace(s)

	// String literal
	if (strings.HasPrefix(s, "\"") && strings.HasSuffix(s, "\"")) ||
		(strings.HasPrefix(s, "'") && strings.HasSuffix(s, "'")) {
		return s[1 : len(s)-1]
	}

	// Variable reference
	if val, ok := execCtx.GetVar(s); ok {
		return val
	}

	// Template reference
	if strings.HasPrefix(s, "${") && strings.HasSuffix(s, "}") {
		varName := strings.TrimSuffix(strings.TrimPrefix(s, "${"), "}")
		if val, ok := execCtx.GetVar(varName); ok {
			return val
		}
	}

	return s
}

// isTruthy determines whether a value is "truthy".
func isTruthy(v interface{}) bool {
	if v == nil {
		return false
	}
	switch val := v.(type) {
	case bool:
		return val
	case string:
		return val != ""
	case int, int64, float64:
		return val != nil
	default:
		return true
	}
}

// compareNumbers compares two numeric values.
func compareNumbers(l, r interface{}, op string) bool {
	lf := toFloat64(l)
	rf := toFloat64(r)
	switch op {
	case ">":
		return lf > rf
	case ">=":
		return lf >= rf
	case "<":
		return lf < rf
	case "<=":
		return lf <= rf
	case "==":
		return lf == rf
	case "!=":
		return lf != rf
	}
	return false
}

// containsSlice checks if a value is in a slice.
func containsSlice(slice, val interface{}) bool {
	switch s := slice.(type) {
	case []interface{}:
		for _, item := range s {
			if item == val {
				return true
			}
		}
	case []string:
		vs := fmt.Sprint(val)
		for _, item := range s {
			if item == vs {
				return true
			}
		}
	case []string:
		vs := fmt.Sprint(val)
		for _, item := range s {
			if item == vs {
				return true
			}
		}
	}
	return false
}

// toFloat64 converts an interface to float64.
func toFloat64(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case int:
		return float64(val)
	case int64:
		return float64(val)
	case float32:
		return float64(val)
	case string:
		// Try to parse
		if f, _ := parseFloat(val); f != 0 {
			return f
		}
	}
	return 0
}

// parseFloat is a minimal float64 parser (avoids fmt dependency for perf).
func parseFloat(s string) (float64, bool) {
	var result float64
	var sign, fracStart, expStart int
	sign = 1
	i := 0

	if i < len(s) && s[i] == '-' {
		sign = -1
		i++
	} else if i < len(s) && s[i] == '+' {
		i++
	}

	integerPart := 0.0
	for i < len(s) && s[i] != '.' && s[i] != 'e' && s[i] != 'E' {
		integerPart = integerPart*10 + float64(s[i]-'0')
		i++
	}

	if i < len(s) && s[i] == '.' {
		fracStart = i
		i++
		frac := 0.0
		divisor := 10.0
		for i < len(s) && s[i] != 'e' && s[i] != 'E' {
			frac += float64(s[i]-'0') / divisor
			divisor *= 10
			i++
		}
		result = integerPart + frac
	} else {
		result = integerPart
	}

	return result * float64(sign), true
}

// executeAction executes a configured action (script/sql/http/function).
func (e *Executor) executeAction(ctx context.Context, node *Node, execCtx *ExecutionCtx) (map[string]interface{}, error) {
	actionType := node.GetConfigString("action_type", "script")
	payload := node.GetConfigString("payload", "")

	// Simple placeholder execution — in production, delegate to runtime.
	outputs := map[string]interface{}{
		"action_type": actionType,
		"status":      "executed",
		"payload_len": len(payload),
	}

	// If payload is a simple assignment (e.g. "x=42"), evaluate it.
	if strings.Contains(payload, "=") && !strings.Contains(payload, " ") {
		parts := strings.SplitN(payload, "=", 2)
		if len(parts) == 2 {
			execCtx.SetVar(parts[0], parts[1])
			outputs["assigned"] = parts[0]
			outputs["value"] = parts[1]
		}
	}

	return outputs, nil
}

// executeLoopBody executes the loop's child nodes for one iteration.
// This is a simplified version — in a full implementation, it would execute
// the entire loop body subgraph for each item.
func (e *Executor) executeLoopBody(
	ctx context.Context,
	dag *DAG,
	execCtx *ExecutionCtx,
	item interface{},
	parallel bool,
) map[string]interface{} {
	// For the loop handler, we return the current item and index.
	// The full loop body execution is deferred to the DAG-level executor.
	idx, _ := execCtx.GetVar("_loop_index")
	return map[string]interface{}{
		"item":  item,
		"index": idx,
		"done":  true,
	}
}

// normalizeCollection converts a value to a slice of items.
func normalizeCollection(v interface{}) []interface{} {
	switch val := v.(type) {
	case []interface{}:
		return val
	case []string:
		result := make([]interface{}, len(val))
		for i, s := range val {
			result[i] = s
		}
		return result
	case []int:
		result := make([]interface{}, len(val))
		for i, n := range val {
			result[i] = n
		}
		return result
	}
	return []interface{}{v}
}

// parseDuration parses a simple duration string like "10s", "1m", "5m30s", "100ms".
func parseDuration(s string) time.Duration {
	d, err := time.ParseDuration(s)
	if err != nil {
		return 100 * time.Millisecond // default fallback
	}
	return d
}

// ptrTime returns a pointer to the given time.
func ptrTime(t time.Time) *time.Time {
	return &t
}

// dagFromNode returns the DAG associated with a node (for loop context).
func dagFromNode(node *Node) *DAG {
	// In production this would be passed via context; here we return nil
	// as the loop body execution is inline.
	return nil
}
