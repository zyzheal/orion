package topology

import "errors"

// Graph represents a topology graph with nodes and edges
type Graph struct {
	nodes map[string]*TopologyNode
	edges map[string][]TopologyEdge // adjacency list: nodeID -> outgoing edges
}

// NewGraph creates a new empty graph
func NewGraph() *Graph {
	return &Graph{
		nodes: make(map[string]*TopologyNode),
		edges: make(map[string][]TopologyEdge),
	}
}

// AddNode adds a node to the graph
func (g *Graph) AddNode(node TopologyNode) {
	g.nodes[node.CiID] = &node
	// Initialize adjacency list if not exists
	if _, ok := g.edges[node.CiID]; !ok {
		g.edges[node.CiID] = []TopologyEdge{}
	}
}

// AddEdge adds an edge to the graph
func (g *Graph) AddEdge(edge TopologyEdge) {
	// Ensure source node exists in adjacency list
	if _, ok := g.edges[edge.Source]; !ok {
		g.edges[edge.Source] = []TopologyEdge{}
	}
	g.edges[edge.Source] = append(g.edges[edge.Source], edge)
}

// GetNode retrieves a node by ID
func (g *Graph) GetNode(id string) (*TopologyNode, bool) {
	node, ok := g.nodes[id]
	return node, ok
}

// GetEdges returns all outgoing edges from a node
func (g *Graph) GetEdges(nodeID string) []TopologyEdge {
	return g.edges[nodeID]
}

// GetAllNodes returns all nodes in the graph
func (g *Graph) GetAllNodes() []TopologyNode {
	nodes := make([]TopologyNode, 0, len(g.nodes))
	for _, node := range g.nodes {
		nodes = append(nodes, *node)
	}
	return nodes
}

// GetAllEdges returns all edges in the graph
func (g *Graph) GetAllEdges() []TopologyEdge {
	edges := make([]TopologyEdge, 0)
	for _, nodeEdges := range g.edges {
		edges = append(edges, nodeEdges...)
	}
	return edges
}

// BFS performs breadth-first search starting from the given node
func (g *Graph) BFS(startNodeID string) []string {
	visited := make(map[string]bool)
	queue := []string{startNodeID}
	result := []string{}

	visited[startNodeID] = true

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		result = append(result, current)

		for _, edge := range g.edges[current] {
			if !visited[edge.Target] {
				visited[edge.Target] = true
				queue = append(queue, edge.Target)
			}
		}
	}

	return result
}

// DFS performs depth-first search starting from the given node
func (g *Graph) DFS(startNodeID string) []string {
	visited := make(map[string]bool)
	result := []string{}

	g.dfsHelper(startNodeID, visited, &result)

	return result
}

func (g *Graph) dfsHelper(nodeID string, visited map[string]bool, result *[]string) {
	visited[nodeID] = true
	*result = append(*result, nodeID)

	for _, edge := range g.edges[nodeID] {
		if !visited[edge.Target] {
			g.dfsHelper(edge.Target, visited, result)
		}
	}
}

// FindPath finds a path from one node to another using BFS
func (g *Graph) FindPath(from, to string) []string {
	if _, ok := g.nodes[from]; !ok {
		return nil
	}
	if _, ok := g.nodes[to]; !ok {
		return nil
	}

	visited := make(map[string]bool)
	queue := []string{from}
	parent := make(map[string]string)

	visited[from] = true

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		if current == to {
			// Reconstruct path
			path := []string{}
			node := to
			for node != "" {
				path = append([]string{node}, path...)
				node = parent[node]
			}
			return path
		}

		for _, edge := range g.edges[current] {
			if !visited[edge.Target] {
				visited[edge.Target] = true
				parent[edge.Target] = current
				queue = append(queue, edge.Target)
			}
		}
	}

	return nil
}

// FindAllReachable finds all nodes reachable from a given node
func (g *Graph) FindAllReachable(nodeID string) []string {
	visited := make(map[string]bool)
	queue := []string{nodeID}

	visited[nodeID] = true

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		for _, edge := range g.edges[current] {
			if !visited[edge.Target] {
				visited[edge.Target] = true
				queue = append(queue, edge.Target)
			}
		}
	}

	// Remove start node from result
	result := []string{}
	for id := range visited {
		if id != nodeID {
			result = append(result, id)
		}
	}

	return result
}

