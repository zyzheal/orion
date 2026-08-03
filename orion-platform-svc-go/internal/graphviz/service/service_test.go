package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/graphviz/graph"
	"orion/platform-svc-go/internal/graphviz/models"
	"orion/platform-svc-go/internal/graphviz/templates"
)

type mockRepo struct {
	graphs   map[string]*models.Graph
	createErr error
	getErr   error
	listErr  error
	delErr   error
}

func newMockRepo() *mockRepo {
	return &mockRepo{graphs: make(map[string]*models.Graph)}
}

func (r *mockRepo) Create(_ context.Context, g *models.Graph) error {
	if r.createErr != nil {
		return r.createErr
	}
	i := len(r.graphs) + 1
	g.ID = string(rune('0' + i))
	r.graphs[g.ID] = g
	return nil
}

func (r *mockRepo) GetByID(_ context.Context, tenantID, id string) (*models.Graph, error) {
	if r.getErr != nil {
		return nil, r.getErr
	}
	g, ok := r.graphs[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return g, nil
}

func (r *mockRepo) List(_ context.Context, _ string) ([]models.Graph, error) {
	if r.listErr != nil {
		return nil, r.listErr
	}
	var out []models.Graph
	for _, g := range r.graphs {
		out = append(out, *g)
	}
	return out, nil
}

func (r *mockRepo) Update(_ context.Context, _ string, id string, updates map[string]interface{}) (*models.Graph, error) {
	g, ok := r.graphs[id]
	if !ok {
		return nil, errors.New("not found")
	}
	for k, v := range updates {
		switch k {
		case "name":
			if s, ok := v.(string); ok {
				g.Name = s
			}
		case "description":
			if s, ok := v.(string); ok {
				g.Description = s
			}
		}
	}
	return g, nil
}

func (r *mockRepo) Delete(_ context.Context, _ string, id string) error {
	if r.delErr != nil {
		return r.delErr
	}
	if _, ok := r.graphs[id]; !ok {
		return errors.New("not found")
	}
	delete(r.graphs, id)
	return nil
}

func makeRegistry() *templates.TemplateRegistry {
	return templates.NewTemplateRegistry()
}

func TestSaveGraph(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo, makeRegistry())

	g := graph.NewGraph("my graph")
	g.TemplateID = "topology"
	g.Direction = "LR"
	g.Nodes = []*graph.Node{{ID: "a", Label: "A"}}

	result, err := svc.SaveGraph(context.Background(), "t1", g)
	if err != nil {
		t.Fatal(err)
	}
	if result.TenantID != "t1" {
		t.Errorf("TenantID = %q", result.TenantID)
	}
	if result.NodesJSON == "" {
		t.Error("NodesJSON should not be empty")
	}
	var nodes []*graph.Node
	if err := json.Unmarshal([]byte(result.NodesJSON), &nodes); err != nil {
		t.Fatal(err)
	}
	if len(nodes) != 1 {
		t.Errorf("node count = %d", len(nodes))
	}
}

func TestSaveGraphRepoError(t *testing.T) {
	repo := newMockRepo()
	repo.createErr = errors.New("db down")
	svc := NewService(repo, makeRegistry())
	_, err := svc.SaveGraph(context.Background(), "t1", graph.NewGraph("x"))
	if err == nil {
		t.Error("should fail with repo error")
	}
}

func TestGetGraph(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo, makeRegistry())

	// Create first
	if _, err := svc.SaveGraph(context.Background(), "t1", graph.NewGraph("x")); err != nil {
		t.Fatal(err)
	}
	g, err := svc.GetGraph(context.Background(), "t1", "1")
	if err != nil {
		t.Fatal(err)
	}
	if g.Name != "x" {
		t.Errorf("Name = %q", g.Name)
	}
}

func TestGetGraphNotFound(t *testing.T) {
	svc := NewService(newMockRepo(), makeRegistry())
	_, err := svc.GetGraph(context.Background(), "t1", "nope")
	if err == nil {
		t.Error("not found should error")
	}
}

func TestListGraphs(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo, makeRegistry())

	svc.SaveGraph(context.Background(), "t1", graph.NewGraph("a"))
	svc.SaveGraph(context.Background(), "t1", graph.NewGraph("b"))

	list, err := svc.ListGraphs(context.Background(), "t1")
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 2 {
		t.Errorf("ListGraphs count = %d, want 2", len(list))
	}
}

func TestDeleteGraph(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo, makeRegistry())

	svc.SaveGraph(context.Background(), "t1", graph.NewGraph("x"))
	if err := svc.DeleteGraph(context.Background(), "t1", "1"); err != nil {
		t.Fatal(err)
	}
	_, err := svc.GetGraph(context.Background(), "t1", "1")
	if err == nil {
		t.Error("deleted graph should not be found")
	}
}

func TestRenderDOT(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo, makeRegistry())

	g := graph.NewGraph("render-test")
	g.Nodes = []*graph.Node{{ID: "a", Label: "A", Type: "server"}}
	svc.SaveGraph(context.Background(), "t1", g)

	dot, err := svc.RenderDOT(context.Background(), "t1", "1")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(dot, "digraph") {
		t.Error("DOT output missing digraph")
	}
}

func TestRenderSVG(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo, makeRegistry())

	g := graph.NewGraph("svg-test")
	svc.SaveGraph(context.Background(), "t1", g)

	svg, err := svc.RenderSVG(context.Background(), "t1", "1")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(svg, "<svg") {
		t.Error("SVG output should contain <svg>")
	}
}

func TestBuildFromTemplateNotFound(t *testing.T) {
	svc := NewService(newMockRepo(), makeRegistry())
	_, err := svc.BuildFromTemplate(context.Background(), "t1", models.BuildRequest{
		TemplateID: "nope",
	})
	if err == nil {
		t.Error("missing template should error")
	}
}

func TestUpdateGraph(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo, makeRegistry())

	svc.SaveGraph(context.Background(), "t1", graph.NewGraph("old"))
	newName := "new"
	result, err := svc.UpdateGraph(context.Background(), "t1", "1", models.UpdateGraphRequest{
		Name: &newName,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Name != "new" {
		t.Errorf("Name = %q, want new", result.Name)
	}
}

func TestListTemplates(t *testing.T) {
	svc := NewService(newMockRepo(), makeRegistry())
	names := svc.ListTemplates()
	if len(names) == 0 {
		t.Error("ListTemplates should return at least one")
	}
}

func TestGetTemplate(t *testing.T) {
	svc := NewService(newMockRepo(), makeRegistry())
	_, ok := svc.GetTemplate("topology")
	if !ok {
		t.Error("topology template should exist")
	}
	_, ok2 := svc.GetTemplate("nope")
	if ok2 {
		t.Error("missing template should not exist")
	}
}

func TestHydrateGraphRoundtrip(t *testing.T) {
	// Verify hydrateGraph works by checking JSON roundtrip
	repo := newMockRepo()
	svc := NewService(repo, makeRegistry())

	g := graph.NewGraph("rt")
	g.Nodes = []*graph.Node{{ID: "a", Label: "A"}}
	g.Links = []*graph.Link{{Source: "a", Target: "a", Type: "x", Directed: true}}
	svc.SaveGraph(context.Background(), "t1", g)

	dot, err := svc.RenderDOT(context.Background(), "t1", "1")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(dot, "digraph") {
		t.Error("rendered DOT should contain digraph")
	}
}
