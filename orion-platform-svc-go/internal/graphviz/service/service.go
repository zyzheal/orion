package service

import (
	"context"
	"encoding/json"
	"fmt"

	"orion/platform-svc-go/internal/graphviz/graph"
	"orion/platform-svc-go/internal/graphviz/models"
	"orion/platform-svc-go/internal/graphviz/renderer"
	"orion/platform-svc-go/internal/graphviz/templates"
)

// ServiceInterface defines the interface for the graphviz service.
type ServiceInterface interface {
	BuildFromTemplate(ctx context.Context, tenantID string, req models.BuildRequest) (*graph.Graph, error)
	SaveGraph(ctx context.Context, tenantID string, g *graph.Graph) (*models.Graph, error)
	GetGraph(ctx context.Context, tenantID, id string) (*models.Graph, error)
	ListGraphs(ctx context.Context, tenantID string) ([]models.Graph, error)
	RenderDOT(ctx context.Context, tenantID, id string) (string, error)
	RenderSVG(ctx context.Context, tenantID, id string) (string, error)
	RenderJSON(ctx context.Context, tenantID, id string) (string, error)
	DeleteGraph(ctx context.Context, tenantID, id string) error
	ListTemplates() []string
	GetTemplate(name string) (templates.Template, bool)
}

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, g *models.Graph) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Graph, error)
	List(ctx context.Context, tenantID string) ([]models.Graph, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Graph, error)
	Delete(ctx context.Context, tenantID, id string) error
}

// Service is the graphviz service implementation.
type Service struct {
	repo      RepositoryInterface
	templates *templates.TemplateRegistry
}

// NewService creates a new Service.
func NewService(repo RepositoryInterface, registry *templates.TemplateRegistry) *Service {
	return &Service{
		repo:      repo,
		templates: registry,
	}
}

// BuildFromTemplate constructs a Graph using a registered template.
func (s *Service) BuildFromTemplate(ctx context.Context, tenantID string, req models.BuildRequest) (*graph.Graph, error) {
	tpl, ok := s.templates.Get(req.TemplateID)
	if !ok {
		return nil, fmt.Errorf("template not found: %s", req.TemplateID)
	}

	nodes := make(map[string]templates.NodeParam)
	for id, nd := range req.Nodes {
		nodes[id] = templates.NodeParam{
			Label:   nd.Label,
			Type:    nd.Type,
			Color:   nd.Color,
			ToolTip: nd.ToolTip,
		}
	}

	edges := make([]templates.EdgeParam, len(req.Edges))
	for i, e := range req.Edges {
		edges[i] = templates.EdgeParam{
			Source:   e.Source,
			Target:   e.Target,
			Label:    e.Label,
			Type:     e.Type,
			Directed: e.Directed,
		}
	}

	return tpl.Apply(nodes, edges), nil
}

// SaveGraph persists a Graph to the database.
func (s *Service) SaveGraph(ctx context.Context, tenantID string, g *graph.Graph) (*models.Graph, error) {
	nodesJSON, err := json.Marshal(g.Nodes)
	if err != nil {
		return nil, err
	}
	linksJSON, err := json.Marshal(g.Links)
	if err != nil {
		return nil, err
	}

	m := &models.Graph{
		TenantID:  tenantID,
		Name:      g.Name,
		TemplateID: g.TemplateID,
		Direction: g.Direction,
		Layout:    g.Layout,
		NodesJSON: string(nodesJSON),
		LinksJSON: string(linksJSON),
	}
	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

// GetGraph retrieves a graph from the database.
func (s *Service) GetGraph(ctx context.Context, tenantID, id string) (*models.Graph, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// ListGraphs returns all graphs for a tenant.
func (s *Service) ListGraphs(ctx context.Context, tenantID string) ([]models.Graph, error) {
	return s.repo.List(ctx, tenantID)
}

// RenderDOT renders a graph as DOT format.
func (s *Service) RenderDOT(ctx context.Context, tenantID, id string) (string, error) {
	m, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return "", err
	}
	g, err := s.hydrateGraph(m)
	if err != nil {
		return "", err
	}
	return renderer.NewDOTRenderer(g).Render(), nil
}

// RenderSVG renders a graph as SVG format.
func (s *Service) RenderSVG(ctx context.Context, tenantID, id string) (string, error) {
	m, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return "", err
	}
	g, err := s.hydrateGraph(m)
	if err != nil {
		return "", err
	}
	return renderer.NewSVGRenderer(g).Render(), nil
}

// RenderJSON renders a graph as JSON format.
func (s *Service) RenderJSON(ctx context.Context, tenantID, id string) (string, error) {
	m, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return "", err
	}
	g, err := s.hydrateGraph(m)
	if err != nil {
		return "", err
	}
	return renderer.NewSVGRenderer(g).RenderJSON()
}

// DeleteGraph removes a graph.
func (s *Service) DeleteGraph(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// UpdateGraph modifies a graph record.
func (s *Service) UpdateGraph(ctx context.Context, tenantID, id string, req models.UpdateGraphRequest) (*models.Graph, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Direction != nil {
		updates["direction"] = *req.Direction
	}
	if len(req.Nodes) > 0 {
		nodesJSON, err := json.Marshal(req.Nodes)
		if err != nil {
			return nil, err
		}
		updates["nodes_json"] = string(nodesJSON)
	}
	if len(req.Links) > 0 {
		linksJSON, err := json.Marshal(req.Links)
		if err != nil {
			return nil, err
		}
		updates["links_json"] = string(linksJSON)
	}
	return s.repo.Update(ctx, tenantID, id, updates)
}

// ListTemplates returns all registered template names.
func (s *Service) ListTemplates() []string {
	return s.templates.List()
}

// GetTemplate retrieves a template by name.
func (s *Service) GetTemplate(name string) (templates.Template, bool) {
	return s.templates.Get(name)
}

// hydrateGraph reconstructs a Graph from a persisted model.
func (s *Service) hydrateGraph(m *models.Graph) (*graph.Graph, error) {
	g := graph.NewGraph(m.Name)
	g.TemplateID = m.TemplateID
	g.Direction = m.Direction
	g.Layout = m.Layout

	if m.NodesJSON != "" {
		if err := json.Unmarshal([]byte(m.NodesJSON), &g.Nodes); err != nil {
			return nil, err
		}
	}
	if m.LinksJSON != "" {
		if err := json.Unmarshal([]byte(m.LinksJSON), &g.Links); err != nil {
			return nil, err
		}
	}
	return g, nil
}
