package engine

import (
        "context"
        "errors"
        "fmt"
        "sort"
        "sync"
        "time"
)

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------

var (
        ErrCycleDetected     = errors.New("cycle detected in stage dependencies")
        ErrUnknownDependency = errors.New("stage depends on an unknown stage")
        ErrNoStages          = errors.New("pipeline has no stages")
)

// ---------------------------------------------------------------------------
// DependencyGraph — immutable topology over stage names
// ---------------------------------------------------------------------------

type DependencyGraph struct {
        // name -> [prerequisite stage names]
        deps    map[string][]string
        stages  map[string]*Stage
        visited map[string]bool
}

// NewDependencyGraph validates the stage dependency graph and builds an index.
// It returns ErrCycleDetected when the graph is cyclic, or
// ErrUnknownDependency when a stage references a non-existent peer.
func NewDependencyGraph(stages []Stage) (*DependencyGraph, error) {
        if len(stages) == 0 {
                return nil, ErrNoStages
        }
        g := &DependencyGraph{
                deps:    make(map[string][]string, len(stages)),
                stages:  make(map[string]*Stage, len(stages)),
                visited: make(map[string]bool),
        }
        byName := make(map[string]*Stage, len(stages))
        for i := range stages {
                s := &stages[i]
                byName[s.Name] = s
                g.stages[s.Name] = s
                g.deps[s.Name] = make([]string, len(s.DependsOn))
                copy(g.deps[s.Name], s.DependsOn)
        }
        // Validate that every dependency name exists.
        for name, prereqs := range g.deps {
                for _, p := range prereqs {
                        if _, ok := byName[p]; !ok {
                                return nil, fmt.Errorf("%w: %q depends on %q", ErrUnknownDependency, name, p)
                        }
                }
        }
        if err := g.detectCycle(); err != nil {
                return nil, err
        }
        return g, nil
}

// Order returns a topological ordering of stage names (Kahn's algorithm).
// Independent stages are sorted by name for deterministic output.
func (g *DependencyGraph) Order() []string {
        inDeg := make(map[string]int, len(g.stages))
        succ := make(map[string][]string, len(g.stages))
        for name := range g.stages {
                if _, ok := inDeg[name]; !ok {
                        inDeg[name] = 0
                }
                for _, dep := range g.deps[name] {
                        succ[dep] = append(succ[dep], name)
                }
        }
        for name, prereqs := range g.deps {
                inDeg[name] = len(prereqs)
        }

        var queue []string
        for name, deg := range inDeg {
                if deg == 0 {
                        queue = append(queue, name)
                }
        }
        sort.Strings(queue)

        var order []string
        for len(queue) > 0 {
                cur := queue[0]
                queue = queue[1:]
                order = append(order, cur)
                for _, succName := range succ[cur] {
                        inDeg[succName]--
                        if inDeg[succName] == 0 {
                                queue = append(queue, succName)
                        }
                }
                sort.Strings(queue)
        }
        return order
}

// LevelGroups returns stage names grouped into levels that can be executed
// in parallel. All stages in the same level have no mutual dependencies.
func (g *DependencyGraph) LevelGroups() [][]string {
        levels := make([][]string, 0)
        remaining := make(map[string]bool, len(g.stages))
        completed := make(map[string]bool)
        for name := range g.stages {
                remaining[name] = true
        }
        for len(remaining) > 0 {
                var level []string
                for name := range remaining {
                        if g.depsReady(name, completed) {
                                level = append(level, name)
                        }
                }
                if len(level) == 0 {
                        break // shouldn't happen — cycle already rejected
                }
                sort.Strings(level)
                levels = append(levels, level)
                for _, name := range level {
                        delete(remaining, name)
                        completed[name] = true
                }
        }
        return levels
}

func (g *DependencyGraph) depsReady(name string, completed map[string]bool) bool {
        for _, dep := range g.deps[name] {
                if !completed[dep] {
                        return false
                }
        }
        return true
}

// Stage returns the stage by name, or nil.
func (g *DependencyGraph) Stage(name string) *Stage {
        return g.stages[name]
}

// Deps returns the prerequisite names for a stage.
func (g *DependencyGraph) Deps(name string) []string {
        return g.deps[name]
}

// Stages returns the set of stage names.
func (g *DependencyGraph) Stages() []string {
        var names []string
        for name := range g.stages {
                names = append(names, name)
        }
        sort.Strings(names)
        return names
}

// detectCycle returns ErrCycleDetected when the graph contains a cycle.
func (g *DependencyGraph) detectCycle() error {
        seen := make(map[string]bool)
        visited := make(map[string]bool)
        var dfs func(name string) error
        dfs = func(name string) error {
                if visited[name] {
                        return nil
                }
                if seen[name] {
                        return fmt.Errorf("%w involving stage %q", ErrCycleDetected, name)
                }
                seen[name] = true
                for _, dep := range g.deps[name] {
                        if err := dfs(dep); err != nil {
                                return err
                        }
                }
                seen[name] = false
                visited[name] = true
                return nil
        }
        for name := range g.stages {
                if err := dfs(name); err != nil {
                        return err
                }
        }
        return nil
}

