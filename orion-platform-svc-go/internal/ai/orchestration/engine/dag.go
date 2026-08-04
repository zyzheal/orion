package engine

import (
	"encoding/json"
	"fmt"
	"strings"
)

// NodeID uniquely identifies a node within a DAG.
type NodeID string

// EdgeDirection indicates whether an edge goes from source to target.
type EdgeDirection string

// Condition is a predicate evaluated at runtime to decide whether a downstream
// edge should be followed. nil means unconditionally follow the edge.
type Condition func(ctx ExecutionContext) bool

// AgentType identifies what kind of work a node performs.
type AgentType string

const (
	AgentTypeLLMChat    AgentType = "LLM_CHAT"
	AgentTypeToolCall   AgentType = "TOOL_CALL"
	AgentTypeHumanReview AgentType = "HUMAN_REVIEW"
	AgentTypeParallel   AgentType = "PARALLEL"
	AgentTypeSequential AgentType = "SEQUENTIAL"
	AgentTypeSupervisor AgentType = "SUPERVISOR"
	AgentTypeCritic     AgentType = "CRITIC"
)

// Validate returns an error if the agent type is not recognized.
func (t AgentType) Validate() error {
	switch t {
	case AgentTypeLLMChat, AgentTypeToolCall, AgentTypeHumanReview,
		AgentTypeParallel, AgentTypeSequential, AgentTypeSupervisor, AgentTypeCritic:
		return nil
	}
	return fmt.Errorf("unknown agent type: %s", t)
}

// NodeKind describes the topological role of a node (leaf vs grouping).
type NodeKind string

const (
	NodeKindLeaf     NodeKind = "leaf"
	NodeKindGrouping NodeKind = "grouping" // PARALLEL / SEQUENTIAL
)

// DAG represents a directed acyclic graph of AgentNodes.
type DAG struct {
	Nodes []AgentNode
	Edges []DAGEdge
}

// AgentNode is a single unit of work in the orchestration DAG.
type AgentNode struct {
	ID          string                `json:"id"`
	Name        string                `json:"name"`
	Type        AgentType             `json:"type"`
	Prompt      string                `json:"prompt"`
	Model       string                `json:"model"`               // optional; empty = registry default
	Temperature float64               `json:"temperature"`         // optional; 0.0 = provider default
	MaxTokens   int                   `json:"maxTokens"`
	Inputs      map[string]interface{} `json:"inputs"`             // static input bindings
	Outputs     []string              `json:"outputs"`             // output keys that this node publishes
	Tools       []ToolDef             `json:"tools"`
	// Grouping nodes (PARALLEL/SEQUENTIAL) list their child node IDs.
	Children []string `json:"children"`
	// CRITIC: criteria for evaluation (comma-separated string or JSON array).
	CriticCriteria string `json:"criticCriteria"`
	// CRITIC: minimum score required to pass (0-100); 0 = skip pass/fail.
	MinScore int `json:"minScore"`
	// Timeout seconds for this node; 0 = use orchestrator default.
	TimeoutSec int `json:"timeoutSec"`
	// MaxRetries for transient failures; 0 = no retry.
	MaxRetries int `json:"maxRetries"`
	// SystemPrompt overrides the global system prompt for this node.
	SystemPrompt string `json:"systemPrompt"`
}

// ToolDef describes a tool available to a node.
type ToolDef struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

// DAGEdge connects a source node to a target node, optionally guarded by a condition.
type DAGEdge struct {
	From string `json:"from"`
	To   string `json:"to"`
	// Label is optional metadata on the edge (e.g. "approved", "rejected").
	Label string `json:"label"`
}

// OrchestrationDAG is the compiled DAG that the Orchestrator consumes.
type OrchestrationDAG struct {
	ID          string              `json:"id"`
	Name        string              `json:"name"`
	Description string              `json:"description"`
	DAG         DAG                 `json:"dag"`
	Model       string              `json:"model"`           // default model for all LLM nodes
	Temperature float64             `json:"temperature"`     // default temperature
	MaxSteps    int                 `json:"maxSteps"`        // maximum number of node executions
	TimeoutSec  int                 `json:"timeoutSec"`      // overall timeout
}

