package topology

import (
	"testing"
)

func TestGraph_AddNode(t *testing.T) {
	graph := NewGraph()

	node := TopologyNode{
		ID:     "node-1",
		CiID:   "ci-1",
		CiType: "SERVER",
		Name:   "Test Server",
		Status: "ACTIVE",
	}

	graph.AddNode(node)

	// Verify node was added
	retrieved, ok := graph.GetNode("ci-1")
	if !ok {
		t.Error("Expected node to exist in graph")
	}
	if retrieved.CiID != "ci-1" {
		t.Errorf("Expected CiID to be 'ci-1', got '%s'", retrieved.CiID)
	}
	if retrieved.Name != "Test Server" {
		t.Errorf("Expected Name to be 'Test Server', got '%s'", retrieved.Name)
	}
}

func TestGraph_AddEdge(t *testing.T) {
	graph := NewGraph()

	// Add nodes first
	node1 := TopologyNode{ID: "1", CiID: "ci-1", CiType: "SERVER", Name: "Server 1", Status: "ACTIVE"}
	node2 := TopologyNode{ID: "2", CiID: "ci-2", CiType: "DATABASE", Name: "DB 1", Status: "ACTIVE"}

	graph.AddNode(node1)
	graph.AddNode(node2)

	// Add edge
	edge := TopologyEdge{
		ID:           "edge-1",
		Source:       "ci-1",
		Target:       "ci-2",
		RelationType: "HOSTED_ON",
	}
	graph.AddEdge(edge)

	// Verify edge was added
	edges := graph.GetEdges("ci-1")
	if len(edges) != 1 {
		t.Errorf("Expected 1 edge, got %d", len(edges))
	}
	if edges[0].Target != "ci-2" {
		t.Errorf("Expected target to be 'ci-2', got '%s'", edges[0].Target)
	}
}

func TestGraph_BFS(t *testing.T) {
	graph := NewGraph()

	// Create a simple graph:
	//   A -> B -> C
	//   A -> D
	// Expected BFS order from A: A, B, D, C

	nodes := []TopologyNode{
		{ID: "1", CiID: "A", CiType: "APP", Name: "A", Status: "ACTIVE"},
		{ID: "2", CiID: "B", CiType: "APP", Name: "B", Status: "ACTIVE"},
		{ID: "3", CiID: "C", CiType: "APP", Name: "C", Status: "ACTIVE"},
		{ID: "4", CiID: "D", CiType: "APP", Name: "D", Status: "ACTIVE"},
	}

	for _, node := range nodes {
		graph.AddNode(node)
	}

	graph.AddEdge(TopologyEdge{ID: "e1", Source: "A", Target: "B", RelationType: "DEPENDS_ON"})
	graph.AddEdge(TopologyEdge{ID: "e2", Source: "B", Target: "C", RelationType: "DEPENDS_ON"})
	graph.AddEdge(TopologyEdge{ID: "e3", Source: "A", Target: "D", RelationType: "DEPENDS_ON"})

	result := graph.BFS("A")

	if len(result) != 4 {
		t.Errorf("Expected 4 nodes in BFS result, got %d", len(result))
	}

	// First element should be A
	if result[0] != "A" {
		t.Errorf("Expected first node to be 'A', got '%s'", result[0])
	}
}

func TestGraph_DFS(t *testing.T) {
	graph := NewGraph()

	// Create a simple graph:
	//   A -> B -> C
	//   A -> D

	nodes := []TopologyNode{
		{ID: "1", CiID: "A", CiType: "APP", Name: "A", Status: "ACTIVE"},
		{ID: "2", CiID: "B", CiType: "APP", Name: "B", Status: "ACTIVE"},
		{ID: "3", CiID: "C", CiType: "APP", Name: "C", Status: "ACTIVE"},
		{ID: "4", CiID: "D", CiType: "APP", Name: "D", Status: "ACTIVE"},
	}

	for _, node := range nodes {
		graph.AddNode(node)
	}

	graph.AddEdge(TopologyEdge{ID: "e1", Source: "A", Target: "B", RelationType: "DEPENDS_ON"})
	graph.AddEdge(TopologyEdge{ID: "e2", Source: "B", Target: "C", RelationType: "DEPENDS_ON"})
	graph.AddEdge(TopologyEdge{ID: "e3", Source: "A", Target: "D", RelationType: "DEPENDS_ON"})

	result := graph.DFS("A")

	if len(result) != 4 {
		t.Errorf("Expected 4 nodes in DFS result, got %d", len(result))
	}

	// First element should be A
	if result[0] != "A" {
		t.Errorf("Expected first node to be 'A', got '%s'", result[0])
	}

	// B should come before C in DFS
	bIndex := -1
	cIndex := -1
	dIndex := -1
	for i, id := range result {
		if id == "B" {
			bIndex = i
		}
		if id == "C" {
			cIndex = i
		}
		if id == "D" {
			dIndex = i
		}
	}
	if bIndex > cIndex {
		t.Error("Expected B to come before C in DFS")
	}
	_ = dIndex // D could be anywhere after A
}

