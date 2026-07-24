package templates

import (
	"orion/platform-svc-go/internal/graphviz/graph"
)

// OrgTemplate generates an org chart graph template.
type OrgTemplate struct {
}

// Name returns the template identifier.
func (t *OrgTemplate) Name() string {
	return "org"
}

// Description returns the template description.
func (t *OrgTemplate) Description() string {
	return "Organization chart: people, roles, and reporting relationships"
}

// Direction returns the default graph direction.
func (t *OrgTemplate) Direction() string {
	return "TB"
}

// Layout returns the default layout engine.
func (t *OrgTemplate) Layout() string {
	return "dot"
}

// Apply builds a Graph using the org template.
func (t *OrgTemplate) Apply(nodes map[string]NodeParam, edges []EdgeParam) *graph.Graph {
	g := graph.NewGraph("org-chart")
	g.TemplateID = t.Name()
	g.Direction = t.Direction()
	g.Layout = t.Layout()

	for id, np := range nodes {
		shape := "box"
		if np.Type == "person" {
			shape = "ellipse"
		}
		n := &graph.Node{
			ID:    id,
			Label: np.Label,
			Type:  "person",
			Shape: shape,
			Color: np.Color,
			// Tooltip carries role info
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
			Directed: true,
			Style:    "solid",
		})
	}

	return g
}
