package renderer

import (
	"strings"
	"testing"

	"orion/platform-svc-go/internal/graphviz/graph"
)

func TestDOTRenderer(t *testing.T) {
	g := graph.NewGraph("test graph")
	g.Direction = "LR"
	g.Nodes = []*graph.Node{
		{ID: "a", Label: "Node A", Type: "server", Color: "red", Tooltip: "tip"},
		{ID: "b", Label: "Node B", Type: "database"},
	}
	g.Links = []*graph.Link{
		{Source: "a", Target: "b", Label: "uses", Type: "deploys", Directed: true, Style: "dashed", Color: "blue"},
		{Source: "b", Target: "a", Type: "back", Directed: false},
	}

	r := NewDOTRenderer(g)
	dot := r.Render()

	if !strings.Contains(dot, "digraph \"test graph\"") {
		t.Error("missing digraph name")
	}
	if !strings.Contains(dot, "rankdir=LR") {
		t.Error("missing rankdir")
	}
	if !strings.Contains(dot, "fontname=\"Helvetica\"") {
		t.Error("missing fontname")
	}
	if !strings.Contains(dot, "shape=box") {
		t.Error("server should be box shape")
	}
	if !strings.Contains(dot, "shape=cylinder") {
		t.Error("database should be cylinder shape")
	}
	if !strings.Contains(dot, "color=\"red\"") {
		t.Error("missing color")
	}
	if !strings.Contains(dot, "tooltip=\"tip\"") {
		t.Error("missing tooltip")
	}
	if !strings.Contains(dot, "arrowhead=none") {
		t.Error("undirected link should have arrowhead=none")
	}
	if !strings.Contains(dot, "style=\"dashed\"") {
		t.Error("missing style")
	}
	if !strings.Contains(dot, "->") {
		t.Error("missing arrow")
	}
}

func TestDOTRendererEmptyGraph(t *testing.T) {
	g := graph.NewGraph("empty")
	dot := NewDOTRenderer(g).Render()
	if !strings.Contains(dot, "digraph \"empty\"") {
		t.Error("empty graph should still render header")
	}
}

func TestDOTRendererSanitize(t *testing.T) {
	g := graph.NewGraph("a\"b")
	g.Nodes = []*graph.Node{{ID: "a", Label: "l\"abel"}}
	dot := NewDOTRenderer(g).Render()
	// Quotes should be escaped
	if strings.Contains(dot, "a\"b") {
		t.Error("unescaped quote in name")
	}
	if strings.Contains(dot, "l\"abel") {
		t.Error("unescaped quote in label")
	}
}

func TestDOTRendererUndirected(t *testing.T) {
	g := graph.NewGraph("t")
	g.Nodes = []*graph.Node{{ID: "a", Label: "A"}}
	dot := NewDOTRenderer(g).RenderAsUndirected()
	if !strings.Contains(dot, "graph \"t\"") {
		t.Error("undirected should use 'graph' not 'digraph'")
	}
}

func TestShapeForType(t *testing.T) {
	tests := map[string]string{
		"server":    "box",
		"database":  "cylinder",
		"network":   "diamond",
		"person":    "ellipse",
		"container": "note",
		"process":   "box",
		"service":   "ellipse",
		"unknown":   "ellipse",
	}
	for typ, want := range tests {
		if got := shapeForType(typ); got != want {
			t.Errorf("shapeForType(%q) = %q, want %q", typ, got, want)
		}
	}
}

func TestDOTRendererAttr(t *testing.T) {
	g := graph.NewGraph("t")
	g.Nodes = []*graph.Node{{ID: "a", Label: "A", Attrs: map[string]string{"foo": "bar"}}}
	g.Links = []*graph.Link{{Source: "a", Target: "a", Type: "x", Directed: true, Attrs: map[string]string{"key": "val"}}}
	dot := NewDOTRenderer(g).Render()
	if !strings.Contains(dot, "foo=\"bar\"") {
		t.Error("missing node attr")
	}
	if !strings.Contains(dot, "key=\"val\"") {
		t.Error("missing link attr")
	}
}