func TestGraph_FindPath(t *testing.T) {
	graph := NewGraph()

	// Create a simple graph:
	//   A -> B -> C -> D
	//   A -> E -> D

	nodes := []TopologyNode{
		{ID: "1", CiID: "A", CiType: "APP", Name: "A", Status: "ACTIVE"},
		{ID: "2", CiID: "B", CiType: "APP", Name: "B", Status: "ACTIVE"},
		{ID: "3", CiID: "C", CiType: "APP", Name: "C", Status: "ACTIVE"},
		{ID: "4", CiID: "D", CiType: "APP", Name: "D", Status: "ACTIVE"},
		{ID: "5", CiID: "E", CiType: "APP", Name: "E", Status: "ACTIVE"},
	}

	for _, node := range nodes {
		graph.AddNode(node)
	}

	graph.AddEdge(TopologyEdge{ID: "e1", Source: "A", Target: "B", RelationType: "DEPENDS_ON"})
	graph.AddEdge(TopologyEdge{ID: "e2", Source: "B", Target: "C", RelationType: "DEPENDS_ON"})
	graph.AddEdge(TopologyEdge{ID: "e3", Source: "C", Target: "D", RelationType: "DEPENDS_ON"})
	graph.AddEdge(TopologyEdge{ID: "e4", Source: "A", Target: "E", RelationType: "DEPENDS_ON"})
	graph.AddEdge(TopologyEdge{ID: "e5", Source: "E", Target: "D", RelationType: "DEPENDS_ON"})

	// Find path from A to D
	path := graph.FindPath("A", "D")

	if path == nil {
		t.Error("Expected path to exist")
		return
	}

	if len(path) < 2 {
		t.Errorf("Expected path length >= 2, got %d", len(path))
	}

	if path[0] != "A" {
		t.Errorf("Expected path to start with 'A', got '%s'", path[0])
	}

	if path[len(path)-1] != "D" {
		t.Errorf("Expected path to end with 'D', got '%s'", path[len(path)-1])
	}

	// Test non-existent path
	noPath := graph.FindPath("D", "A")
	if noPath != nil {
		t.Error("Expected no path from D to A (backward)")
	}
}

func TestGraph_FindAllReachable(t *testing.T) {
	graph := NewGraph()

	// Create a simple graph:
	//   A -> B -> C
	//   A -> D

	nodes := []TopologyNode{
		{ID: "1", CiID: "A", CiType: "APP", Name: "A", Status: "ACTIVE"},
		{ID: "2", CiID: "B", CiType: "APP", Name: "B", Status: "ACTIVE"},
		{ID: "3", CiID: "C", CiType: "APP", Name: "C", Status: "ACTIVE"},
		{ID: "4", CiID: "D", CiType: "APP", Name: "D", Status: "ACTIVE"},
	}

	for _, node := range nodes {
		graph.AddNode(node)
	}

	graph.AddEdge(TopologyEdge{ID: "e1", Source: "A", Target: "B", RelationType: "DEPENDS_ON"})
	graph.AddEdge(TopologyEdge{ID: "e2", Source: "B", Target: "C", RelationType: "DEPENDS_ON"})
	graph.AddEdge(TopologyEdge{ID: "e3", Source: "A", Target: "D", RelationType: "DEPENDS_ON"})

	// Find all reachable from A
	reachable := graph.FindAllReachable("A")

	if len(reachable) != 3 {
		t.Errorf("Expected 3 reachable nodes from A, got %d: %v", len(reachable), reachable)
	}

	// Check that all expected nodes are present
	expected := map[string]bool{"B": true, "C": true, "D": true}
	for _, id := range reachable {
		if !expected[id] {
			t.Errorf("Unexpected reachable node: %s", id)
		}
	}
}

