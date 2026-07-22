package dag

import "github.com/dominikbraun/graph"

// Option is a functional option for configuring a Graph.
type Option[V comparable] func() func(*graph.Traits)

// Acyclic enforces the acyclic constraint; AddEdge will reject edges that
// would introduce a cycle.  This is enabled by default in New().
func Acyclic[V comparable]() Option[V] {
	return func() func(*graph.Traits) {
		return graph.Acyclic()
	}
}

// Directed explicitly marks the graph as directed.  This is enabled by default.
func Directed[V comparable]() Option[V] {
	return func() func(*graph.Traits) {
		return graph.Directed()
	}
}

// PreventCycles blocks edge additions that would create a cycle.
// This is stricter than Acyclic — it panics on cycle-creating edges
// rather than returning an error.
func PreventCycles[V comparable]() Option[V] {
	return func() func(*graph.Traits) {
		return graph.PreventCycles()
	}
}

// Rooted treats the graph as a rooted tree structure.
func Rooted[V comparable]() Option[V] {
	return func() func(*graph.Traits) {
		return graph.Rooted()
	}
}

// Tree enforces tree structure constraints.
func Tree[V comparable]() Option[V] {
	return func() func(*graph.Traits) {
		return graph.Tree()
	}
}
