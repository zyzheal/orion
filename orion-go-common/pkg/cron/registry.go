package cron

import (
	"errors"
	"sort"
	"strings"
	"sync"
)

// ErrDuplicateJob is returned when a job name is already registered.
var ErrDuplicateJob = errors.New("cron: duplicate job name")

// ErrCycleDetected is returned when job dependencies contain a cycle.
var ErrCycleDetected = errors.New("cron: dependency cycle detected")

// ErrUnknownDependency is returned when a dependency references an unknown job.
var ErrUnknownDependency = errors.New("cron: unknown dependency")

// JobSpec describes how to schedule an IJob within the registry.  It is
// consumed by the scheduler when building the run graph.
type JobSpec struct {
	// Name is the job identifier (must match IJob.Name()).
	Name string

	// Spec is the cron expression string.
	Spec string

	// Job is the handler implementation.
	Job IJob

	// RetryPolicy overrides the job's built-in Retry()/Timeout() defaults.
	// Set Enabled=true to activate explicit overrides.
	RetryPolicy RetryPolicy

	// Concurrency controls how many instances of the same job may run at once.
	// 0 or 1 = serial; >1 = allow parallel instances.
	Concurrency int
}

// DependencyChain captures the directed edge graph between jobs.
type DependencyChain struct {
	// DependsOn lists job names that MUST complete successfully before this
	// job is eligible to run.
	DependsOn []string

	// OnParentFailure controls behaviour when a dependency fails:
	//  - "skip" (default): this job is skipped until the chain recovers
	//  - "run_anyway": this job still fires
	OnParentFailure string

	// WaitTimeout is how long to wait for a dependency's output before the
	// scheduler gives up on the chain.  Default 0 = no timeout (immediate).
	WaitTimeout int
}

// ---------------------------------------------------------------------------
// Registry holds the canonical set of scheduled jobs and their metadata.
// It is the single source of truth that the Scheduler reads from at start-up
// and at registration time.
// ---------------------------------------------------------------------------

type Registry struct {
	mu    sync.RWMutex
	specs map[string]JobSpec        // name -> spec
	deps  map[string]DependencyChain // name -> dependency chain

	// chainGraph is a pre-computed topological order; nil means "not built".
	chainGraph []string

	// chainOrderDirty forces a rebuild on next GetChainOrder.
	chainOrderDirty bool
}

// NewRegistry creates an empty registry.
func NewRegistry() *Registry {
	return &Registry{
		specs:           make(map[string]JobSpec),
		deps:            make(map[string]DependencyChain),
		chainOrderDirty: true,
	}
}

// ---------------------------------------------------------------------------
// Mutation API
// ---------------------------------------------------------------------------

// Register adds a JobSpec to the registry.  Panics when Name() != spec.Name
// (safety guard) or when Name is already taken.
func (r *Registry) Register(spec JobSpec) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	name := strings.ToLower(spec.Name)
	if name == "" {
		return errors.New("cron: job name must not be empty")
	}
	if spec.Job == nil {
		return errors.New("cron: job must not be nil")
	}
	if strings.ToLower(spec.Job.Name()) != name {
		return errors.New("cron: spec.Name must match IJob.Name()")
	}
	if _, exists := r.specs[name]; exists {
		return ErrDuplicateJob
	}

	spec.Name = name // normalise
	r.specs[name] = spec
	r.chainOrderDirty = true
	return nil
}

// Unregister removes a job and its dependency edges.
func (r *Registry) Unregister(name string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	name = strings.ToLower(name)
	delete(r.specs, name)
	delete(r.deps, name)
	r.chainOrderDirty = true
}

// SetDependencyChain configures the dependency edges for a named job.
// The caller must provide only known job names; unknown references return
// ErrUnknownDependency.  Passing dependsOn=nil clears the chain.
func (r *Registry) SetDependencyChain(name string, dep DependencyChain) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	name = strings.ToLower(name)
	if _, ok := r.specs[name]; !ok {
		return errors.New("cron: job not found: " + name)
	}

	// Validate names exist.
	for _, d := range dep.DependsOn {
		dn := strings.ToLower(d)
		if _, ok := r.specs[dn]; !ok {
			return ErrUnknownDependency
		}
	}

	// Cycle detection (simple DFS on the proposed graph).
	if cycle := r.detectCycleLocked(name, dep); cycle {
		return ErrCycleDetected
	}

	r.deps[name] = dep
	r.chainOrderDirty = true
	return nil
}

