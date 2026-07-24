package templates

import (
	"orion/platform-svc-go/internal/graphviz/graph"
)

// TopologyTemplate generates a network topology graph template.
type TopologyTemplate struct {
}

// Name returns the template identifier.
func (t *TopologyTemplate) Name() string {
	return "topology"
}

// Description returns the template description.
func (t *TopologyTemplate) Description() string {
	return "Network topology: devices, connections, and traffic paths"
}

// Direction returns the default graph direction.
func (t *TopologyTemplate) Direction() string {
	return "LR"
}

// Layout returns the default layout engine.
func (t *TopologyTemplate) Layout() string {
	return "neato"
}

// Apply builds a Graph using the topology template.
func (t *TopologyTemplate) Apply(nodes map[string]NodeParam, edges []EdgeParam) *graph.Graph {
	g := graph.NewGraph("network-topology")
	g.TemplateID = t.Name()
	g.Direction = t.Direction()
	g.Layout = t.Layout()

	for id, np := range nodes {
		shape := defaultShape(np.Type)
		n := &graph.Node{
			ID:    id,
			Label: np.Label,
			Type:  np.Type,
			Shape: shape,
			Color: np.Color,
		}
		g.Nodes = append(g.Nodes, n)
	}

	for _, ep := range edges {
		style := ep.Style
		if style == "" {
			style = "solid"
		}
		g.Links = append(g.Links, &graph.Link{
			Source:   ep.Source,
			Target:   ep.Target,
			Label:    ep.Label,
			Type:     ep.Type,
			Directed: ep.Directed,
			Style:    style,
			Color:    ep.Color,
		})
	}

	return g
}
