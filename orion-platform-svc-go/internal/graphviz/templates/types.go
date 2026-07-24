package templates

import (
	"orion/platform-svc-go/internal/graphviz/graph"
)

// NodeParam carries the input data for a node in a template.
type NodeParam struct {
	Label   string `json:"label"`
	Type    string `json:"type"`
	Color   string `json:"color,omitempty"`
	ToolTip string `json:"tooltip,omitempty"`
}

// EdgeParam carries the input data for an edge/link in a template.
type EdgeParam struct {
	Source   string `json:"source"`
	Target   string `json:"target"`
	Label    string `json:"label"`
	Type     string `json:"type"`
	Directed bool   `json:"directed"`
	Style    string `json:"style"`
	Color    string `json:"color,omitempty"`
}

// Template is the interface that all template types must implement.
type Template interface {
	Name() string
	Description() string
	Direction() string
	Layout() string
	Apply(nodes map[string]NodeParam, edges []EdgeParam) *graph.Graph
}

// TemplateRegistry holds all available templates.
type TemplateRegistry struct {
	templates map[string]Template
}

// NewTemplateRegistry creates a registry with all built-in templates.
func NewTemplateRegistry() *TemplateRegistry {
	return &TemplateRegistry{
		templates: map[string]Template{
			"deployment": &DeploymentTemplate{},
			"topology":   &TopologyTemplate{},
			"process":    &ProcessTemplate{},
			"org":        &OrgTemplate{},
			"cmdb":       &CMDBTemplate{},
		},
	}
}

// Get retrieves a template by name.
func (r *TemplateRegistry) Get(name string) (Template, bool) {
	t, ok := r.templates[name]
	return t, ok
}

// List returns all registered template names.
func (r *TemplateRegistry) List() []string {
	names := make([]string, 0, len(r.templates))
	for n := range r.templates {
		names = append(names, n)
	}
	return names
}

// defaultShape returns a default graph shape for a given node type.
func defaultShape(nodeType string) string {
	switch nodeType {
	case "server", "service", "container":
		return "box"
	case "database":
		return "cylinder"
	case "network", "router", "switch":
		return "diamond"
	case "person":
		return "ellipse"
	case "process", "step":
		return "box"
	case "decision":
		return "diamond"
	default:
		return "ellipse"
	}
}
