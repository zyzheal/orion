package graph

import (
	"fmt"
	"time"
)

// Point represents a 2D position for automatic layout.
type Point struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// Node represents a single element in a graph.
type Node struct {
	ID       string            `json:"id"`
	Label    string            `json:"label"`
	Type     string            `json:"type"` // "server", "service", "database", "network", "person", "container"
	Attrs    map[string]string `json:"attrs,omitempty"`
	Position *Point            `json:"position,omitempty"`
	// Optional visual hints
	Shape    string `json:"shape,omitempty"`    // "ellipse", "box", "diamond", "record"
	Color    string `json:"color,omitempty"`
	Tooltip  string `json:"tooltip,omitempty"`
	Image    string `json:"image,omitempty"`    // icon image url
	Children []string `json:"children,omitempty"`
}

// Link represents a directed or undirected edge between two nodes.
type Link struct {
	ID       string            `json:"id,omitempty"`
	Source   string            `json:"source"`
	Target   string            `json:"target"`
	Label    string            `json:"label,omitempty"`
	Type     string            `json:"type"` // "deploys", "depends_on", "communicates_via", "belongs_to"
	Directed bool              `json:"directed"`
	Attrs    map[string]string `json:"attrs,omitempty"`
	// Optional visual hints
	Style    string `json:"style,omitempty"` // "solid", "dashed", "dotted"
	Color    string `json:"color,omitempty"`
}

// Graph is the top-level graph container.
type Graph struct {
	Name       string   `json:"name"`
	Direction  string   `json:"direction"` // "TB" (top-bottom) | "LR" (left-right) | "BT" | "RL"
	Nodes      []*Node  `json:"nodes"`
	Links      []*Link  `json:"links"`
	TemplateID string   `json:"template_id,omitempty"`
	// Layout engine: "dot", "neato", "fdp", "sfdp", "twopi", "circo"
	Layout string `json:"layout,omitempty"`
}

// NewGraph creates a Graph with initialized slices.
func NewGraph(name string) *Graph {
	return &Graph{
		Name:      name,
		Direction: "TB",
		Nodes:     make([]*Node, 0),
		Links:     make([]*Link, 0),
		Layout:    "dot",
	}
}

// Validate checks for orphan references and returns errors.
func (g *Graph) Validate() []error {
	var errs []error
	nodeIDs := make(map[string]bool)
	for _, n := range g.Nodes {
		if n.ID == "" {
			errs = append(errs, fmt.Errorf("node has empty ID"))
		}
		nodeIDs[n.ID] = true
	}
	for _, l := range g.Links {
		if !nodeIDs[l.Source] {
			errs = append(errs, fmt.Errorf("link source node '%s' not found", l.Source))
		}
		if !nodeIDs[l.Target] {
			errs = append(errs, fmt.Errorf("link target node '%s' not found", l.Target))
		}
	}
	return errs
}

// PersistentGraph is the stored representation with tenant metadata.
type PersistentGraph struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	TemplateID  string    `json:"template_id" db:"template_id"`
	Direction   string    `json:"direction" db:"direction"`
	Layout      string    `json:"layout" db:"layout"`
	// Raw JSON blobs for nodes/links
	NodesJSON   string    `json:"-" db:"nodes_json"`
	LinksJSON   string    `json:"-" db:"links_json"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}
