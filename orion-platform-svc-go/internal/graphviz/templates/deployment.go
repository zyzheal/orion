package templates

import (
	"orion/platform-svc-go/internal/graphviz/graph"
)

// DeploymentTemplate generates a deployment topology graph template.
type DeploymentTemplate struct {
}

// Name returns the template identifier.
func (t *DeploymentTemplate) Name() string {
	return "deployment"
}

// Description returns the template description.
func (t *DeploymentTemplate) Description() string {
	return "Deployment topology: servers, containers, and their communication links"
}

// Direction returns the default graph direction.
func (t *DeploymentTemplate) Direction() string {
	return "TB"
}

// Layout returns the default layout engine.
func (t *DeploymentTemplate) Layout() string {
	return "dot"
}

// Apply builds a Graph using the deployment template with given parameters.
// nodes: map of node ID to node data (label, type)
// edges: list of edge definitions (source, target, label, type)
func (t *DeploymentTemplate) Apply(nodes map[string]NodeParam, edges []EdgeParam) *graph.Graph {
	g := graph.NewGraph("deployment-topology")
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
		g.Links = append(g.Links, &graph.Link{
			Source:   ep.Source,
			Target:   ep.Target,
			Label:    ep.Label,
			Type:     ep.Type,
			Directed: true,
			Style:    ep.Style,
			Color:    ep.Color,
		})
	}

	return g
}
