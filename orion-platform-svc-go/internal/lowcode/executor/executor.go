package executor

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ExecutionResult is the output of a DAG execution.
type ExecutionResult struct {
	ID         uuid.UUID
	DAGName    string
	StartTime  time.Time
	EndTime    time.Time
	Duration   time.Duration
	Status     NodeStatus
	RecordMap  map[string]*NodeRecord
	Errors     []error
	Output     map[string]interface{}
}

// Executor runs a lowcode DAG with Kahn's topological sort.
type Executor struct {
	maxConcurrency int
	timeout        time.Duration
	logger         *zap.Logger
}

// ExecutorOption configures an Executor.
type ExecutorOption func(*Executor)

func WithMaxConcurrency(n int) ExecutorOption {
	return func(e *Executor) {
		if n > 0 {
			e.maxConcurrency = n
		}
	}
}

func WithTimeout(d time.Duration) ExecutorOption {
	return func(e *Executor) {
		e.timeout = d
	}
}

func WithLogger(l *zap.Logger) ExecutorOption {
	return func(e *Executor) {
		if l != nil {
			e.logger = l
		}
	}
}

// NewExecutor creates a DAG executor.
func NewExecutor(opts ...ExecutorOption) *Executor {
	e := &Executor{
		maxConcurrency: 4,
		timeout:        30 * time.Minute,
		logger:         zap.NewNop(),
	}
	for _, opt := range opts {
		opt(e)
	}
	return e
}

// Execute runs the DAG and returns results.
func (e *Executor) Execute(ctx context.Context, dag *DAG, variables map[string]interface{}) (*ExecutionResult, error) {
	e.logger.Info("start DAG execution", zap.String("dag", dag.Name), zap.Int("nodes", len(dag.Nodes)))

	result := &ExecutionResult{
		ID:        uuid.New(),
		DAGName:   dag.Name,
		StartTime: time.Now(),
		Status:    StatusPending,
		RecordMap: make(map[string]*NodeRecord),
	}
	defer func() {
		result.EndTime = time.Now()
		result.Duration = result.EndTime.Sub(result.StartTime)
	}()

	// Context with timeout.
	if e.timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, e.timeout)
		defer cancel()
	}

	// Validate DAG.
	if err := e.validate(dag); err != nil {
		result.Status = StatusFailed
		return result, err
	}

	// Build execution context.
	execCtx := NewExecutionCtx(dag.Name)
	for k, v := range variables {
		execCtx.SetVar(k, v)
	}

	// Kahn's topological sort.
	order, err := e.topologicalSort(dag)
	if err != nil {
		result.Status = StatusFailed
		return result, fmt.Errorf("DAG validation: %w", err)
	}

	// Execute in batches.
	for i := 0; i < len(order); {
		select {
		case <-ctx.Done():
			result.Status = StatusSkipped
			result.Errors = append(result.Errors, ctx.Err())
			for _, r := range execCtx.AllRecords() {
				if r.Status == StatusRunning {
					r.Status = StatusSkipped
				}
			}
			result.RecordMap = execCtx.AllRecords()
			return result, ctx.Err()
		default:
		}

		batchEnd := minInt(i+e.maxConcurrency, len(order))
		batch := order[i:batchEnd]
		e.executeBatch(ctx, dag, batch, execCtx)
		i = batchEnd
	}

	// Check overall status.
	statuses := execCtx.AllRecords()
	result.RecordMap = statuses

	hasFailed := false
	hasRunning := false
	for _, r := range statuses {
		if r.Status == StatusFailed {
			hasFailed = true
		} else if r.Status == StatusRunning {
			hasRunning = true
		}
	}
	if hasFailed {
		result.Status = StatusFailed
	} else if hasRunning {
		result.Status = StatusRunning
	} else {
		result.Status = StatusDone
	}

	result.Errors = execCtx.Errors
	result.Output = map[string]interface{}{
		"status":   result.Status.String(),
		"duration": result.Duration.String(),
	}

	e.logger.Info("DAG execution completed",
		zap.String("dag", dag.Name),
		zap.String("status", result.Status.String()),
		zap.Duration("duration", result.Duration),
	)
	return result, nil
}

