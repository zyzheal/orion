package dag

import (
	"testing"

	"github.com/dominikbraun/graph"
)

func TestNew(t *testing.T) {
	g := New[string]()
	if g == nil {
		t.Fatal("expected non-nil graph")
	}
	if g.HasNode("a") {
		t.Error("expected no nodes initially")
	}
}

func TestAddNode(t *testing.T) {
	g := New[string]()
	if err := g.AddNode("A"); err != nil {
		t.Fatalf("AddNode failed: %v", err)
	}
	if !g.HasNode("A") {
		t.Error("expected node A to exist")
	}

	// Duplicate node should error
	if err := g.AddNode("A"); err == nil {
		t.Error("expected error on duplicate node")
	}

	// Multiple nodes
	_ = g.AddNode("B")
	_ = g.AddNode("C")
	if n, _ := g.Order(); n != 3 {
		t.Errorf("expected 3 nodes, got %d", n)
	}
}

func TestAddEdge(t *testing.T) {
	g := New[string]()
	_ = g.AddNode("A")
	_ = g.AddNode("B")
	_ = g.AddNode("C")

	if err := g.AddEdge("A", "B"); err != nil {
		t.Fatalf("AddEdge failed: %v", err)
	}

	succs, _ := g.Successors("A")
	if len(succs) != 1 || succs[0] != "B" {
		t.Errorf("expected successors [B], got %v", succs)
	}

	preds, _ := g.Predecessors("B")
	if len(preds) != 1 || preds[0] != "A" {
		t.Errorf("expected predecessors [A], got %v", preds)
	}

	// Edge with weight
	_ = g.AddEdge("B", "C", graph.EdgeWeight(5))

	// Duplicate edge should error
	if err := g.AddEdge("A", "B"); err == nil {
		t.Error("expected error on duplicate edge")
	}
}

func TestEdges(t *testing.T) {
	g := New[string]()
	_ = g.AddNode("A")
	_ = g.AddNode("B")
	_ = g.AddNode("C")
	_ = g.AddEdge("A", "B")
	_ = g.AddEdge("A", "C")

	edges, err := g.Edges("A")
	if err != nil {
		t.Fatalf("Edges failed: %v", err)
	}
	if len(edges) != 2 {
		t.Errorf("expected 2 edges, got %d", len(edges))
	}
}

func TestRemoveNode(t *testing.T) {
	g := New[string]()
	_ = g.AddNode("A")
	_ = g.AddNode("B")

	// Remove node with edges should fail
	_ = g.AddEdge("A", "B")
	if err := g.RemoveNode("A"); err == nil {
		t.Error("expected error removing node with edges")
	}

	// Remove all edges first, then node
	_ = g.RemoveEdge("A", "B")
	if err := g.RemoveNode("A"); err != nil {
		t.Fatalf("RemoveNode failed: %v", err)
	}
	if g.HasNode("A") {
		t.Error("expected node A to be removed")
	}
}

func TestRemoveEdgesFirst(t *testing.T) {
	g := New[string]()
	_ = g.AddNode("A")
	_ = g.AddNode("B")
	_ = g.AddNode("C")
	_ = g.AddEdge("A", "B")
	_ = g.AddEdge("B", "C")

	// Remove middle node with incident edges
	if err := g.RemoveEdgesFirst("B"); err != nil {
		t.Fatalf("RemoveEdgesFirst failed: %v", err)
	}
	if g.HasNode("B") {
		t.Error("expected node B to be removed")
	}
	// A and C should still exist
	if !g.HasNode("A") || !g.HasNode("C") {
		t.Error("expected nodes A and C to remain")
	}
}

func TestNodes(t *testing.T) {
	g := New[string]()
	_ = g.AddNode("A")
	_ = g.AddNode("B")
	_ = g.AddNode("C")

	nodes, err := g.Nodes()
	if err != nil {
		t.Fatalf("Nodes failed: %v", err)
	}
	if len(nodes) != 3 {
		t.Errorf("expected 3 nodes, got %d", len(nodes))
	}
}