// NodeCount returns the number of nodes in the graph
func (g *Graph) NodeCount() int {
	return len(g.nodes)
}

// EdgeCount returns the number of edges in the graph
func (g *Graph) EdgeCount() int {
	count := 0
	for _, edges := range g.edges {
		count += len(edges)
	}
	return count
}

// HasNode checks if a node exists in the graph
func (g *Graph) HasNode(nodeID string) bool {
	_, ok := g.nodes[nodeID]
	return ok
}

// Clear removes all nodes and edges from the graph
func (g *Graph) Clear() {
	g.nodes = make(map[string]*TopologyNode)
	g.edges = make(map[string][]TopologyEdge)
}

// Validate checks if the graph is valid (no dangling edges)
func (g *Graph) Validate() error {
	for _, edges := range g.edges {
		for _, edge := range edges {
			if _, ok := g.nodes[edge.Source]; !ok {
				return errors.New("edge references non-existent source node: " + edge.Source)
			}
			if _, ok := g.nodes[edge.Target]; !ok {
				return errors.New("edge references non-existent target node: " + edge.Target)
			}
		}
	}
	return nil
}

// GetIncomingEdges returns all edges pointing TO a node (reverse direction)
func (g *Graph) GetIncomingEdges(nodeID string) []TopologyEdge {
	var incoming []TopologyEdge
	for sourceID, edges := range g.edges {
		for _, edge := range edges {
			if edge.Target == nodeID {
				// Add source info to track where the edge came from
				incoming = append(incoming, TopologyEdge{
					ID:           edge.ID,
					Source:       sourceID,
					Target:       edge.Target,
					RelationType: edge.RelationType,
				})
			}
		}
	}
	return incoming
}

// GetAllReachableFrom finds all nodes reachable from a given node (forward traversal)
func (g *Graph) GetAllReachableFrom(nodeID string) map[string]bool {
	visited := make(map[string]bool)
	queue := []string{nodeID}
	visited[nodeID] = true

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		for _, edge := range g.edges[current] {
			if !visited[edge.Target] {
				visited[edge.Target] = true
				queue = append(queue, edge.Target)
			}
		}
	}

	return visited
}

// GetAllDependents finds all nodes that depend on the given node (reverse traversal)
func (g *Graph) GetAllDependents(nodeID string) map[string]bool {
	visited := make(map[string]bool)
	queue := []string{nodeID}
	visited[nodeID] = true

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		// Find all nodes that have edges pointing to current
		for sourceID, edges := range g.edges {
			if visited[sourceID] {
				continue
			}
			for _, edge := range edges {
				if edge.Target == current {
					visited[sourceID] = true
					queue = append(queue, sourceID)
					break
				}
			}
		}
	}

	// Remove start node from result
	delete(visited, nodeID)
	return visited
}

// FindAllPaths finds all simple paths from one node to another
func (g *Graph) FindAllPaths(from, to string) [][]string {
	if _, ok := g.nodes[from]; !ok {
		return nil
	}
	if _, ok := g.nodes[to]; !ok {
		return nil
	}

	var paths [][]string
	visited := make(map[string]bool)
	currentPath := []string{from}

	g.findAllPathsHelper(from, to, visited, currentPath, &paths)

	return paths
}

func (g *Graph) findAllPathsHelper(current, target string, visited map[string]bool, path []string, paths *[][]string) {
	if current == target {
		// Copy the path
		pathCopy := make([]string, len(path))
		copy(pathCopy, path)
		*paths = append(*paths, pathCopy)
		return
	}

	visited[current] = true

	for _, edge := range g.edges[current] {
		if !visited[edge.Target] {
			path = append(path, edge.Target)
			g.findAllPathsHelper(edge.Target, target, visited, path, paths)
			path = path[:len(path)-1]
		}
	}

	visited[current] = false
}

// GetInDegree returns the number of incoming edges to a node
func (g *Graph) GetInDegree(nodeID string) int {
	count := 0
	for _, edges := range g.edges {
		for _, edge := range edges {
			if edge.Target == nodeID {
				count++
			}
		}
	}
	return count
}

// GetOutDegree returns the number of outgoing edges from a node
func (g *Graph) GetOutDegree(nodeID string) int {
	return len(g.edges[nodeID])
}