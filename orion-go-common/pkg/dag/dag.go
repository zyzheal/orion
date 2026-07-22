package dag

import (
	"fmt"

	"github.com/dominikbraun/graph"
)

// Graph is a generic wrapper around github.com/dominikbraun/graph
// with DAG-specific convenience methods: topological sort, cycle detection,
// and critical (longest) path computation.
//
// The generic parameter V is both the vertex type and the hash key type
// (identity hashing is used).  This covers the most common use-case of
// string/int keyed DAGs.
//
// The underlying graph is always directed.  Use Acyclic() option to enforce
// DAG constraints at construction time (enabled by default).
type Graph[V comparable] struct {
	g graph.Graph[V, V]
}

// identity returns the vertex value itself as the hash key.
func identity[V comparable](v V) V { return v }

// New creates a new DAG-wrapped graph with the given options.
// Default behaviour is a directed, acyclic graph.
func New[V comparable](opts ...Option[V]) *Graph[V] {
	opts = append(opts, Directed[V](), Acyclic[V]())
	tOpt := make([]func(*graph.Traits), 0, len(opts))
	for _, o := range opts {
		tOpt = append(tOpt, o())
	}
	g := graph.New(identity[V], tOpt...)
	return &Graph[V]{g: g}
}

// AddNode adds a node to the graph.  Returns an error if the node already exists.
func (d *Graph[V]) AddNode(v V) error {
	return d.g.AddVertex(v)
}

// AddEdge adds a directed edge from 'from' to 'to' with optional edge properties.
// Use graph.EdgeWeight(n) and graph.EdgeAttribute(key, value) as edgeOpts.
func (d *Graph[V]) AddEdge(from, to V, edgeOpts ...func(*graph.EdgeProperties)) error {
	return d.g.AddEdge(from, to, edgeOpts...)
}

// Edges returns the outgoing edges of node v.
func (d *Graph[V]) Edges(v V) ([]graph.Edge[V], error) {
	adj, err := d.g.AdjacencyMap()
	if err != nil {
		return nil, err
	}
	outEdges, ok := adj[v]
	if !ok {
		return nil, nil
	}
	var edges []graph.Edge[V]
	for _, e := range outEdges {
		edges = append(edges, e)
	}
	return edges, nil
}

// RemoveNode removes a node.  The node must have no incident edges,
// otherwise ErrVertexHasEdges is returned.  Use RemoveEdgesFirst to
// remove all edges before deleting a node.
func (d *Graph[V]) RemoveNode(v V) error {
	return d.g.RemoveVertex(v)
}

// RemoveEdgesFirst removes all outgoing and incoming edges of v, then
// removes the vertex itself.  This is a convenience wrapper around the
// underlying RemoveEdge + RemoveVertex calls.
func (d *Graph[V]) RemoveEdgesFirst(v V) error {
	adj, err := d.g.AdjacencyMap()
	if err != nil {
		return err
	}
	// Remove outgoing edges.
	outEdges, ok := adj[v]
	if ok {
		for to := range outEdges {
			_ = d.g.RemoveEdge(v, to)
		}
	}
	// Remove incoming edges.
	pred, err := d.g.PredecessorMap()
	if err != nil {
		return err
	}
	inEdges, ok := pred[v]
	if ok {
		for from := range inEdges {
			_ = d.g.RemoveEdge(from, v)
		}
	}
	return d.g.RemoveVertex(v)
}

// Nodes returns all node values in the graph.
func (d *Graph[V]) Nodes() ([]V, error) {
	adj, err := d.g.AdjacencyMap()
	if err != nil {
		return nil, err
	}
	var nodes []V
	for v := range adj {
		nodes = append(nodes, v)
	}
	return nodes, nil
}

// HasNode reports whether v exists in the graph.
func (d *Graph[V]) HasNode(v V) bool {
	_, err := d.g.Vertex(v)
	return err == nil
}

// Successors returns the immediate successors (out-neighbours) of v.
func (d *Graph[V]) Successors(v V) ([]V, error) {
	adj, err := d.g.AdjacencyMap()
	if err != nil {
		return nil, err
	}
	outEdges, ok := adj[v]
	if !ok {
		return nil, nil
	}
	var succs []V
	for t := range outEdges {
		succs = append(succs, t)
	}
	return succs, nil
}