// nodeMap returns a lookup map for the nodes.
func (dag *DAG) nodeMap() map[string]*AgentNode {
	m := make(map[string]*AgentNode, len(dag.Nodes))
	for i := range dag.Nodes {
		m[dag.Nodes[i].ID] = &dag.Nodes[i]
	}
	return m
}

// Validate checks structural integrity: every edge references known nodes, and the
// graph is acyclic.
func (dag *DAG) Validate() error {
	nm := dag.nodeMap()
	// Check edge node references.
	adj := make(map[string][]string, len(nm))
	for _, n := range dag.Nodes {
		adj[n.ID] = []string{}
	}
	for _, e := range dag.Edges {
		if _, ok := nm[e.From]; !ok {
			return fmt.Errorf("edge source not found: %s", e.From)
		}
		if _, ok := nm[e.To]; !ok {
			return fmt.Errorf("edge target not found: %s", e.To)
		}
		adj[e.From] = append(adj[e.From], e.To)
	}
	// Check node types.
	for _, n := range dag.Nodes {
		if err := n.Type.Validate(); err != nil {
			return fmt.Errorf("node %s: %w", n.ID, err)
		}
	}
	// Check children for grouping nodes.
	for _, n := range dag.Nodes {
		kind := groupNodeKind(n.Type)
		if kind == NodeKindGrouping {
			for _, childID := range n.Children {
				if _, ok := nm[childID]; !ok {
					return fmt.Errorf("node %s: child %s not found", n.ID, childID)
				}
			}
		}
	}
	// Detect cycles (DFS).
	seen := make(map[string]bool)
	stack := make(map[string]bool)
	var visit func(id string) error
	visit = func(id string) error {
		if stack[id] {
			return fmt.Errorf("cycle detected at node %s", id)
		}
		if seen[id] {
			return nil
		}
		stack[id] = true
		defer func() { stack[id] = false }()
		seen[id] = true
		for _, next := range adj[id] {
			if err := visit(next); err != nil {
				return err
			}
		}
		return nil
	}
	for id := range adj {
		if err := visit(id); err != nil {
			return err
		}
	}
	return nil
}

// rootNodes returns nodes with no incoming edges (natural entry points).
func (dag *DAG) rootNodes() []string {
	nm := dag.nodeMap()
	hasIncoming := make(map[string]bool, len(nm))
	for _, e := range dag.Edges {
		hasIncoming[e.To] = true
	}
	var roots []string
	for _, n := range dag.Nodes {
		if !hasIncoming[n.ID] {
			roots = append(roots, n.ID)
		}
	}
	return roots
}

// childrenOf returns the adjacent successors of a node, in edge order.
func (dag *DAG) childrenOf(id string) []string {
	var out []string
	for _, e := range dag.Edges {
		if e.From == id {
			out = append(out, e.To)
		}
	}
	return out
}

// parentsOf returns the predecessors of a node.
func (dag *DAG) parentsOf(id string) []string {
	var out []string
	for _, e := range dag.Edges {
		if e.To == id {
			out = append(out, e.From)
		}
	}
	return out
}

// groupNodeKind returns whether a node type is a grouping node.
func groupNodeKind(t AgentType) NodeKind {
	switch t {
	case AgentTypeParallel, AgentTypeSequential:
		return NodeKindGrouping
	default:
		return NodeKindLeaf
	}
}

// ExecutionContext holds the runtime context passed to each node execution and
// to edge conditions. Data flows between nodes via this context.
type ExecutionContext struct {
	// Values stores key-value pairs propagated through the DAG.
	Values map[string]interface{}
	// RunID identifies the current orchestration run.
	RunID string
	// OrchID identifies the orchestration.
	OrchID string
	// NodeResults stores the result of each completed node, keyed by node ID.
	NodeResults map[string]*NodeResult
}

// Get retrieves a value from context by key.
func (ctx *ExecutionContext) Get(key string) interface{} {
	if ctx.Values == nil {
		return nil
	}
	return ctx.Values[key]
}