func TestSuccessorsPredecessors(t *testing.T) {
	g := New[string]()
	_ = g.AddNode("A")
	_ = g.AddNode("B")
	_ = g.AddNode("C")
	_ = g.AddEdge("A", "B")
	_ = g.AddEdge("A", "C")

	succs, _ := g.Successors("A")
	if len(succs) != 2 {
		t.Errorf("expected 2 successors, got %d", len(succs))
	}

	preds, _ := g.Predecessors("B")
	if len(preds) != 1 || preds[0] != "A" {
		t.Errorf("expected predecessors [A], got %v", preds)
	}
}

func TestHasCycle_Acyclic(t *testing.T) {
	g := New[string]()
	_ = g.AddNode("A")
	_ = g.AddNode("B")
	_ = g.AddNode("C")
	_ = g.AddEdge("A", "B")
	_ = g.AddEdge("B", "C")

	if g.HasCycle() {
		t.Error("expected no cycle")
	}
}

func TestHasCycle_Cyclic(t *testing.T) {
	// Use a graph without acyclic constraint to test cycle detection
	g := New[string]()
	_ = g.AddNode("A")
	_ = g.AddNode("B")
	_ = g.AddNode("C")
	_ = g.AddEdge("A", "B")
	_ = g.AddEdge("B", "C")
	// Remove edge that would prevent cycle, add cycle manually
	_ = g.RemoveEdge("B", "C")
	_ = g.AddEdge("B", "C")
	_ = g.AddEdge("C", "A")

	if !g.HasCycle() {
		t.Error("expected cycle")
	}
}

func TestTopologicalSort(t *testing.T) {
	g := New[string]()
	_ = g.AddNode("A")
	_ = g.AddNode("B")
	_ = g.AddNode("C")
	_ = g.AddNode("D")
	_ = g.AddEdge("A", "B")
	_ = g.AddEdge("A", "C")
	_ = g.AddEdge("B", "D")
	_ = g.AddEdge("C", "D")

	order, err := g.TopologicalSort()
	if err != nil {
		t.Fatalf("TopologicalSort failed: %v", err)
	}
	if len(order) != 4 {
		t.Errorf("expected 4 nodes in order, got %d", len(order))
	}

	// Verify ordering: for each edge u->v, u appears before v
	pos := make(map[string]int)
	for i, v := range order {
		pos[v] = i
	}
	// A must come before B and C
	if pos["A"] >= pos["B"] || pos["A"] >= pos["C"] {
		t.Errorf("invalid ordering: %v", order)
	}
	// B and C must come before D
	if pos["B"] >= pos["D"] || pos["C"] >= pos["D"] {
		t.Errorf("invalid ordering: %v", order)
	}
}

func TestTopologicalSort_Cycle(t *testing.T) {
	g := New[string]()
	_ = g.AddNode("A")
	_ = g.AddNode("B")
	_ = g.AddEdge("A", "B")
	_ = g.AddEdge("B", "A")

	_, err := g.TopologicalSort()
	if err == nil {
		t.Error("expected error on cyclic graph")
	}
}

func TestCriticalPath(t *testing.T) {
	g := New[string]()
	_ = g.AddNode("A")
	_ = g.AddNode("B")
	_ = g.AddNode("C")
	_ = g.AddNode("D")
	_ = g.AddNode("E")

	_ = g.AddEdge("A", "B", graph.EdgeWeight(3))
	_ = g.AddEdge("A", "C", graph.EdgeWeight(2))
	_ = g.AddEdge("B", "D", graph.EdgeWeight(4))
	_ = g.AddEdge("C", "D", graph.EdgeWeight(5))
	_ = g.AddEdge("D", "E", graph.EdgeWeight(1))

	// Longest path from A to E:
	// A->B->D->E = 3+4+1 = 8
	// A->C->D->E = 2+5+1 = 8
	// Both are equal, but let's check
	path, err := g.CriticalPath("A", "E")
	if err != nil {
		t.Fatalf("CriticalPath failed: %v", err)
	}
	if len(path) != 4 {
		t.Errorf("expected path length 4, got %d: %v", len(path), path)
	}
	if path[0] != "A" || path[len(path)-1] != "E" {
		t.Errorf("expected path from A to E, got %v", path)
	}
}