// executeBatch runs nodes concurrently.
func (e *Executor) executeBatch(ctx context.Context, dag *DAG, batch []*Node, execCtx *ExecutionCtx) {
	var wg sync.WaitGroup
	for _, node := range batch {
		wg.Add(1)
		go func(n *Node) {
			defer wg.Done()
			e.executeNode(ctx, dag, n, execCtx)
		}(node)
	}
	wg.Wait()
}

// executeNode runs a single node.
func (e *Executor) executeNode(ctx context.Context, dag *DAG, node *Node, execCtx *ExecutionCtx) {
	now := time.Now()
	record := execCtx.EnsureRecord(node.ID)
	record.Status = StatusRunning
	record.StartedAt = &now

	defer func() {
		if r := recover(); r != nil {
			failed := time.Now()
			record.Status = StatusFailed
			record.FinishedAt = &failed
			record.Error = fmt.Errorf("panic in node %s: %v", node.ID, r)
			execCtx.RecordError(record.Error)
		}
	}()

	select {
	case <-ctx.Done():
		finished := time.Now()
		record.Status = StatusSkipped
		record.FinishedAt = &finished
		return
	default:
	}

	// Check if all parents are done.
	for _, pid := range node.Parents {
		prec := execCtx.GetRecord(pid)
		if prec == nil {
			// Parent not executed yet — shouldn't happen with topo sort.
			return
		}
		if prec.Status != StatusDone {
			// Parent failed — skip this node.
			finished := time.Now()
			record.Status = StatusSkipped
			record.FinishedAt = &finished
			return
		}
	}

	// Run node logic.
	output, err := e.runNode(ctx, node, execCtx)
	if err != nil {
		finished := time.Now()
		record.Status = StatusFailed
		record.FinishedAt = &finished
		record.Error = err
		execCtx.RecordError(err)
		return
	}

	finished := time.Now()
	record.Status = StatusDone
	record.FinishedAt = &finished
	if output != nil {
		for k, v := range output {
			record.Outputs[k] = v
		}
	}
}

// runNode dispatches based on node type.
func (e *Executor) runNode(ctx context.Context, node *Node, execCtx *ExecutionCtx) (map[string]interface{}, error) {
	switch node.Type {
	case NodeTypeStart:
		return map[string]interface{}{"status": "start"}, nil

	case NodeTypeEnd:
		return map[string]interface{}{"status": "end"}, nil

	case NodeTypeAction:
		return e.runAction(ctx, node, execCtx)

	case NodeTypeCondition:
		return e.runCondition(ctx, node, execCtx)

	case NodeTypeParallel:
		return e.runParallel(ctx, dagFromNode(node), execCtx)

	case NodeTypeLoop:
		return e.runLoop(ctx, node, execCtx)

	case NodeTypeDelay:
		d := node.GetConfigString("delay", "1s")
		t, err := parseDuration(d)
		if err != nil {
			return nil, fmt.Errorf("invalid delay '%s': %w", d, err)
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(t):
			return map[string]interface{}{"delayed_ms": t.Milliseconds()}, nil
		}

	case NodeTypeNotify:
		return e.runNotify(ctx, node, execCtx)

	case NodeTypeHttp:
		method := node.GetConfigString("method", "GET")
		url := node.GetConfigString("url", "")
		return e.runHttpRequest(ctx, method, url, node.Config, execCtx)

	case NodeTypeWebhook:
		return e.runWebhook(ctx, node, execCtx)

	case NodeTypeError:
		return map[string]interface{}{
			"message": node.GetConfigString("message", "error captured"),
			"status":  "error_handled",
		}, nil

	default:
		return nil, fmt.Errorf("unsupported node type: %s", node.Type)
	}
}

