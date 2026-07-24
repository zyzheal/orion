package graph

import (
	"fmt"
	"strings"
)

// GraphBuilder provides a fluent API for constructing graphs programmatically.
type GraphBuilder struct {
	g *Graph
}

// NewBuilder creates a new GraphBuilder with the given graph name.
func NewBuilder(name string) *GraphBuilder {
	return &GraphBuilder{g: NewGraph(name)}
}

// Direction sets the graph layout direction: "TB", "LR", "BT", "RL".
func (b *GraphBuilder) Direction(dir string) *GraphBuilder {
	b.g.Direction = dir
	return b
}

// Layout sets the layout engine: "dot", "neato", "fdp", "sfdp", "twopi", "circo".
func (b *GraphBuilder) Layout(layout string) *GraphBuilder {
	b.g.Layout = layout
	return b
}

// TemplateID sets the template identifier for the graph.
func (b *GraphBuilder) Template(id string) *GraphBuilder {
	b.g.TemplateID = id
	return b
}

// AddNode adds a node to the graph.
func (b *GraphBuilder) AddNode(n *Node) *GraphBuilder {
	if n == nil {
		return b
	}
	if n.Type == "" {
		n.Type = "default"
	}
	b.g.Nodes = append(b.g.Nodes, n)
	return b
}

// AddLink adds a directed edge between source and target with an optional label and type.
func (b *GraphBuilder) AddLink(source, target, linkType string) *GraphBuilder {
	b.g.Links = append(b.g.Links, &Link{
		Source:   source,
		Target:   target,
		Type:     linkType,
		Directed: true,
	})
	return b
}

// AddLinkWithLabel adds a directed edge with a label.
func (b *GraphBuilder) AddLinkWithLabel(source, target, linkType, label string) *GraphBuilder {
	b.g.Links = append(b.g.Links, &Link{
		Source:   source,
		Target:   target,
		Type:     linkType,
		Label:    label,
		Directed: true,
	})
	return b
}

// AddUndirectedLink adds an undirected edge between source and target.
func (b *GraphBuilder) AddUndirectedLink(source, target, linkType string) *GraphBuilder {
	b.g.Links = append(b.g.Links, &Link{
		Source:   source,
		Target:   target,
		Type:     linkType,
		Directed: false,
	})
	return b
}

// AddLabelledLink adds a link with full customization.
func (b *GraphBuilder) AddLabelledLink(link *Link) *GraphBuilder {
	b.g.Links = append(b.g.Links, link)
	return b
}

// Build validates and returns the constructed Graph.
func (b *GraphBuilder) Build() (*Graph, error) {
	errs := b.g.Validate()
	if len(errs) > 0 {
		msgs := make([]string, len(errs))
		for i, e := range errs {
			msgs[i] = e.Error()
		}
		return nil, fmt.Errorf("graph validation failed: %s", strings.Join(msgs, "; "))
	}
	return b.g, nil
}

// Graph returns the current Graph (may contain validation errors).
func (b *GraphBuilder) Graph() *Graph {
	return b.g
}

// NodeCount returns the number of nodes.
func (b *GraphBuilder) NodeCount() int {
	return len(b.g.Nodes)
}

// LinkCount returns the number of links.
func (b *GraphBuilder) LinkCount() int {
	return len(b.g.Links)
}
