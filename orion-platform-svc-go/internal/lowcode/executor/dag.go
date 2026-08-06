package executor

import "fmt"

// Node represents a single node in a lowcode DAG workflow.
// It mirrors the schema-level FlowNode but is optimized for runtime execution.
type Node struct {
	ID       string                 // unique node identifier
	Name     string                 // human-readable name
	Type     NodeType               // semantic node type
	Inputs   map[string]interface{} // upstream outputs keyed by edge source
	Outputs  map[string]interface{} // node's execution outputs
	Config   map[string]interface{} // node-specific configuration (properties from schema)
	Children []string               // downstream node IDs
	Parents  []string               // upstream node IDs
}

// NodeType identifies the kind of execution node.
// Matches schema.NodeType constants.
type NodeType string

const (
	NodeTypeStart     NodeType = "start"
	NodeTypeEnd       NodeType = "end"
	NodeTypeAction    NodeType = "action"
	NodeTypeCondition NodeType = "condition"
	NodeTypeParallel  NodeType = "parallel"
	NodeTypeLoop      NodeType = "loop"
	NodeTypeDelay     NodeType = "delay"
	NodeTypeNotify    NodeType = "notify"
	NodeTypeHttp      NodeType = "http"
	NodeTypeWebhook   NodeType = "webhook"
	NodeTypeError     NodeType = "error"
)

// Edge represents a directed connection between two nodes.
// Optional Condition controls conditional branching.
type Edge struct {
	ID        string       // unique edge identifier
	From      string       // source node ID
	To        string       // target node ID
	PortFrom  string       // output port on source node (e.g. "true", "false", "out")
	PortTo    string       // input port on target node
	Condition *string      // expression to evaluate; if non-nil and falsy, edge is not traversed
	Label     string       // display label on the edge
}

// FlowNodeDef is the JSON-deserializable flow node definition (from DB).
type FlowNodeDef struct {
	ID         string      `json:"id"`
	Name       string      `json:"name"`
	Type       string      `json:"type"`
	Properties interface{} `json:"properties"`
}

// FlowEdgeDef is the JSON-deserializable flow edge definition (from DB).
type FlowEdgeDef struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
}

// DAG is the execution graph: a collection of nodes and edges.
// The executor assumes the DAG is acyclic (cycles are detected at construction).
type DAG struct {
	Name     string   // DAG name for logging
	Nodes    []*Node  // all nodes
	Edges    []*Edge  // all edges
	Inputs   []string // input port variable names
	Outputs  []string // output port variable names
}

// Error definitions for executor operations.
var (
	ErrDAGHasCycle       = fmt.Errorf("DAG contains cycle")
	ErrNodeNotFound      = fmt.Errorf("node not found")
	ErrNoStartNode       = fmt.Errorf("no start node found")
	ErrUnknownNodeType   = fmt.Errorf("unknown node type")
	ErrUnsupportedNode   = fmt.Errorf("unsupported node type for execution")
)

// NewDAG creates a DAG from node and edge lists, computing parent/child relationships.
func NewDAG(nodes []*Node, edges []*Edge) *DAG {
	dag := &DAG{
		Nodes: nodes,
		Edges: edges,
	}

	// Build adjacency
	children := make(map[string][]string)
	parents := make(map[string][]string)

	for _, e := range edges {
		children[e.From] = append(children[e.From], e.To)
		parents[e.To] = append(parents[e.To], e.From)
	}

	for _, n := range nodes {
		n.Children = children[n.ID]
		n.Parents = parents[n.ID]
	}

	return dag
}

// FindNode returns the node with the given ID, or nil.
func (d *DAG) FindNode(id string) *Node {
	for _, n := range d.Nodes {
		if n.ID == id {
			return n
		}
	}
	return nil
}

// EdgesFrom returns all outgoing edges from a node.
func (d *DAG) EdgesFrom(fromID string) []*Edge {
	var result []*Edge
	for _, e := range d.Edges {
		if e.From == fromID {
			result = append(result, e)
		}
	}
	return result
}

// StartNodes returns all nodes with no parents (entry points).
func (d *DAG) StartNodes() []*Node {
	var result []*Node
	for _, n := range d.Nodes {
		if len(n.Parents) == 0 {
			result = append(result, n)
		}
	}
	return result
}

// GetConfigInt reads an integer config value with a default fallback.
func (n *Node) GetConfigInt(key string, defaultVal int) int {
	if v, ok := n.Config[key].(float64); ok {
		return int(v)
	}
	if v, ok := n.Config[key].(int); ok {
		return v
	}
	return defaultVal
}

// GetConfigString reads a string config value with a default fallback.
func (n *Node) GetConfigString(key string, defaultVal string) string {
	if v, ok := n.Config[key].(string); ok {
		return v
	}
	return defaultVal
}

// GetConfigBool reads a bool config value with a default fallback.
func (n *Node) GetConfigBool(key string, defaultVal bool) bool {
	if v, ok := n.Config[key].(bool); ok {
		return v
	}
	return defaultVal
}

// IsTerminal returns true if the node is a terminal node (no children or end type).
func (n *Node) IsTerminal() bool {
	return n.Type == NodeTypeEnd || len(n.Children) == 0
}