// ---------------------------------------------------------------------------
// Scheduler — parallel stage dispatcher
// ---------------------------------------------------------------------------

// Scheduler coordinates stage execution based on the dependency graph.
// It dispatches ready stages (all dependencies met) in parallel, up to
// Config.MaxConcurrency.
type Scheduler struct {
        graph  *DependencyGraph
        config Config
}

// NewScheduler returns a Scheduler for the given pipeline stages.
func NewScheduler(stages []Stage, config Config) (*Scheduler, error) {
        graph, err := NewDependencyGraph(stages)
        if err != nil {
                return nil, err
        }
        return &Scheduler{graph: graph, config: config}, nil
}

// Order returns a linear topological ordering of stage names.
func (s *Scheduler) Order() []string {
        return s.graph.Order()
}

// Levels returns groups of stages that may run in parallel.
func (s *Scheduler) Levels() [][]string {
        return s.graph.LevelGroups()
}

// Result records the outcome of a dispatched stage.
type Result struct {
        Name   string
        Status StageStatus
        Error  string
        Output map[string]string
}

// ExecuteCtx runs all stages respecting dependencies and concurrency limits.
// The perStage callback is invoked once for each stage; it is responsible for
// executing the stage's tasks and returning a Result. ExecuteCtx returns true
// if any stage failed.
func (s *Scheduler) ExecuteCtx(ctx context.Context, perStage func(ctx context.Context, name string) *Result) ([]*Result, error) {
        results := make([]*Result, 0, len(s.graph.stages))
        completed := make(map[string]bool)
        failed := make(map[string]bool)
        var mu sync.Mutex

        levels := s.Levels()
        for _, level := range levels {
                var wg sync.WaitGroup
                resultCh := make(chan *Result, len(level))

                sem := make(chan struct{}, s.config.MaxConcurrency)
                for _, name := range level {
                        wg.Add(1)
                        sem <- struct{}{}
                        go func(stg string) {
                                defer func() {
                                        wg.Done()
                                        <-sem
                                }()
                                if s.depFailed(stg, failed) {
                                        resultCh <- &Result{Name: stg, Status: StageStatusSkipped, Error: "dependency failed"}
                                        return
                                }
                                res := perStage(ctx, stg)
                                resultCh <- res
                        }(name)
                }
                go func() {
                        wg.Wait()
                        close(resultCh)
                }()

                for res := range resultCh {
                        mu.Lock()
                        results = append(results, res)
                        if res.Status == StageStatusSuccess || res.Status == StageStatusSkipped {
                                completed[res.Name] = true
                        }
                        if res.Status == StageStatusFailed {
                                failed[res.Name] = true
                        }
                        if res.Status == StageStatusFailed && s.config.OnFailure == FailureModeStop {
                                for _, stg := range s.graph.Stages() {
                                        if completed[stg] || failed[stg] {
                                                continue
                                        }
                                        results = append(results, &Result{Name: stg, Status: StageStatusSkipped, Error: "cancelled (upstream failure)"})
                                }
                        }
                        mu.Unlock()
                }
                if s.config.OnFailure == FailureModeStop && len(failed) > 0 {
                        break
                }
        }
        return results, nil
}

// depFailed reports whether any prerequisite of name is in the failed set.
func (s *Scheduler) depFailed(name string, failed map[string]bool) bool {
        for _, dep := range s.graph.deps[name] {
                if failed[dep] {
                        return true
                }
        }
        return false
}

// ---------------------------------------------------------------------------
// Retry — exponential backoff for task handlers
// ---------------------------------------------------------------------------

// RetryConfig holds retry parameters for a single task.
type RetryConfig struct {
        MaxAttempts int
        BaseDelay   time.Duration
        MaxDelay    time.Duration
}

// Retry executes fn up to MaxAttempts times with exponential backoff.
// It returns the number of attempts made and the final error (nil on success).
func Retry(ctx context.Context, rc RetryConfig, fn func() error) (int, error) {
        if rc.MaxAttempts <= 0 {
                rc.MaxAttempts = 1
        }
        if rc.MaxDelay == 0 {
                rc.MaxDelay = 10 * time.Second
        }
        for attempt := 1; attempt <= rc.MaxAttempts; attempt++ {
                if err := fn(); err == nil {
                        return attempt, nil
                } else if attempt < rc.MaxAttempts {
                        delay := rc.BackoffDelay(attempt)
                        timer := time.NewTimer(delay)
                        select {
                        case <-ctx.Done():
                                timer.Stop()
                                return attempt, ctx.Err()
                        case <-timer.C:
                        }
                }
        }
        return rc.MaxAttempts, errors.New("max retries exceeded")
}

// BackoffDelay returns the delay for a given (1-indexed) attempt.
func (rc RetryConfig) BackoffDelay(attempt int) time.Duration {
        delay := rc.BaseDelay << uint(attempt-1)
        if delay > rc.MaxDelay {
                delay = rc.MaxDelay
        }
        return delay
}