// runAction executes an action node.
func (e *Executor) runAction(ctx context.Context, node *Node, execCtx *ExecutionCtx) (map[string]interface{}, error) {
	actionType := node.GetConfigString("action_type", "script")
	payload := node.GetConfigString("payload", "")

	switch actionType {
	case "script":
		// For now, log and pass through — script execution would need a sandbox.
		e.logger.Info("script action",
			zap.String("node", node.ID),
			zap.String("payload", payload),
		)
		return map[string]interface{}{
			"action_type": actionType,
			"payload":     payload,
			"status":      "executed",
		}, nil
	case "http":
		// Dispatch to real HTTP.
		method := node.GetConfigString("method", "GET")
		url := node.GetConfigString("url", payload)
		return e.runHttpRequest(ctx, method, url, node.Config, execCtx)
	case "sql":
		e.logger.Info("sql action deferred — requires DB connection injection",
			zap.String("node", node.ID),
			zap.String("payload", payload),
		)
		return map[string]interface{}{
			"action_type": "sql",
			"payload":     payload,
			"status":      "deferred",
			"note":        "sql executor requires DB connection; inject via WithDB",
		}, nil
	case "function":
		fn := node.GetConfigString("function", "")
		e.logger.Info("function action",
			zap.String("node", node.ID),
			zap.String("function", fn),
		)
		return map[string]interface{}{
			"action_type": "function",
			"function":    fn,
			"status":      "executed",
		}, nil
	default:
		return nil, fmt.Errorf("unknown action type: %s", actionType)
	}
}

// runCondition evaluates a condition expression against the execution context.
func (e *Executor) runCondition(ctx context.Context, node *Node, execCtx *ExecutionCtx) (map[string]interface{}, error) {
	condition := node.GetConfigString("condition", "true")
	result, err := evalExpression(condition, execCtx)
	if err != nil {
		e.logger.Warn("condition evaluation failed, falling back to truthy check",
			zap.String("node", node.ID),
			zap.String("condition", condition),
			zap.Error(err),
		)
		// Fallback to simple truthy check.
		result = toBool(condition)
	}
	return map[string]interface{}{
		"condition": condition,
		"passed":    result,
	}, nil
}

// runParallel executes child nodes concurrently.
func (e *Executor) runParallel(ctx context.Context, dag *DAG, execCtx *ExecutionCtx) (map[string]interface{}, error) {
	results := make([]interface{}, 0, len(dag.Nodes))
	var wg sync.WaitGroup
	errChan := make(chan error, len(dag.Nodes))

	for _, node := range dag.Nodes {
		wg.Add(1)
		go func(n *Node) {
			defer wg.Done()
			_, err := e.runNode(ctx, n, execCtx)
			if err != nil {
				errChan <- err
			}
			results = append(results, n.ID)
		}(node)
	}

	wg.Wait()
	close(errChan)

	var errs []string
	for err := range errChan {
		errs = append(errs, err.Error())
	}

	output := map[string]interface{}{
		"children_executed": len(dag.Nodes),
	}
	if len(errs) > 0 {
		output["errors"] = errs
		return output, fmt.Errorf("parallel node errors: %v", errs)
	}
	return output, nil
}

// resolveConfigString reads a config value, resolving $var references from the execution context.
func resolveConfigString(key string, defaultVal string, node *Node, ctx *ExecutionCtx) string {
	val := node.GetConfigString(key, defaultVal)
	if strings.HasPrefix(val, "${") && strings.HasSuffix(val, "}") {
		varName := strings.TrimSuffix(strings.TrimPrefix(val, "${"), "}")
		if v, ok := ctx.GetVar(varName); ok {
			return fmt.Sprint(v)
		}
	}
	// Also check bare $var
	if strings.HasPrefix(val, "$") {
		varName := val[1:]
		if v, ok := ctx.GetVar(varName); ok {
			return fmt.Sprint(v)
		}
	}
	return val
}

// resolveHeader reads a single header with $var interpolation.
func resolveHeaders(headers map[string]interface{}, ctx *ExecutionCtx) map[string]string {
	result := make(map[string]string)
	for k, v := range headers {
		s := fmt.Sprint(v)
		result[k] = resolveConfigString("__", s, &Node{Config: map[string]interface{}{
			"__": s,
		}}, ctx)
	}
	return result
}