// ---------------------------------------------------------------------------
// Query API
// ---------------------------------------------------------------------------

// Get returns the JobSpec for a named job.
func (r *Registry) Get(name string) (JobSpec, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	s, ok := r.specs[strings.ToLower(name)]
	return s, ok
}

// AllSpecs returns a sorted list of every registered spec.
func (r *Registry) AllSpecs() []JobSpec {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]JobSpec, 0, len(r.specs))
	// Sort keys for deterministic output.
	keys := make([]string, 0, len(r.specs))
	for k := range r.specs {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		out = append(out, r.specs[k])
	}
	return out
}

// Dependencies returns the dependency chain for a named job.
func (r *Registry) Dependencies(name string) DependencyChain {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.deps[strings.ToLower(name)]
}

// HasDependency returns whether the named job depends on another.
func (r *Registry) HasDependency(job, target string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	jn := strings.ToLower(job)
	target = strings.ToLower(target)
	for _, d := range r.deps[jn].DependsOn {
		if strings.ToLower(d) == target {
			return true
		}
	}
	return false
}

// GetChainOrder returns a topological ordering of all registered jobs such
// that dependencies always appear before dependents.  Callers run jobs in
// this order so the scheduler respects the chain.  Jobs not part of any
// chain appear first in sorted order.
func (r *Registry) GetChainOrder() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if !r.chainOrderDirty {
		cp := make([]string, len(r.chainGraph))
		copy(cp, r.chainGraph)
		return cp
	}

	g := r.topologicalOrderLocked()
	r.chainGraph = g
	r.chainOrderDirty = false
	return g
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// detectCycleLocked checks whether adding dep to name would create a cycle.
// The registry mutex must already be held.
func (r *Registry) detectCycleLocked(name string, dep DependencyChain) bool {
	// Build temporary adjacency list.
	adj := make(map[string][]string)
	for k, v := range r.deps {
		adj[k] = make([]string, len(v.DependsOn))
		copy(adj[k], v.DependsOn)
	}
	// Add the proposed edges.
	adj[name] = make([]string, len(dep.DependsOn))
	copy(adj[name], dep.DependsOn)

	visited := make(map[string]int) // 0=unseen, 1=in-stack, 2=done

	var dfs func(n string) bool
	dfs = func(n string) bool {
		if v, ok := visited[n]; ok {
			return v == 1 // 1 = cycle
		}
		visited[n] = 1
		for _, next := range adj[n] {
			next = strings.ToLower(next)
			if dfs(next) {
				return true
			}
		}
		visited[n] = 2
		return false
	}

	for n := range adj {
		if visited[n] == 0 {
			if dfs(n) {
				return true
			}
		}
	}
	return false
}

// topologicalOrderLocked returns a Kahn's-algorithm topological sort of the
// dependency graph.  The registry mutex must already be held.
func (r *Registry) topologicalOrderLocked() []string {
	// Build in-degree map.
	indeg := make(map[string]int)
	adj := make(map[string][]string)
	for name := range r.specs {
		indeg[name] = 0
	}
	for n, dep := range r.deps {
		for _, d := range dep.DependsOn {
			dn := strings.ToLower(d)
			adj[dn] = append(adj[dn], n)
			indeg[n]++
		}
	}

	// Seed with nodes that have zero in-degree, in sorted order.
	queue := make([]string, 0, len(r.specs))
	for n := range indeg {
		if indeg[n] == 0 {
			queue = append(queue, n)
		}
	}
	sort.Strings(queue)

	out := make([]string, 0, len(r.specs))
	for len(queue) > 0 {
		n := queue[0]
		queue = queue[1:]
		out = append(out, n)

		for _, next := range adj[n] {
			indeg[next]--
			if indeg[next] == 0 {
				queue = append(queue, next)
				sort.Strings(queue) // keep deterministic
			}
		}
	}
	return out
}