func TestCriticalPath_NoPath(t *testing.T) {
	g := New[string]()
	_ = g.AddNode("A")
	_ = g.AddNode("B")
	_ = g.AddNode("C")
	_ = g.AddEdge("A", "B")

	_, err := g.CriticalPath("A", "C")
	if err == nil {
		t.Error("expected error for no path")
	}
}

func TestCriticalPath_NotFound(t *testing.T) {
	g := New[string]()
	_ = g.AddNode("A")
	_ = g.AddNode("B")

	_, err := g.CriticalPath("A", "Z")
	if err == nil {
		t.Error("expected error for nonexistent node")
	}
}

func TestCriticalPath_SingleEdge(t *testing.T) {
	g := New[string]()
	_ = g.AddNode("A")
	_ = g.AddNode("B")
	_ = g.AddEdge("A", "B", graph.EdgeWeight(10))

	path, err := g.CriticalPath("A", "B")
	if err != nil {
		t.Fatalf("CriticalPath failed: %v", err)
	}
	if len(path) != 2 || path[0] != "A" || path[1] != "B" {
		t.Errorf("expected [A, B], got %v", path)
	}
}

func TestCriticalPath_DefaultWeight(t *testing.T) {
	g := New[string]()
	_ = g.AddNode("A")
	_ = g.AddNode("B")
	_ = g.AddNode("C")
	_ = g.AddEdge("A", "B")
	_ = g.AddEdge("B", "C")

	path, err := g.CriticalPath("A", "C")
	if err != nil {
		t.Fatalf("CriticalPath failed: %v", err)
	}
	if len(path) != 3 {
		t.Errorf("expected path length 3, got %d: %v", len(path), path)
	}
}

func TestEmptyGraph(t *testing.T) {
	g := New[string]()

	nodes, _ := g.Nodes()
	if len(nodes) != 0 {
		t.Errorf("expected 0 nodes, got %d", len(nodes))
	}

	if g.HasCycle() {
		t.Error("empty graph should not have cycle")
	}

	_, err := g.CriticalPath("A", "B")
	if err == nil {
		t.Error("expected error on empty graph critical path")
	}
}

func TestSize(t *testing.T) {
	g := New[string]()
	_ = g.AddNode("A")
	_ = g.AddNode("B")
	_ = g.AddEdge("A", "B")

	n, _ := g.Size()
	if n != 1 {
		t.Errorf("expected 1 edge, got %d", n)
	}
}

func TestIntGraph(t *testing.T) {
	g := New[int]()
	_ = g.AddNode(1)
	_ = g.AddNode(2)
	_ = g.AddNode(3)
	_ = g.AddEdge(1, 2)
	_ = g.AddEdge(2, 3)

	order, err := g.TopologicalSort()
	if err != nil {
		t.Fatalf("TopologicalSort failed: %v", err)
	}
	if len(order) != 3 {
		t.Errorf("expected 3 nodes, got %d", len(order))
	}
}

func TestRemoveEdgesFirst_Empty(t *testing.T) {
	g := New[string]()
	_ = g.AddNode("A")
	if err := g.RemoveEdgesFirst("A"); err != nil {
		t.Fatalf("RemoveEdgesFirst failed: %v", err)
	}
	if g.HasNode("A") {
		t.Error("expected node A to be removed")
	}
}

func TestRemoveEdgesFirst_Nonexistent(t *testing.T) {
	g := New[string]()
	_ = g.AddNode("A")
	if err := g.RemoveEdgesFirst("Z"); err == nil {
		t.Error("expected error removing nonexistent node")
	}
}