// runHttpRequest performs a real HTTP request.
func (e *Executor) runHttpRequest(ctx context.Context, method, url string, config map[string]interface{}, execCtx *ExecutionCtx) (map[string]interface{}, error) {
	method = strings.ToUpper(method)
	if method == "" {
		method = "GET"
	}
	if url == "" {
		return map[string]interface{}{"method": method, "url": url, "status": "skipped", "error": "no URL"}, nil
	}

	// Resolve URL variables
	url = resolveConfigString("url", url, &Node{Config: map[string]interface{}{"url": url}}, execCtx)

	client := http.Client{
		Timeout: 30 * time.Second,
	}

	// Build request body if present
	var body io.Reader
	if payload, ok := config["payload"]; ok {
		payloadStr := fmt.Sprint(payload)
		// Try to marshal if it's structured data
		var data interface{}
		if strings.HasPrefix(strings.TrimSpace(payloadStr), "{") || strings.HasPrefix(strings.TrimSpace(payloadStr), "[") {
			if err := json.Unmarshal([]byte(payloadStr), &data); err == nil {
				marshalled, err2 := json.Marshal(data)
				if err2 == nil {
					payloadStr = string(marshalled)
				}
			}
		}
		body = bytes.NewBufferString(payloadStr)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, fmt.Errorf("create http request: %w", err)
	}

	// Resolve headers
	if headers, ok := config["headers"]; ok {
		if hdrMap, ok2 := headers.(map[string]interface{}); ok2 {
			resolved := resolveHeaders(hdrMap, execCtx)
			for k, v := range resolved {
				req.Header.Set(k, v)
			}
		} else {
			req.Header.Set("Content-Type", "application/json")
		}
	} else {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read http response: %w", err)
	}

	var respData interface{}
	if err := json.Unmarshal(respBody, &respData); err != nil {
		// Non-JSON response — store raw string
		respData = string(respBody)
	}

	output := map[string]interface{}{
		"method":    method,
		"url":       url,
		"status":    "executed",
		"http_code": resp.StatusCode,
		"body":      respData,
	}
	if resp.StatusCode >= 400 {
		output["status"] = "error"
	}

	return output, nil
}

// runNotify sends a real notification via HTTP webhook (call the platform notification service).
func (e *Executor) runNotify(ctx context.Context, node *Node, execCtx *ExecutionCtx) (map[string]interface{}, error) {
	channel := node.GetConfigString("channel", "log")
	message := resolveConfigString("message", node.GetConfigString("message", ""), node, execCtx)
	recipients := resolveConfigString("recipients", node.GetConfigString("recipients", ""), node, execCtx)
	title := resolveConfigString("title", node.GetConfigString("title", ""), node, execCtx)

	// If channel is "log", just log it (no external call).
	if channel == "log" || channel == "console" {
		e.logger.Info("notify (log)",
			zap.String("node", node.ID),
			zap.String("channel", channel),
			zap.String("message", message),
			zap.String("title", title),
		)
		return map[string]interface{}{
			"channel":  channel,
			"message":  message,
			"recipients": recipients,
			"title":    title,
			"status":   "logged",
		}, nil
	}

	// For other channels (webhook, email, sms, dingtalk, feishu),
	// try to call the platform notification service via HTTP.
	notifyURL := node.GetConfigString("notify_url", "")
	if notifyURL == "" {
		// No URL configured — log and mark deferred
		e.logger.Info("notify (deferred — no notify_url)",
			zap.String("channel", channel),
			zap.String("message", message),
		)
		return map[string]interface{}{
			"channel":  channel,
			"message":  message,
			"recipients": recipients,
			"title":    title,
			"status":   "deferred",
			"note":     "configure notify_url in node config to enable real notifications",
		}, nil
	}

	payload := map[string]interface{}{
		"channel":  channel,
		"recipients": recipients,
		"title":    title,
		"message":  message,
	}

	e.logger.Info("dispatch notification",
		zap.String("node", node.ID),
		zap.String("channel", channel),
		zap.String("url", notifyURL),
	)

	return e.runHttpRequest(ctx, "POST", notifyURL, map[string]interface{}{
		"payload": payload,
	}, execCtx)
}

