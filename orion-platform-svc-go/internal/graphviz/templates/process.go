package templates

import (
	"orion/platform-svc-go/internal/graphviz/graph"
)

// ProcessTemplate generates a workflow/process flow graph template.
type ProcessTemplate struct {
}

// Name returns the template identifier.
func (t *ProcessTemplate) Name() string {
	return "process"
}

// Description returns the template description.
func (t *ProcessTemplate) Description() string {
	return "Process flow: steps, decisions, and conditional paths"
}

// Direction returns the default graph direction.
func (t *ProcessTemplate) Direction() string {
	return "TB"
}

// Layout returns the default layout engine.
func (t *ProcessTemplate) Layout() string {
	return "dot"
}

// Apply builds a Graph using the process template.
func (t *ProcessTemplate) Apply(nodes map[string]NodeParam, edges []EdgeParam) *graph.Graph {
	g := graph.NewGraph("process-flow")
	g.TemplateID = t.Name()
	g.Direction = t.Direction()
	g.Layout = t.Layout()

	for id, np := range nodes {
		shape := defaultShape(np.Type)
		if np.Type == "decision" {
			shape = "diamond"
		} else if np.Type == "terminal" {
			shape = "ellipse"
		}
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