func TestGraph_Validate(t *testing.T) {
	graph := NewGraph()

	// Add valid nodes and edges
	nodes := []TopologyNode{
		{ID: "1", CiID: "A", CiType: "APP", Name: "A", Status: "ACTIVE"},
		{ID: "2", CiID: "B", CiType: "APP", Name: "B", Status: "ACTIVE"},
	}

	for _, node := range nodes {
		graph.AddNode(node)
	}

	graph.AddEdge(TopologyEdge{ID: "e1", Source: "A", Target: "B", RelationType: "DEPENDS_ON"})

	err := graph.Validate()
	if err != nil {
		t.Errorf("Expected validation to pass, got error: %v", err)
	}
}

func TestGraph_Validate_WithDanglingEdge(t *testing.T) {
	graph := NewGraph()

	// Add only one node but edge to non-existent node
	node := TopologyNode{ID: "1", CiID: "A", CiType: "APP", Name: "A", Status: "ACTIVE"}
	graph.AddNode(node)

	graph.AddEdge(TopologyEdge{ID: "e1", Source: "A", Target: "B", RelationType: "DEPENDS_ON"})

	err := graph.Validate()
	if err == nil {
		t.Error("Expected validation to fail with dangling edge")
	}
}

func TestGraph_NodeCount(t *testing.T) {
	graph := NewGraph()

	if graph.NodeCount() != 0 {
		t.Errorf("Expected 0 nodes initially, got %d", graph.NodeCount())
	}

	graph.AddNode(TopologyNode{ID: "1", CiID: "A", CiType: "APP", Name: "A", Status: "ACTIVE"})
	graph.AddNode(TopologyNode{ID: "2", CiID: "B", CiType: "APP", Name: "B", Status: "ACTIVE"})

	if graph.NodeCount() != 2 {
		t.Errorf("Expected 2 nodes, got %d", graph.NodeCount())
	}
}

func TestGraph_Clear(t *testing.T) {
	graph := NewGraph()

	graph.AddNode(TopologyNode{ID: "1", CiID: "A", CiType: "APP", Name: "A", Status: "ACTIVE"})
	graph.AddNode(TopologyNode{ID: "2", CiID: "B", CiType: "APP", Name: "B", Status: "ACTIVE"})

	graph.Clear()

	if graph.NodeCount() != 0 {
		t.Errorf("Expected 0 nodes after clear, got %d", graph.NodeCount())
	}
	if graph.EdgeCount() != 0 {
		t.Errorf("Expected 0 edges after clear, got %d", graph.EdgeCount())
	}
}

func TestGraph_GetAllNodes(t *testing.T) {
	graph := NewGraph()

	graph.AddNode(TopologyNode{ID: "1", CiID: "A", CiType: "APP", Name: "A", Status: "ACTIVE"})
	graph.AddNode(TopologyNode{ID: "2", CiID: "B", CiType: "DB", Name: "B", Status: "ACTIVE"})

	nodes := graph.GetAllNodes()
	if len(nodes) != 2 {
		t.Errorf("Expected 2 nodes, got %d", len(nodes))
	}
}

func TestGraph_GetAllEdges(t *testing.T) {
	graph := NewGraph()

	graph.AddNode(TopologyNode{ID: "1", CiID: "A", CiType: "APP", Name: "A", Status: "ACTIVE"})
	graph.AddNode(TopologyNode{ID: "2", CiID: "B", CiType: "DB", Name: "B", Status: "ACTIVE"})
	graph.AddNode(TopologyNode{ID: "3", CiID: "C", CiType: "SERVER", Name: "C", Status: "ACTIVE"})

	graph.AddEdge(TopologyEdge{ID: "e1", Source: "A", Target: "B", RelationType: "DEPENDS_ON"})
	graph.AddEdge(TopologyEdge{ID: "e2", Source: "B", Target: "C", RelationType: "HOSTED_ON"})

	edges := graph.GetAllEdges()
	if len(edges) != 2 {
		t.Errorf("Expected 2 edges, got %d", len(edges))
	}
}