package renderer

import (
	"fmt"
	"orion/platform-svc-go/internal/graphviz/graph"
	"strings"
)

// DOTRenderer renders a Graph into DOT format (no external dependencies).
type DOTRenderer struct {
	graph *graph.Graph
}

// NewDOTRenderer creates a new DOTRenderer for the given Graph.
func NewDOTRenderer(g *graph.Graph) *DOTRenderer {
	return &DOTRenderer{graph: g}
}

// Render produces a DOT format string representation of the graph.
func (r *DOTRenderer) Render() string {
	var sb strings.Builder
	sb.WriteString("digraph \"")
	sb.WriteString(sanitize(r.graph.Name))
	sb.WriteString("\" {\n")
	sb.WriteString("  rankdir=")
	sb.WriteString(r.graph.Direction)
	sb.WriteString(";\n")
	sb.WriteString("  fontname=\"Helvetica\";\n")
	sb.WriteString("  node [fontname=\"Helvetica\"];\n")
	sb.WriteString("  edge [fontname=\"Helvetica\"];\n\n")

	// Render subgraphs (containers) first
	r.renderSubgraphs(&sb)

	// Render nodes
	for _, n := range r.graph.Nodes {
		sb.WriteString("  ")
		sb.WriteString(sanitize(n.ID))
		sb.WriteString(" [")
		sb.WriteString("label=\"")
		sb.WriteString(sanitize(n.Label))
		sb.WriteString("\"")

		shape := n.Shape
		if shape == "" {
			shape = shapeForType(n.Type)
		}
		sb.WriteString(", shape=")
		sb.WriteString(shape)

		if n.Color != "" {
			sb.WriteString(fmt.Sprintf(", color=\"%s\"", n.Color))
		}
		if n.Tooltip != "" {
			sb.WriteString(fmt.Sprintf(", tooltip=\"%s\"", sanitize(n.Tooltip)))
		}
		if n.Image != "" {
			sb.WriteString(fmt.Sprintf(", image=\"%s\"", n.Image))
		}
		for k, v := range n.Attrs {
			sb.WriteString(fmt.Sprintf(", %s=\"%s\"", k, sanitize(v)))
		}
		sb.WriteString("];\n")
	}

	// Render edges
	for _, l := range r.graph.Links {
		sb.WriteString("  ")
		sb.WriteString(sanitize(l.Source))
		sb.WriteString(" -> ")
		sb.WriteString(sanitize(l.Target))
		sb.WriteString(" [")
		sb.WriteString(fmt.Sprintf("label=\"%s\"", sanitize(l.Label)))
		if !l.Directed {
			sb.WriteString(", arrowhead=none")
		}
		if l.Style != "" {
			sb.WriteString(fmt.Sprintf(", style=\"%s\"", l.Style))
		}
		if l.Color != "" {
			sb.WriteString(fmt.Sprintf(", color=\"%s\"", l.Color))
		}
		for k, v := range l.Attrs {
			sb.WriteString(fmt.Sprintf(", %s=\"%s\"", k, sanitize(v)))
		}
		sb.WriteString("];\n")
	}

	sb.WriteString("}\n")
	return sb.String()
}

// RenderAsUndirected produces DOT using "graph" instead of "digraph".
func (r *DOTRenderer) RenderAsUndirected() string {
	var sb strings.Builder
	sb.WriteString("graph \"")
	sb.WriteString(sanitize(r.graph.Name))
	sb.WriteString("\" {\n")
	sb.WriteString("  rankdir=")
	sb.WriteString(r.graph.Direction)
	sb.WriteString(";\n")
	sb.WriteString("  node [fontname=\"Helvetica\"];\n")
	sb.WriteString("  edge [fontname=\"Helvetica\"];\n\n")

	for _, n := range r.graph.Nodes {
		sb.WriteString("  ")
		sb.WriteString(sanitize(n.ID))
		sb.WriteString(" [label=\"")
		sb.WriteString(sanitize(n.Label))
		sb.WriteString("\"")
		shape := n.Shape
		if shape == "" {
			shape = shapeForType(n.Type)
		}
		sb.WriteString(fmt.Sprintf(", shape=%s", shape))
		sb.WriteString("];\n")
	}

	for _, l := range r.graph.Links {
		sb.WriteString("  ")
		sb.WriteString(sanitize(l.Source))
		sb.WriteString(" -- ")
		sb.WriteString(sanitize(l.Target))
		sb.WriteString(" [label=\"")
		sb.WriteString(sanitize(l.Label))
		sb.WriteString("\"];\n")
	}

	sb.WriteString("}\n")
	return sb.String()
}

// sanitize escapes special characters for DOT strings.
func sanitize(s string) string {
	return strings.ReplaceAll(s, "\"", "\\\"")
}

// shapeForType returns a default DOT shape for a node type.
func shapeForType(t string) string {
	switch t {
	case "server":
		return "box"
	case "database":
		return "cylinder"
	case "network":
		return "diamond"
	case "person":
		return "ellipse"
	case "container":
		return "note"
	case "process":
		return "box"
	case "service":
		return "ellipse"
	default:
		return "ellipse"
	}
}

// renderSubgraphs handles container-style grouping (future extensibility).
func (r *DOTRenderer) renderSubgraphs(_ *strings.Builder) {
	// For now, this is a no-op. Future: nested graph support.
}
