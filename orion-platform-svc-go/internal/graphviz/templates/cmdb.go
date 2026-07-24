package templates

import (
	"orion/platform-svc-go/internal/graphviz/graph"
)

// CMDBTemplate generates a CMDB relationship graph template.
type CMDBTemplate struct {
}

// Name returns the template identifier.
func (t *CMDBTemplate) Name() string {
	return "cmdb"
}

// Description returns the template description.
func (t *CMDBTemplate) Description() string {
	return "CMDB relationship graph: CI assets, dependencies, and associations"
}

// Direction returns the default graph direction.
func (t *CMDBTemplate) Direction() string {
	return "LR"
}

// Layout returns the default layout engine.
func (t *CMDBTemplate) Layout() string {
	return "sfdp"
}

// Apply builds a Graph using the CMDB template.
func (t *CMDBTemplate) Apply(nodes map[string]NodeParam, edges []EdgeParam) *graph.Graph {
	g := graph.NewGraph("cmdb-relationships")
	g.TemplateID = t.Name()
	g.Direction = t.Direction()
	g.Layout = t.Layout()

	for id, np := range nodes {
		shape := defaultShape(np.Type)
		n := &graph.Node{
			ID:      id,
			Label:   np.Label,
			Type:    np.Type,
			Shape:   shape,
			Color:   np.Color,
			Tooltip: np.ToolTip,
		}
		g.Nodes = append(g.Nodes, n)
	}

	for _, ep := range edges {
		g.Links = append(g.Links, &graph.Link{
			Source:   ep.Source,
			Target:   ep.Target,
			Label:    ep.Label,
			Type:     ep.Type,
			Directed: ep.Directed,
			Style:    ep.Style,
			Color:    ep.Color,
		})
	}

	return g
}
