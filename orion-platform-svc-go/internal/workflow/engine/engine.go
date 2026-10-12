package engine

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// NodeStatus represents the execution status of a workflow node.
type NodeStatus string

const (
	NodeStatusPending  NodeStatus = "pending"
	NodeStatusRunning  NodeStatus = "running"
	NodeStatusSuccess  NodeStatus = "success"
	NodeStatusFailed   NodeStatus = "failed"
	NodeStatusSkipped  NodeStatus = "skipped"
)

// Node represents a single node in a workflow graph.
type Node struct {
	ID     string            `json:"id"`
	Name   string            `json:"name"`
	Type   string            `json:"type"`
	Status NodeStatus        `json:"status"`
	Input  map[string]any    `json:"input,omitempty"`
	Output map[string]any    `json:"output,omitempty"`
	Error  string            `json:"error,omitempty"`
	StartedAt *time.Time     `json:"startedAt,omitempty"`
	CompletedAt *time.Time   `json:"completedAt,omitempty"`
}

// Edge represents a directed edge in a workflow graph.
type Edge struct {
	Source string `json:"source"`
	Target string `json:"target"`
	Label  string `json:"label,omitempty"`
}

// WorkflowGraph is a directed acyclic graph (DAG) of workflow nodes.
type WorkflowGraph struct {
	Nodes []Node `json:"nodes"`
	Edges []Edge `json:"edges"`
}

// ExecuteResult contains the result of a workflow execution.
type ExecuteResult struct {
	WorkflowID string     `json:"workflowId"`
	Status     NodeStatus `json:"status"`
	Nodes      []Node     `json:"nodes"`
	Errors     []string   `json:"errors"`
	Duration   time.Duration `json:"duration"`
}

// NodeExecutor is the SPI for executing individual workflow nodes.
type NodeExecutor interface {
	ExecuteNode(ctx context.Context, node *Node, inputs map[string]any) (map[string]any, error)
}

// Engine orchestrates workflow execution by traversing the DAG.
type Engine struct {
	logger    *zap.Logger
	executor  NodeExecutor
}

func NewEngine(logger *zap.Logger, executor NodeExecutor) *Engine {
	return &Engine{logger: logger, executor: executor}
}

// Execute traverses the workflow DAG, executing nodes in topological order.
// Respects edges: a node is only executed when all its predecessors are done.
func (e *Engine) Execute(ctx context.Context, workflowID string, graph *WorkflowGraph) (*ExecuteResult, error) {
	start := time.Now()

	// Build adjacency list and in-degree map
	adj := make(map[string][]string)
	inDegree := make(map[string]int)
	nodeMap := make(map[string]*Node)

	for i := range graph.Nodes {
		nodeMap[graph.Nodes[i].ID] = &graph.Nodes[i]
		graph.Nodes[i].Status = NodeStatusPending
		inDegree[graph.Nodes[i].ID] = 0
		adj[graph.Nodes[i].ID] = make([]string, 0)
	}

	for _, edge := range graph.Edges {
		if _, ok := nodeMap[edge.Source]; !ok {
			continue
		}
		if _, ok := nodeMap[edge.Target]; !ok {
			continue
		}
		adj[edge.Source] = append(adj[edge.Source], edge.Target)
		inDegree[edge.Target]++
	}

	// Topological sort using Kahn's algorithm
	queue := make([]string, 0)
	for id, deg := range inDegree {
		if deg == 0 {
			queue = append(queue, id)
		}
	}

	result := &ExecuteResult{
		WorkflowID: workflowID,
		Nodes:      graph.Nodes,
	}

	executed := 0
	for len(queue) > 0 {
		select {
		case <-ctx.Done():
			return result, ctx.Err()
		default:
		}

		nodeID := queue[0]
		queue = queue[1:]
		node := nodeMap[nodeID]
		if node == nil {
			continue
		}

		// Execute node
		now := time.Now()
		node.Status = NodeStatusRunning
		node.StartedAt = &now

		output, err := e.executor.ExecuteNode(ctx, node, node.Input)
		now = time.Now()
		node.CompletedAt = &now

		if err != nil {
			node.Status = NodeStatusFailed
			node.Error = err.Error()
			result.Errors = append(result.Errors, fmt.Sprintf("node %s: %v", node.ID, err))
			// Skip downstream nodes on failure
			e.skipDownstream(nodeID, adj, nodeMap)
		} else {
			node.Status = NodeStatusSuccess
			node.Output = output
			executed++
			// Decrement in-degree for successors
			for _, succ := range adj[nodeID] {
				inDegree[succ]--
				if inDegree[succ] == 0 {
					queue = append(queue, succ)
				}
			}
		}
	}

	if len(result.Errors) > 0 {
		result.Status = NodeStatusFailed
	} else {
		result.Status = NodeStatusSuccess
	}
	result.Duration = time.Since(start)

	e.logger.Info("workflow execution completed",
		zap.String("workflowId", workflowID),
		zap.Int("executed", executed),
		zap.Int("errors", len(result.Errors)),
		zap.Duration("duration", result.Duration),
	)

	return result, nil
}

