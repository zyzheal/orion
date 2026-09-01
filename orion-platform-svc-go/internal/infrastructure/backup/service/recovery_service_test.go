package service

import (
	"testing"
	"time"

	"orion/platform-svc-go/internal/infrastructure/backup/models"
)

func TestArchiveTypeFor(t *testing.T) {
	cases := map[string]models.ArchiveType{
		"wal":       models.ArchiveTypeWAL,
		"WAL":       models.ArchiveTypeWAL,
		"Wal":       models.ArchiveTypeWAL,
		"binlog":    models.ArchiveTypeBinlog,
		"Binlog":    models.ArchiveTypeBinlog,
		"BINLOG":    models.ArchiveTypeBinlog,
		"":          models.ArchiveTypeWAL, // default
		"something": models.ArchiveTypeWAL, // default
	}
	for in, want := range cases {
		if got := archiveTypeForPITRMode(in); got != want {
			t.Fatalf("archiveTypeFor(%q) = %q, want %q", in, got, want)
		}
	}
}
func makeArchive(ws time.Time) models.ArchiveRecord {
	return models.ArchiveRecord{WindowStart: ws}
}

// TestRpoFromArchives_UsesNewestCommitBeforeTarget verifies RPO uses the
// newest segment commit (WindowStart) on or before the target — not the last
// segment overall, which may have committed after the target (G7).
func TestRpoFromArchives_UsesNewestCommitBeforeTarget(t *testing.T) {
	target := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)
	archives := []models.ArchiveRecord{
		makeArchive(target.Add(-30 * time.Minute)), // 11:30 commit
		makeArchive(target.Add(-15 * time.Minute)), // 11:45 commit — newest before target
		makeArchive(target.Add(5 * time.Minute)),   // 12:05 commit — after target, ignored by RPO
	}
	rpoMs, anchor := rpoFromArchives(archives, target, nil)
	wantMs := int64(15 * time.Minute / time.Millisecond)
	if rpoMs != wantMs {
		t.Fatalf("RPO = %dms want %dms", rpoMs, wantMs)
	}
	if anchor == nil || !anchor.Equal(target.Add(-15*time.Minute)) {
		t.Fatalf("anchor = %v want 11:45", anchor)
	}
}

// TestRpoFromArchives_NoCommitBeforeTargetFallsBackToBase verifies that when
// every archive commits after the target, refresh falls back to the base
// backup completion timestamp.
func TestRpoFromArchives_NoCommitBeforeTargetFallsBackToBase(t *testing.T) {
	target := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)
	base := target.Add(-2 * time.Hour)
	archives := []models.ArchiveRecord{
		makeArchive(target.Add(1 * time.Minute)),
		makeArchive(target.Add(10 * time.Minute)),
	}
	rpoMs, anchor := rpoFromArchives(archives, target, &base)
	wantMs := int64(2 * time.Hour / time.Millisecond)
	if rpoMs != wantMs {
		t.Fatalf("RPO = %dms want %dms", rpoMs, wantMs)
	}
	if anchor == nil || !anchor.Equal(base) {
		t.Fatalf("anchor = %v want base %v", anchor, base)
	}
}

// TestRpoFromArchives_NoArchivesUsesBase verifies the no-archive case keys
// off the base backup completion time only.
func TestRpoFromArchives_NoArchivesUsesBase(t *testing.T) {
	target := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)
	base := target.Add(-90 * time.Minute)
	rpoMs, anchor := rpoFromArchives(nil, target, &base)
	wantMs := int64(90 * time.Minute / time.Millisecond)
	if rpoMs != wantMs {
		t.Fatalf("RPO = %dms want %dms", rpoMs, wantMs)
	}
	if anchor == nil || !anchor.Equal(base) {
		t.Fatalf("anchor = %v want base %v", anchor, base)
	}
}

// TestRpoFromArchives_NilAnchor verifies the empty case: no archives and no
// base completion → nil anchor (caller surfaces an "imprecise RPO" warning).
func TestRpoFromArchives_NilAnchor(t *testing.T) {
	rpoMs, anchor := rpoFromArchives(nil, time.Now(), nil)
	if rpoMs != 0 || anchor != nil {
		t.Fatalf("expected zero RPO and nil anchor, got %dms / %v", rpoMs, anchor)
	}
}

// TestRpoFromArchives_ExactMatchConsidersTargetBoundary verifies a segment
// committing exactly at the target yields RPO=0 (data is fully recoverable
// to the precise point).
func TestRpoFromArchives_ExactMatchConsidersTargetBoundary(t *testing.T) {
	target := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)
	archives := []models.ArchiveRecord{
		makeArchive(target.Add(-20 * time.Minute)),
		makeArchive(target), // commits exactly at target
	}
	rpoMs, anchor := rpoFromArchives(archives, target, nil)
	if rpoMs != 0 {
		t.Fatalf("RPO = %dms want 0ms", rpoMs)
	}
	if anchor == nil || !anchor.Equal(target) {
		t.Fatalf("anchor = %v want target %v", anchor, target)
	}
}
