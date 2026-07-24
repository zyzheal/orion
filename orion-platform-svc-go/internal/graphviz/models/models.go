package models

import "time"

// Graph represents a stored graph record.
type Graph struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	TemplateID  string    `json:"template_id" db:"template_id"`
	Direction   string    `json:"direction" db:"direction"`
	Layout      string    `json:"layout" db:"layout"`
	NodesJSON   string    `json:"-" db:"nodes_json"`
	LinksJSON   string    `json:"-" db:"links_json"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// CreateGraphRequest is the input for creating a new graph.
type CreateGraphRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description"`
	TemplateID  string                 `json:"template_id"`
	Direction   string                 `json:"direction"`
	Layout      string                 `json:"layout"`
	Nodes       []GraphNodeRequest     `json:"nodes"`
	Links       []GraphLinkRequest     `json:"links"`
}

// UpdateGraphRequest is the input for updating an existing graph.
type UpdateGraphRequest struct {
	Name        *string                `json:"name"`
	Description *string                `json:"description"`
	Direction   *string                `json:"direction"`
	Nodes       []GraphNodeRequest     `json:"nodes"`
	Links       []GraphLinkRequest     `json:"links"`
}

// GraphNodeRequest carries node data for create/update.
type GraphNodeRequest struct {
	ID       string            `json:"id"`
	Label    string            `json:"label"`
	Type     string            `json:"type"`
	Shape    string            `json:"shape"`
	Color    string            `json:"color"`
	ToolTip  string            `json:"tooltip"`
	Image    string            `json:"image"`
	Position *GraphPoint       `json:"position"`
	Attrs    map[string]string `json:"attrs"`
}

// GraphLinkRequest carries link data for create/update.
type GraphLinkRequest struct {
	ID       string            `json:"id"`
	Source   string            `json:"source"`
	Target   string            `json:"target"`
	Label    string            `json:"label"`
	Type     string            `json:"type"`
	Directed bool              `json:"directed"`
	Style    string            `json:"style"`
	Color    string            `json:"color"`
	Attrs    map[string]string `json:"attrs"`
}

// GraphPoint represents a 2D coordinate.
type GraphPoint struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// BuildRequest carries parameters for building a graph from a template.
type BuildRequest struct {
	TemplateID string                  `json:"template_id" binding:"required"`
	Name       string                  `json:"name"`
	Nodes      map[string]GraphNodeData `json:"nodes"`
	Edges      []GraphEdgeData         `json:"edges"`
}

// GraphNodeData is simplified node data for template building.
type GraphNodeData struct {
	Label   string `json:"label"`
	Type    string `json:"type"`
	Color   string `json:"color"`
	ToolTip string `json:"tooltip"`
}

// GraphEdgeData is simplified edge data for template building.
type GraphEdgeData struct {
	Source   string `json:"source"`
	Target   string `json:"target"`
	Label    string `json:"label"`
	Type     string `json:"type"`
	Directed bool   `json:"directed"`
}

// RenderRequest carries render parameters.
type RenderRequest struct {
	Format string `json:"format" binding:"required"` // "dot", "svg", "json"
}

// GraphListResponse is the output for listing graphs.
type GraphListResponse struct {
	Graphs []GraphSummary `json:"graphs"`
	Total  int            `json:"total"`
}

// GraphSummary is a minimal graph summary.
type GraphSummary struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	TemplateID string    `json:"template_id"`
	Direction  string    `json:"direction"`
	NodeCount  int       `json:"node_count"`
	LinkCount  int       `json:"link_count"`
	CreatedAt  time.Time `json:"created_at"`
}