// Set stores a value in the context.
func (ctx *ExecutionContext) Set(key string, val interface{}) {
	if ctx.Values == nil {
		ctx.Values = make(map[string]interface{})
	}
	ctx.Values[key] = val
}

// GetString retrieves a string value, returning the empty string if absent.
func (ctx *ExecutionContext) GetString(key string) string {
	if v, ok := ctx.Get(key).(string); ok {
		return v
	}
	return ""
}

// NodeResult holds the output of executing a single AgentNode.
type NodeResult struct {
	NodeID    string                 `json:"nodeId"`
	NodeType  AgentType              `json:"nodeType"`
	Output    string                 `json:"output"`          // LLM response content
	Structured map[string]interface{} `json:"structured"`     // parsed structured output
	ToolsUsed []ToolCall             `json:"toolsUsed"`      // tools invoked during this node
	Error     string                 `json:"error,omitempty"`
	Success   bool                   `json:"success"`
	// For CRITIC nodes: the evaluation score (0-100).
	CriticScore int `json:"criticScore,omitempty"`
	// For CRITIC nodes: whether the output passed the threshold.
	CriticPassed bool `json:"criticPassed,omitempty"`
}

// ToolCall records a single tool invocation within a node.
type ToolCall struct {
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments"`
	Result    string                 `json:"result"`
}

// RunResult aggregates the outcome of a full orchestration run.
type RunResult struct {
	RunID        string           `json:"runId"`
	OrchID       string           `json:"orchId"`
	Status       string           `json:"status"` // "completed" | "failed" | "timeout" | "max_steps"
	NodeResults  map[string]*NodeResult `json:"nodeResults"`
	ExecutionLog []string          `json:"executionLog"`
	Error        string            `json:"error,omitempty"`
}

// MarshalValues serializes the execution context values to JSON bytes.
func (ctx *ExecutionContext) MarshalValues() ([]byte, error) {
	return json.Marshal(ctx.Values)
}

// MarshalResult serializes the full run result to JSON bytes.
func (r *RunResult) MarshalJSON() ([]byte, error) {
	return json.Marshal(r)
}

// formatAgentConfig converts an external AgentConfig to an AgentNode for
// backward compatibility with the existing models.AgentConfig.
func formatAgentConfig(ac AgentConfigInput) AgentNode {
	return AgentNode{
		ID:     ac.ID,
		Name:   ac.Name,
		Type:   AgentType(ac.Type),
		Prompt: ac.Prompt,
		// Capabilities and Config fields are carried as a JSON blob in
		// Inputs for backward compatibility.
		Inputs: map[string]interface{}{
			"capabilities": ac.Capabilities,
			"config":       ac.Config,
		},
	}
}

// AgentConfigInput is the shape accepted from the external models.AgentConfig.
type AgentConfigInput struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Type         string `json:"type"` // planner, executor, reviewer, tool
	Capabilities string `json:"capabilities"`
	Config       string `json:"config"`
	Prompt       string `json:"prompt"`
	Model        string `json:"model"`
	MaxTokens    int    `json:"maxTokens"`
	Tools        string `json:"tools"`
}

// splitCSV splits a comma-separated string into trimmed non-empty parts.
func splitCSV(s string) []string {
	if s == "" {
		return nil
	}
	var out []string
	for _, part := range strings.Split(s, ",") {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

// RunOptions configures how an orchestration run behaves.
type RunOptions struct {
	TimeoutSec int  `json:"timeoutSec"`
	MaxSteps   int  `json:"maxSteps"`
	Parallel   bool `json:"parallel"`
	DryRun     bool `json:"dryRun"`
}

// NewRunOptions creates engine.RunOptions from raw values.
func NewRunOptions(timeoutSec, maxSteps int, parallel, dryRun bool) RunOptions {
	return RunOptions{
		TimeoutSec: timeoutSec,
		MaxSteps:   maxSteps,
		Parallel:   parallel,
		DryRun:     dryRun,
	}
}