// Predecessors returns the immediate predecessors (in-neighbours) of v.
func (d *Graph[V]) Predecessors(v V) ([]V, error) {
	pred, err := d.g.PredecessorMap()
	if err != nil {
		return nil, err
	}
	inEdges, ok := pred[v]
	if !ok {
		return nil, nil
	}
	var preds []V
	for f := range inEdges {
		preds = append(preds, f)
	}
	return preds, nil
}

// Order returns the number of nodes in the graph.
func (d *Graph[V]) Order() (int, error) {
	return d.g.Order()
}

// Size returns the number of edges in the graph.
func (d *Graph[V]) Size() (int, error) {
	return d.g.Size()
}

// HasCycle reports whether the graph contains a directed cycle.
// This is an O(V+E) check using graph.TopologicalSort; a cycle causes
// TopologicalSort to return an error.
func (d *Graph[V]) HasCycle() bool {
	_, err := graph.TopologicalSort(d.g)
	return err != nil
}

// TopologicalSort returns a linear ordering of the nodes such that for every
// directed edge u -> v, u comes before v in the ordering.
// Returns an error if the graph contains a cycle.
func (d *Graph[V]) TopologicalSort() ([]V, error) {
	return graph.TopologicalSort(d.g)
}

// CriticalPath returns the longest path (by edge weight sum) from 'from' to 'to'.
// Edge weights are set via graph.EdgeWeight(n) when calling AddEdge.
// If no weight is set on an edge, the edge is assumed to have weight 1.
//
// Uses a topological ordering followed by single-source longest-path relaxation
// (DAG property allows O(V+E) computation).
//
// Returns ErrNoPath if no path exists between the two nodes.
func (d *Graph[V]) CriticalPath(from, to V) ([]V, error) {
	// Validate endpoints.
	if !d.HasNode(from) {
		return nil, fmt.Errorf("node %v not found in graph", from)
	}
	if !d.HasNode(to) {
		return nil, fmt.Errorf("node %v not found in graph", to)
	}

	// Build adjacency list and edge-weight map from AdjacencyMap.
	adj, err := d.g.AdjacencyMap()
	if err != nil {
		return nil, err
	}

	adjList := make(map[V][]V)
	edgeWeight := make(map[[2]V]float64)
	for src, outgoing := range adj {
		for tgt, e := range outgoing {
			adjList[src] = append(adjList[src], tgt)
			props := e.Properties
			w := 1.0
			if props.Weight != 0 {
				w = float64(props.Weight)
			}
			edgeWeight[[2]V{src, tgt}] = w
		}
	}

	// Topological order from 'from' using DFS on reachable subgraph.
	order := topologicalFrom(from, adjList)

	// Longest-path relaxation (DAG).
	dist := make(map[V]float64)
	prev := make(map[V]V)
	dist[from] = 0
	prev[from] = from

	for _, n := range order {
		for _, s := range adjList[n] {
			w := edgeWeight[[2]V{n, s}]
			if dist[s] < dist[n]+w {
				dist[s] = dist[n] + w
				prev[s] = n
			}
		}
	}

	if _, ok := dist[to]; !ok {
		return nil, fmt.Errorf("no path from %v to %v", from, to)
	}

	// Reconstruct path.
	path := []V{to}
	for cur := prev[to]; cur != from; cur = prev[cur] {
		path = append([]V{cur}, path...)
	}
path = append([]V{from}, path...)
	return path, nil
}

// topologicalFrom returns a topological ordering of all nodes reachable from
// the source using a DFS-based algorithm.
func topologicalFrom[V comparable](src V, adj map[V][]V) []V {
	visited := make(map[V]bool)
	var order []V

	var visit func(V)
	visit = func(v V) {
		if visited[v] {
			return
		}
		visited[v] = true
		for _, s := range adj[v] {
			visit(s)
		}
		order = append(order, v)
	}

	visit(src)
	return order
}
