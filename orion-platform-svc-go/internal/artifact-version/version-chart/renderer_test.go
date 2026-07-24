package versionchart

import (
	"context"
	"testing"
	"time"
)

func TestRenderer_RenderTimeline(t *testing.T) {
	renderer := NewRenderer()

	// Add test entries
	renderer.AddEntries(
		&VersionEntry{Version: "1.0.0", SemVer: SemVer{Major: 1, Minor: 0, Patch: 0, Original: "1.0.0"}, CreatedAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)},
		&VersionEntry{Version: "1.1.0", SemVer: SemVer{Major: 1, Minor: 1, Patch: 0, Original: "1.1.0"}, CreatedAt: time.Date(2024, 2, 1, 0, 0, 0, 0, time.UTC)},
		&VersionEntry{Version: "1.2.0", SemVer: SemVer{Major: 1, Minor: 2, Patch: 0, Original: "1.2.0"}, CreatedAt: time.Date(2024, 3, 1, 0, 0, 0, 0, time.UTC)},
	)

	chart := &VersionChart{
		Type:  ChartTypeTimeline,
		Range: VersionRange{Limit: 2},
	}

	err := renderer.Render(context.Background(), "tenant1", chart)
	if err != nil {
		t.Fatalf("Render() error = %v", err)
	}

	timeline, ok := chart.Data.(*TimelineChart)
	if !ok {
		t.Fatal("Expected TimelineChart data")
	}

	if len(timeline.Versions) != 2 {
		t.Errorf("Expected 2 versions, got %d", len(timeline.Versions))
	}

	if timeline.Total != 3 {
		t.Errorf("Expected total 3, got %d", timeline.Total)
	}

	// Verify ordering (sorted by semver)
	if timeline.Versions[0].Version != "1.1.0" {
		t.Errorf("First version = %q, want %q", timeline.Versions[0].Version, "1.1.0")
	}
	if timeline.Versions[1].Version != "1.2.0" {
		t.Errorf("Second version = %q, want %q", timeline.Versions[1].Version, "1.2.0")
	}
}

func TestRenderer_RenderComparison(t *testing.T) {
	renderer := NewRenderer()

	baseline := &VersionEntry{
		Version:  "1.0.0",
		SemVer:   SemVer{Major: 1, Minor: 0, Patch: 0, Original: "1.0.0"},
		ChangeSet: []ChangeItem{
			{Type: "feature", Summary: "add auth"},
			{Type: "fix", Summary: "fix bug"},
		},
	}
	target := &VersionEntry{
		Version:  "1.1.0",
		SemVer:   SemVer{Major: 1, Minor: 1, Patch: 0, Original: "1.1.0"},
		ChangeSet: []ChangeItem{
			{Type: "feature", Summary: "add auth"},
			{Type: "feature", Summary: "add caching"},
			{Type: "fix", Summary: "fix bug"},
		},
	}
	renderer.AddEntries(baseline, target)

	chart := &VersionChart{
		Type: ChartTypeComparison,
		Range: VersionRange{
			Start: "1.0.0",
			End:   "1.1.0",
		},
	}

	err := renderer.Render(context.Background(), "tenant1", chart)
	if err != nil {
		t.Fatalf("Render() error = %v", err)
	}

	comparison, ok := chart.Data.(*ComparisonChart)
	if !ok {
		t.Fatal("Expected ComparisonChart data")
	}

	if len(comparison.Diff.Added) != 1 {
		t.Errorf("Expected 1 added item, got %d", len(comparison.Diff.Added))
	}

	if len(comparison.Diff.Removed) != 0 {
		t.Errorf("Expected 0 removed items, got %d", len(comparison.Diff.Removed))
	}
}

func TestRenderer_RenderTree(t *testing.T) {
	renderer := NewRenderer()

	renderer.AddEntries(
		&VersionEntry{Version: "1.0.0", SemVer: SemVer{Major: 1, Minor: 0, Patch: 0, Original: "1.0.0"}, CreatedAt: time.Now().UTC()},
		&VersionEntry{Version: "1.0.1", SemVer: SemVer{Major: 1, Minor: 0, Patch: 1, Original: "1.0.1"}, CreatedAt: time.Now().UTC()},
		&VersionEntry{Version: "1.1.0", SemVer: SemVer{Major: 1, Minor: 1, Patch: 0, Original: "1.1.0"}, CreatedAt: time.Now().UTC()},
	)

	chart := &VersionChart{
		Type:  ChartTypeTree,
		Range: VersionRange{},
	}

	err := renderer.Render(context.Background(), "tenant1", chart)
	if err != nil {
		t.Fatalf("Render() error = %v", err)
	}

	tree, ok := chart.Data.(*TreeChart)
	if !ok {
		t.Fatal("Expected TreeChart data")
	}

	if tree.Leaves != 3 {
		t.Errorf("Expected 3 leaves, got %d", tree.Leaves)
	}
}

func TestRenderer_RenderDependencyGraph(t *testing.T) {
	renderer := NewRenderer()

	renderer.AddEntries(
		&VersionEntry{Version: "1.0.0", SemVer: SemVer{Major: 1, Minor: 0, Patch: 0, Original: "1.0.0"}, Dependencies: []string{"0.9.0"}, Metadata: map[string]any{"group": "core"}},
		&VersionEntry{Version: "1.1.0", SemVer: SemVer{Major: 1, Minor: 1, Patch: 0, Original: "1.1.0"}, Dependencies: []string{"1.0.0"}, Metadata: map[string]any{"group": "core"}},
	)

	graph, err := renderer.RenderDependencyGraph(context.Background(), "tenant1", []string{"1.0.0", "1.1.0"})
	if err != nil {
		t.Fatalf("RenderDependencyGraph() error = %v", err)
	}

	if len(graph.Nodes) != 2 {
		t.Errorf("Expected 2 nodes, got %d", len(graph.Nodes))
	}

	if len(graph.Edges) != 2 {
		t.Errorf("Expected 2 edges, got %d", len(graph.Edges))
	}
}

func TestRenderer_UnknownChartType(t *testing.T) {
	renderer := NewRenderer()
	chart := &VersionChart{Type: "unknown", Range: VersionRange{}}

	err := renderer.Render(context.Background(), "tenant1", chart)
	if err == nil {
		t.Error("Expected error for unknown chart type")
	}
}