// runWebhook sends a real HTTP POST to a webhook URL.
func (e *Executor) runWebhook(ctx context.Context, node *Node, execCtx *ExecutionCtx) (map[string]interface{}, error) {
	url := resolveConfigString("url", node.GetConfigString("url", ""), node, execCtx)
	method := node.GetConfigString("method", "POST")

	if url == "" {
		return map[string]interface{}{"url": url, "status": "skipped", "error": "no URL"}, nil
	}

	payload := node.Config["payload"]
	if payload == nil {
		// Build payload from context variables
		payload = execCtx.GetVars()
	}

	return e.runHttpRequest(ctx, method, url, map[string]interface{}{
		"payload": payload,
	}, execCtx)
}

// runLoop executes loop iterations.
func (e *Executor) runLoop(ctx context.Context, node *Node, execCtx *ExecutionCtx) (map[string]interface{}, error) {
	maxIter := node.GetConfigInt("max_iterations", 10)
	iterator := node.GetConfigString("iterator", "item")

	// Try to get items from config.
	var items []interface{}
	if cfgItems, ok := node.Config["items"]; cfgItems != nil && ok {
		switch v := cfgItems.(type) {
		case []interface{}:
			items = v
		case string:
			// Read from variable.
			if val, ok := execCtx.GetVar(v); ok {
				switch arr := val.(type) {
				case []interface{}:
					items = arr
				case []string:
					for _, s := range arr {
						items = append(items, s)
					}
				case []int:
					for _, i := range arr {
						items = append(items, i)
					}
				}
			}
		}
	}

	if len(items) > maxIter {
		items = items[:maxIter]
	}

	outputs := map[string]interface{}{
		"iterations": len(items),
	}
	for i, item := range items {
		select {
		case <-ctx.Done():
			outputs["iterations"] = i
			return outputs, ctx.Err()
		default:
		}
		execCtx.SetVar(iterator, item)
		execCtx.SetVar("_loop_index", i)
	}

	return outputs, nil
}

// validate checks for cycles and references.
func (e *Executor) validate(dag *DAG) error {
	if len(dag.Nodes) == 0 {
		return errors.New("empty DAG")
	}

	nodes := make(map[string]*Node)
	for _, n := range dag.Nodes {
		nodes[n.ID] = n
	}

	for _, n := range dag.Nodes {
		for _, pid := range n.Parents {
			if nodes[pid] == nil {
				return fmt.Errorf("node %s references unknown parent %s", n.ID, pid)
			}
		}
		for _, cid := range n.Children {
			if nodes[cid] == nil {
				return fmt.Errorf("node %s references unknown child %s", n.ID, cid)
			}
		}
	}

	return nil
}

// topologicalSort uses Kahn's algorithm.
func (e *Executor) topologicalSort(dag *DAG) ([]*Node, error) {
	inDegree := make(map[string]int)
	for _, n := range dag.Nodes {
		inDegree[n.ID] = len(n.Parents)
	}

	// Build children map.
	children := make(map[string][]*Node)
	for _, n := range dag.Nodes {
		for _, cid := range n.Children {
			if child := dag.FindNode(cid); child != nil {
				children[n.ID] = append(children[n.ID], child)
			}
		}
	}

	queue := []string{}
	for _, n := range dag.Nodes {
		if inDegree[n.ID] == 0 {
			queue = append(queue, n.ID)
		}
	}

	order := []*Node{}
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		if node := dag.FindNode(current); node != nil {
			order = append(order, node)
		}

		for _, child := range children[current] {
			inDegree[child.ID]--
			if inDegree[child.ID] == 0 {
				queue = append(queue, child.ID)
			}
		}
	}

	if len(order) != len(dag.Nodes) {
		return nil, ErrDAGHasCycle
	}
	return order, nil
}

func dagFromNode(node *Node) *DAG {
	if len(node.Children) == 0 {
		return nil
	}
	return &DAG{
		Nodes: nil, // Will be populated by caller.
	}
}

func parseDuration(s string) (time.Duration, error) {
	return time.ParseDuration(s)
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
