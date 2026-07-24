package versionchart

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// Logger interface (abstracted for testability)
// ---------------------------------------------------------------------------

// Logger abstracts structured logging so the renderer is decoupled from a
// specific logging library (e.g. zap, log/slog).
type Logger interface {
	Info(msg string, fields ...interface{})
	Warn(msg string, fields ...interface{})
	Error(msg string, fields ...interface{})
	Debug(msg string, fields ...interface{})
}

// nopLogger is a no-op logger used when none is configured.
type nopLogger struct{}

func (nopLogger) Info(string, ...interface{})  {}
func (nopLogger) Warn(string, ...interface{})  {}
func (nopLogger) Error(string, ...interface{}) {}
func (nopLogger) Debug(string, ...interface{}) {}

// ---------------------------------------------------------------------------
// Renderer — produces chart data from version entries
// ---------------------------------------------------------------------------

// Renderer transforms a collection of VersionEntry values into chart payloads
// for timeline, comparison, and tree views.
type Renderer struct {
	// logger is used for structured logging. Nil uses a no-op logger.
	logger Logger

	// source is the external data provider. If nil, the renderer uses an
	// in-memory cache populated via AddEntries.
	source DataSource

	// entries holds the cached version entries used when source is nil.
	entries []*VersionEntry
	mu      sync.RWMutex
}

// DataSource is the interface a Repository or Service layer implements to
// supply version data for chart rendering.
type DataSource interface {
	ListVersions(ctx context.Context, tenantID string, rng VersionRange) ([]*VersionEntry, error)
	GetVersion(ctx context.Context, tenantID string, version string) (*VersionEntry, error)
	ListDependencies(ctx context.Context, tenantID string, version string) ([]string, error)
}

// RendererOption configures a Renderer.
type RendererOption func(*Renderer)

// WithLogger sets a structured logger on the renderer.
func WithLogger(l Logger) RendererOption {
	return func(r *Renderer) { r.logger = l }
}

// WithDataSource sets the data source used by the renderer.
func WithDataSource(s DataSource) RendererOption {
	return func(r *Renderer) { r.source = s }
}

// NewRenderer creates a new Renderer with the given options.
func NewRenderer(opts ...RendererOption) *Renderer {
	r := &Renderer{
		logger: nopLogger{},
	}
	for _, opt := range opts {
		opt(r)
	}
	return r
}

// AddEntries adds version entries to the renderer's in-memory cache. This is
// used when no DataSource is configured (e.g. for testing or small workloads).
func (r *Renderer) AddEntries(entries ...*VersionEntry) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, e := range entries {
		r.entries = append(r.entries, e)
	}
}

// Render generates the chart data for the given VersionChart configuration.
// It dispatches to the appropriate renderer based on chart.Type.
func (r *Renderer) Render(ctx context.Context, tenantID string, chart *VersionChart) error {
	r.logger.Info("rendering version chart",
		"type", chart.Type,
		"range", chart.Range,
		"tenant", tenantID,
	)

	var err error
	switch chart.Type {
	case ChartTypeTimeline:
		chart.Data, err = r.renderTimeline(ctx, tenantID, chart.Range)
	case ChartTypeComparison:
		chart.Data, err = r.renderComparison(ctx, tenantID, chart.Range)
	case ChartTypeTree:
		chart.Data, err = r.renderTree(ctx, tenantID, chart.Range)
	default:
		return fmt.Errorf("unknown chart type: %q", chart.Type)
	}

	chart.Metadata.CreatedAt = time.Now().UTC()
	return err
}

// RenderDependencyGraph builds a DependencyGraph for the given version set.
func (r *Renderer) RenderDependencyGraph(ctx context.Context, tenantID string, versions []string) (*DependencyGraph, error) {
	r.logger.Info("rendering dependency graph", "versions", len(versions), "tenant", tenantID)

	nodes := make([]GraphNode, 0, len(versions))
	edges := make([]GraphEdge, 0)

	for _, ver := range versions {
		entry, err := r.fetchVersion(ctx, tenantID, ver)
		if err != nil {
			r.logger.Warn("skipping version in dependency graph", "version", ver, "error", err.Error())
			continue
		}

		group := ""
		if m := entry.Metadata; m["group"] != nil {
			if s, ok := m["group"].(string); ok {
				group = s
			}
		}

		nodes = append(nodes, GraphNode{
			ID:       entry.Version,
			Version:  entry.Version,
			Label:    entry.Version,
			Group:    group,
			Status:   entry.Status,
			Metadata: entry.Metadata,
		})

		// Add edges for each dependency
		for _, dep := range entry.Dependencies {
			edges = append(edges, GraphEdge{
				Source: entry.Version,
				Target: dep,
				Type:   "depends",
				Label:  "depends",
			})
		}
	}

	return &DependencyGraph{Nodes: nodes, Edges: edges}, nil
}