// skipDownstream marks all downstream nodes of a failed node as skipped.
func (e *Engine) skipDownstream(nodeID string, adj map[string][]string, nodeMap map[string]*Node) {
	visited := make(map[string]bool)
	var dfs func(id string)
	dfs = func(id string) {
		if visited[id] {
			return
		}
		visited[id] = true
		for _, succ := range adj[id] {
			if node, ok := nodeMap[succ]; ok && node.Status == NodeStatusPending {
				node.Status = NodeStatusSkipped
				node.Error = "upstream node failed"
			}
			dfs(succ)
		}
	}
	dfs(nodeID)
}

// ValidateGraph checks for cycles and orphaned edges.
func (e *Engine) ValidateGraph(graph *WorkflowGraph) error {
	nodeSet := make(map[string]bool)
	for _, n := range graph.Nodes {
		nodeSet[n.ID] = true
	}

	// Check for orphaned edges
	for _, edge := range graph.Edges {
		if !nodeSet[edge.Source] || !nodeSet[edge.Target] {
			return fmt.Errorf("edge references unknown node: %s->%s", edge.Source, edge.Target)
		}
	}

	// Check for cycles using DFS
	color := make(map[string]int) // 0=white, 1=gray, 2=black
	adj := make(map[string][]string)
	for _, edge := range graph.Edges {
		adj[edge.Source] = append(adj[edge.Source], edge.Target)
	}

	var dfs func(id string) bool
	dfs = func(id string) bool {
		color[id] = 1
		for _, succ := range adj[id] {
			if color[succ] == 1 {
				return true // back edge = cycle
			}
			if color[succ] == 0 {
				if dfs(succ) {
					return true
				}
			}
		}
		color[id] = 2
		return false
	}

	for _, n := range graph.Nodes {
		if color[n.ID] == 0 {
			if dfs(n.ID) {
				return fmt.Errorf("cycle detected at node %s", n.ID)
			}
		}
	}

	return nil
}

// NodeExecutorFunc is a function adapter for NodeExecutor.
type NodeExecutorFunc func(ctx context.Context, node *Node, inputs map[string]any) (map[string]any, error)

func (f NodeExecutorFunc) ExecuteNode(ctx context.Context, node *Node, inputs map[string]any) (map[string]any, error) {
	return f(ctx, node, inputs)
}

// DefaultNodeExecutor returns a pass-through executor that returns inputs as output.
func DefaultNodeExecutor() NodeExecutor {
	return NodeExecutorFunc(func(ctx context.Context, node *Node, inputs map[string]any) (map[string]any, error) {
		if inputs == nil {
			inputs = make(map[string]any)
		}
		return inputs, nil
	})
}

// Ensure uuid is used for future extensions
var _ = uuid.New
