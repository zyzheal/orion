package executor

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestReplayArchives_EmptyPathsNoop(t *testing.T) {
	r := &RestoreResult{}
	if err := replayArchives(context.Background(), nil, r); err != nil {
		t.Fatal(err)
	}
	if r.ArchReplayed != 0 {
		t.Fatalf("expected 0 replayed, got %d", r.ArchReplayed)
	}
}

func TestReplayArchives_CountsAndSizes(t *testing.T) {
	dir := t.TempDir()
	sizes := []int64{10, 20, 30}
	paths := make([]string, len(sizes))
	for i, sz := range sizes {
		p := filepath.Join(dir, "seg-"+string(rune('a'+i)))
		if err := os.WriteFile(p, make([]byte, int(sz)), 0o600); err != nil {
			t.Fatal(err)
		}
		paths[i] = p
	}
	r := &RestoreResult{}
	if err := replayArchives(context.Background(), paths, r); err != nil {
		t.Fatal(err)
	}
	if r.ArchReplayed != 3 {
		t.Fatalf("expected 3, got %d", r.ArchReplayed)
	}
	if len(r.ArchSizes) != 3 || r.ArchSizes[0] != 10 || r.ArchSizes[2] != 30 {
		t.Fatalf("unexpected sizes: %v", r.ArchSizes)
	}
}

func TestReplayArchives_MissingFileFailsClosed(t *testing.T) {
	r := &RestoreResult{}
	if err := replayArchives(context.Background(), []string{"/definitely/missing/seg"}, r); err == nil {
		t.Fatal("expected error for missing file")
	}
}

func TestReplayArchives_EmptyPathFails(t *testing.T) {
	r := &RestoreResult{}
	if err := replayArchives(context.Background(), []string{""}, r); err == nil {
		t.Fatal("expected error for empty path")
	}
}

func TestReplayArchives_CancelsOnContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	r := &RestoreResult{}
	if err := replayArchives(ctx, []string{"anything"}, r); err == nil {
		t.Fatal("expected cancel error")
	}
}