// renderTimeline produces timeline chart data.
func (r *Renderer) renderTimeline(ctx context.Context, tenantID string, rng VersionRange) (*TimelineChart, error) {
	entries, err := r.fetchAllVersions(ctx, tenantID, rng)
	if err != nil {
		return nil, err
	}

	total := len(entries)
	if rng.Limit > 0 && len(entries) > rng.Limit {
		entries = entries[len(entries)-rng.Limit:]
	}

	versions := make([]VersionEntry, len(entries))
	for i, e := range entries {
		versions[i] = *e
	}

	// Sort by SemVer (stable, older first)
	sort.SliceStable(versions, func(i, j int) bool {
		return versions[i].SemVer.Compare(&versions[j].SemVer) < 0
	})

	return &TimelineChart{
		Versions: versions,
		Total:    total,
	}, nil
}

// renderComparison produces comparison chart data.
func (r *Renderer) renderComparison(ctx context.Context, tenantID string, rng VersionRange) (*ComparisonChart, error) {
	baseline, err := r.fetchVersion(ctx, tenantID, rng.Start)
	if err != nil {
		return nil, err
	}
	target, err := r.fetchVersion(ctx, tenantID, rng.End)
	if err != nil {
		return nil, err
	}

	diff := r.computeDiff(baseline, target)

	return &ComparisonChart{
		Baseline: baseline,
		Target:   target,
		Diff:     diff,
	}, nil
}

// renderTree produces tree chart data (dependency hierarchy).
func (r *Renderer) renderTree(ctx context.Context, tenantID string, rng VersionRange) (*TreeChart, error) {
	entries, err := r.fetchAllVersions(ctx, tenantID, rng)
	if err != nil {
		return nil, err
	}

	root := r.buildTreeNode(entries)
	leaves := r.countLeaves(root)

	return &TreeChart{
		Root:   root,
		Leaves: leaves,
	}, nil
}

// computeDiff computes the difference between two versions based on their change sets.
func (r *Renderer) computeDiff(baseline, target *VersionEntry) VersionDiff {
	if baseline == nil || target == nil {
		return VersionDiff{}
	}

	baselineSet := make(map[string]ChangeItem)
	for _, c := range baseline.ChangeSet {
		baselineSet[c.Summary] = c
	}

	targetSet := make(map[string]ChangeItem)
	for _, c := range target.ChangeSet {
		targetSet[c.Summary] = c
	}

	var diff VersionDiff

	// Items in target but not in baseline = added
	for summary, item := range targetSet {
		if _, ok := baselineSet[summary]; !ok {
			diff.Added = append(diff.Added, item)
		}
	}

	// Items in baseline but not in target = removed
	for summary, item := range baselineSet {
		if _, ok := targetSet[summary]; !ok {
			diff.Removed = append(diff.Removed, item)
		}
	}

	// Items in both = changed (type differs)
	for summary, bItem := range baselineSet {
		if tItem, ok := targetSet[summary]; ok && bItem.Type != tItem.Type {
			diff.Changed = append(diff.Changed, ChangeItem{
				Type:    tItem.Type,
				Summary: summary,
			})
		}
	}

	return diff
}

// buildTreeNode builds a tree from version entries using the major.minor hierarchy.
func (r *Renderer) buildTreeNode(entries []*VersionEntry) *TreeNode {
	// Group by major.minor
	groups := make(map[string][]*VersionEntry)
	for _, e := range entries {
		key := fmt.Sprintf("%d.%d", e.SemVer.Major, e.SemVer.Minor)
		groups[key] = append(groups[key], e)
	}

	// Build tree: each group becomes a child of the root, sorted by patch
	root := &TreeNode{
		ID:      "root",
		Version: "root",
	}

	for _, group := range groups {
		// Sort patches
		sort.Slice(group, func(i, j int) bool {
			return group[i].SemVer.Patch < group[j].SemVer.Patch
		})
		// Create a chain: the highest patch is the branch head
		for _, e := range group {
			child := &TreeNode{
				ID:      e.Version,
				Version: e.Version,
				CreatedAt: e.CreatedAt,
				Metadata: e.Metadata,
			}
			root.Children = append(root.Children, child)
		}
	}

	return root
}

// countLeaves counts the number of leaf nodes (nodes with no children) in the tree.
func (r *Renderer) countLeaves(node *TreeNode) int {
	if node == nil {
		return 0
	}
	if len(node.Children) == 0 {
		return 1
	}
	count := 0
	for _, child := range node.Children {
		count += r.countLeaves(child)
	}
	return count
}

// ---------------------------------------------------------------------------
// Internal data fetching
// ---------------------------------------------------------------------------

func (r *Renderer) fetchAllVersions(ctx context.Context, tenantID string, rng VersionRange) ([]*VersionEntry, error) {
	if r.source != nil {
		return r.source.ListVersions(ctx, tenantID, rng)
	}
	return r.cachedEntries(), nil
}

func (r *Renderer) fetchVersion(ctx context.Context, tenantID string, version string) (*VersionEntry, error) {
	if r.source != nil {
		return r.source.GetVersion(ctx, tenantID, version)
	}
	return r.cachedEntry(version)
}

func (r *Renderer) cachedEntries() []*VersionEntry {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]*VersionEntry, len(r.entries))
	copy(result, r.entries)
	return result
}

func (r *Renderer) cachedEntry(version string) (*VersionEntry, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, e := range r.entries {
		if e.Version == version {
			return e, nil
		}
	}
	return nil, ErrInvalidVersion
}
