package versionchart

import "time"

// ---------------------------------------------------------------------------
// Chart type constants
// ---------------------------------------------------------------------------

const (
	ChartTypeTimeline   = "timeline"
	ChartTypeComparison = "comparison"
	ChartTypeTree       = "tree"
)

// ---------------------------------------------------------------------------
// VersionChart — top-level chart descriptor
// ---------------------------------------------------------------------------

// VersionChart defines a chart configuration and its rendered data.
type VersionChart struct {
	// Type is one of ChartTypeTimeline, ChartTypeComparison, ChartTypeTree.
	Type string `json:"type"`

	// Range defines which versions are included.
	Range VersionRange `json:"range"`

	// Metadata holds chart-level annotations.
	Metadata ChartMetadata `json:"metadata,omitempty"`

	// Data holds the rendered chart payload (set by the renderer).
	Data any `json:"data,omitempty"`
}

// VersionRange specifies a start and end version (inclusive) for the chart.
type VersionRange struct {
	Start string `json:"start,omitempty"`
	End   string `json:"end,omitempty"`
	// Limit caps the number of versions returned (0 = no limit).
	Limit int `json:"limit,omitempty"`
}

// ChartMetadata holds optional chart annotations.
type ChartMetadata struct {
	Title       string            `json:"title,omitempty"`
	Description string            `json:"description,omitempty"`
	Labels      map[string]string `json:"labels,omitempty"`
	CreatedAt   time.Time         `json:"createdAt"`
}

// ---------------------------------------------------------------------------
// Semantic version
// ---------------------------------------------------------------------------

// SemVer represents a semantic version with optional pre-release and build metadata.
// Format: MAJOR.MINOR.PATCH[-prerelease][+build]
type SemVer struct {
	Major      int      `json:"major"`
	Minor      int      `json:"minor"`
	Patch      int      `json:"patch"`
	PreRelease string   `json:"preRelease,omitempty"`
	Build      string   `json:"build,omitempty"`
	// Original is the raw string used for display.
	Original string `json:"original"`
}

// ---------------------------------------------------------------------------
// Version entry (used in timeline and comparison charts)
// ---------------------------------------------------------------------------

// VersionEntry represents a single version point on the chart.
type VersionEntry struct {
	Version    string            `json:"version"`
	SemVer     SemVer            `json:"semVer"`
	CreatedAt  time.Time         `json:"createdAt"`
	Tag        string            `json:"tag,omitempty"`
	Status     string            `json:"status,omitempty"` // e.g. "stable", "rc", "dev"
	ChangeSet  []ChangeItem      `json:"changeSet,omitempty"`
	Dependencies []string       `json:"dependencies,omitempty"`
	Metadata   map[string]any    `json:"metadata,omitempty"`
}

// ChangeItem describes a single change within a version.
type ChangeItem struct {
	Type   string `json:"type"`   // "feature", "fix", "chore", "breaking"
	Summary string `json:"summary"`
}

// ---------------------------------------------------------------------------
// Comparison chart data
// ---------------------------------------------------------------------------

// ComparisonChart holds the rendered data for a comparison chart.
type ComparisonChart struct {
	Baseline *VersionEntry `json:"baseline"`
	Target   *VersionEntry `json:"target"`
	Diff     VersionDiff   `json:"diff"`
}

// VersionDiff holds the computed differences between two versions.
type VersionDiff struct {
	Added   []ChangeItem `json:"added,omitempty"`
	Removed []ChangeItem `json:"removed,omitempty"`
	Changed []ChangeItem `json:"changed,omitempty"`
}

// ---------------------------------------------------------------------------
// Timeline chart data
// ---------------------------------------------------------------------------

// TimelineChart holds the rendered data for a timeline chart.
type TimelineChart struct {
	Versions []VersionEntry `json:"versions"`
	Total    int            `json:"total"`
}

// ---------------------------------------------------------------------------
// Tree chart data (dependency / lineage view)
// ---------------------------------------------------------------------------

// TreeChart holds the rendered data for a tree chart.
type TreeChart struct {
	Root   *TreeNode `json:"root"`
	Leaves int       `json:"leaves"`
}

// TreeNode represents a node in the version tree.
type TreeNode struct {
	ID         string        `json:"id"`
	Version    string        `json:"version"`
	CreatedAt  time.Time     `json:"createdAt"`
	Children   []*TreeNode   `json:"children,omitempty"`
	Metadata   map[string]any `json:"metadata,omitempty"`
}

// ---------------------------------------------------------------------------
// Dependency graph visualization data
// ---------------------------------------------------------------------------

// DependencyGraph is the rendered graph for version dependency visualization.
type DependencyGraph struct {
	Nodes []GraphNode `json:"nodes"`
	Edges []GraphEdge `json:"edges"`
}

// GraphNode is a node in the dependency graph.
type GraphNode struct {
	ID       string `json:"id"`
	Version  string `json:"version"`
	Label    string `json:"label"`
	Group    string `json:"group,omitempty"`   // e.g. service name
	Status   string `json:"status,omitempty"`
	Metadata map[string]any `json:"metadata,omitempty"`
}

// GraphEdge is a directed edge in the dependency graph.
type GraphEdge struct {
	Source  string `json:"source"`
	Target  string `json:"target"`
	Type    string `json:"type,omitempty"`  // "depends", "supersedes", "branch"
	Label   string `json:"label,omitempty"`
	Metadata map[string]any `json:"metadata,omitempty"`
}
