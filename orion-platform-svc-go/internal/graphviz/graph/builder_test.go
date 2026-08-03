package graph

import (
	"strings"
	"testing"
)

func TestNewGraph(t *testing.T) {
	g := NewGraph("test")
	if g.Name != "test" {
		t.Errorf("Name = %q", g.Name)
	}
	if g.Direction != "TB" {
		t.Errorf("Direction = %q, want TB", g.Direction)
	}
	if g.Layout != "dot" {
		t.Errorf("Layout = %q, want dot", g.Layout)
	}
	if len(g.Nodes) != 0 {
		t.Errorf("Nodes should be empty")
	}
	if len(g.Links) != 0 {
		t.Errorf("Links should be empty")
	}
}

func TestGraphValidate(t *testing.T) {
	g := NewGraph("t")
	g.Nodes = []*Node{{ID: "a", Label: "A"}, {ID: "b", Label: "B"}}

	// Valid
	if errs := g.Validate(); len(errs) != 0 {
		t.Errorf("valid graph failed: %v", errs)
	}

	// Empty node ID
	g.Nodes = append(g.Nodes, &Node{ID: "", Label: "X"})
	errs := g.Validate()
	if len(errs) == 0 {
		t.Error("empty node ID should fail")
	}

	// Orphan source
	g2 := NewGraph("t")
	g2.Nodes = []*Node{{ID: "a", Label: "A"}}
	g2.Links = []*Link{{Source: "missing", Target: "a", Type: "x", Directed: true}}
	errs2 := g2.Validate()
	found := false
	for _, e := range errs2 {
		if strings.Contains(e.Error(), "missing") {
			found = true
		}
	}
	if !found {
		t.Error("orphan source link should fail")
	}

	// Orphan target
	g2.Links[0].Source = "a"
	g2.Links[0].Target = "missing"
	errs3 := g2.Validate()
	found = false
	for _, e := range errs3 {
		if strings.Contains(e.Error(), "missing") {
			found = true
		}
	}
	if !found {
		t.Error("orphan target link should fail")
	}
}

func TestGraphBuilderFluentAPI(t *testing.T) {
	b := NewBuilder("my-graph").
		Direction("LR").
		Layout("neato").
		Template("topology").
		AddNode(&Node{ID: "a", Label: "A", Type: "server"}).
		AddNode(&Node{ID: "b", Label: "B", Type: "database"}).
		AddLink("a", "b", "depends_on").
		AddLinkWithLabel("b", "a", "deploys", "deploys").
		AddUndirectedLink("a", "b", "comm").
		AddLabelledLink(&Link{
			Source: "a", Target: "b", Type: "custom",
			Label: "custom", Directed: true,
		})

	if b.NodeCount() != 2 {
		t.Errorf("NodeCount = %d, want 2", b.NodeCount())
	}
	if b.LinkCount() != 4 {
		t.Errorf("LinkCount = %d, want 4", b.LinkCount())
	}

	g, err := b.Build()
	if err != nil {
		t.Fatal(err)
	}
	if g.Name != "my-graph" {
		t.Errorf("Name = %q", g.Name)
	}
	if g.Direction != "LR" {
		t.Errorf("Direction = %q", g.Direction)
	}
	if g.Layout != "neato" {
		t.Errorf("Layout = %q", g.Layout)
	}
	if g.TemplateID != "topology" {
		t.Errorf("TemplateID = %q", g.TemplateID)
	}
}

func TestGraphBuilderValidationFailure(t *testing.T) {
	b := NewBuilder("bad")
	b.AddNode(&Node{ID: "", Label: "no id"})
	_, err := b.Build()
	if err == nil {
		t.Error("build with empty node ID should fail")
	}
}

func TestGraphBuilderNilNode(t *testing.T) {
	b := NewBuilder("t")
	b.AddNode(nil)
	g, err := b.Build()
	if err != nil {
		t.Fatal(err)
	}
	if len(g.Nodes) != 0 {
		t.Error("nil node should be skipped")
	}
}

func TestGraphBuilderDefaultNodeType(t *testing.T) {
	b := NewBuilder("t")
	b.AddNode(&Node{ID: "x", Label: "X"})
	g, err := b.Build()
	if err != nil {
		t.Fatal(err)
	}
	if g.Nodes[0].Type != "default" {
		t.Errorf("default type = %q", g.Nodes[0].Type)
	}
}

func TestGraphBuilderGraphAccess(t *testing.T) {
	b := NewBuilder("t")
	g := b.Graph()
	if g.Name != "t" {
		t.Error("Graph() should return current graph")
	}
}
