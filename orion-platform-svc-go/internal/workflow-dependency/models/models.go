package models

// DependencyGraph is the full dependency analysis result.
type DependencyGraph struct {
	IsSafe           bool    `json:"isSafe"`
	TotalDefinitions int     `json:"totalDefinitions"`
	TotalEdges       int     `json:"totalEdges"`
	Cycles           []Cycle `json:"cycles"`
}

// Cycle represents a single circular dependency cycle.
type Cycle struct {
	Nodes       []string `json:"nodes"`
	Description string   `json:"description"`
}

// DependencyCheck is the result for a single workflow definition.
type DependencyCheck struct {
	DefinitionId string   `json:"definitionId"`
	IsSafe       bool     `json:"isSafe"`
	Dependencies []string `json:"dependencies"`
	Cycles       []Cycle  `json:"cycles"`
}

// VisualizationData holds graph visualization data.
type VisualizationData struct {
	Nodes []VisNode `json:"nodes"`
	Edges []VisEdge `json:"edges"`
}

// VisNode is a node in the visualization graph.
type VisNode struct {
	Id    string `json:"id"`
	Name  string `json:"name"`
	Group string `json:"group"`
}

// VisEdge is an edge in the visualization graph.
type VisEdge struct {
	Source string `json:"source"`
	Target string `json:"target"`
	Weight int    `json:"weight"`
}

// WorkflowDefinitionRow is a lightweight row for dependency analysis.
type WorkflowDefinitionRow struct {
	ID        string `db:"id" json:"id"`
	Name      string `db:"name" json:"name"`
	NodesJSON string `db:"nodes" json:"-"`
	EdgesJSON string `db:"edges" json:"-"`
}