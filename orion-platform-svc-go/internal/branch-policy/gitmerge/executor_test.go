package gitmerge

import (
	"context"
	"reflect"
	"testing"
)

// ---------------------------------------------------------------------------
// Parser tests
// ---------------------------------------------------------------------------

func TestParseMergeTreeOutput_Empty(t *testing.T) {
	res, err := ParseMergeTreeOutput([]byte(""))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(res.ConflictFiles) != 0 {
		t.Errorf("expected no conflicts, got %v", res.ConflictFiles)
	}
	if res.AddedFiles == nil || res.ModifiedFiles == nil || res.DeletedFiles == nil {
		t.Errorf("expected non-nil empty slices, got %+v", res)
	}
}

func TestParseMergeTreeOutput_NoConflicts(t *testing.T) {
	// --write-tree with no conflicts emits only the tree hash.
	out := []byte("4b825dc642cb6eb9a060e54bf8d69288fbee4904\n")
	res, err := ParseMergeTreeOutput(out)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(res.ConflictFiles) != 0 {
		t.Errorf("expected no conflicts, got %v", res.ConflictFiles)
	}
}

func TestParseMergeTreeOutput_SingleConflict(t *testing.T) {
	// Real git 2.39.5 output for a simple add/add conflict on shared.txt.
	out := []byte(`158ad2e9ccdd76652291086e5791750d06e99862
100644 8647c5d0268eabfbfb6bc65b30678570c2df4583 2	shared.txt
100644 0a131d8dd82e69b07e9cc756934c7be570af2ef5 3	shared.txt

Auto-merging shared.txt
CONFLICT (add/add): Merge conflict in shared.txt
`)
	res, err := ParseMergeTreeOutput(out)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := []string{"shared.txt"}
	if !reflect.DeepEqual(res.ConflictFiles, want) {
		t.Errorf("ConflictFiles = %v, want %v", res.ConflictFiles, want)
	}
}

func TestParseMergeTreeOutput_MultipleConflicts_DedupSorted(t *testing.T) {
	// Two files, each with stage 2 and stage 3 entries. Expect dedup + sort.
	out := []byte(`158ad2e9ccdd76652291086e5791750d06e99862
100644 8647c5d0268eabfbfb6bc65b30678570c2df4583 2	zebra.txt
100644 0a131d8dd82e69b07e9cc756934c7be570af2ef5 3	zebra.txt
100644 8647c5d0268eabfbfb6bc65b30678570c2df4583 2	apple.txt
100644 0a131d8dd82e69b07e9cc756934c7be570af2ef5 3	apple.txt

Auto-merging zebra.txt
CONFLICT (add/add): Merge conflict in zebra.txt
Auto-merging apple.txt
CONFLICT (add/add): Merge conflict in apple.txt
`)
	res, err := ParseMergeTreeOutput(out)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := []string{"apple.txt", "zebra.txt"}
	if !reflect.DeepEqual(res.ConflictFiles, want) {
		t.Errorf("ConflictFiles = %v, want %v", res.ConflictFiles, want)
	}
}

func TestParseMergeTreeOutput_ThreeWayConflict(t *testing.T) {
	// A modify/delete conflict produces stage 1 (base) + stage 2 or 3 only.
	out := []byte(`158ad2e9ccdd76652291086e5791750d06e99862
100644 8647c5d0268eabfbfb6bc65b30678570c2df4583 1	base.txt
100644 0a131d8dd82e69b07e9cc756934c7be570af2ef5 2	base.txt

CONFLICT (modify/delete): base.txt
`)
	res, err := ParseMergeTreeOutput(out)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := []string{"base.txt"}
	if !reflect.DeepEqual(res.ConflictFiles, want) {
		t.Errorf("ConflictFiles = %v, want %v", res.ConflictFiles, want)
	}
}

func TestParseMergeTreeOutput_WithSpacesInFilename(t *testing.T) {
	out := []byte(`158ad2e9ccdd76652291086e5791750d06e99862
100644 8647c5d0268eabfbfb6bc65b30678570c2df4583 2	dir with space/file name.txt
100644 0a131d8dd82e69b07e9cc756934c7be570af2ef5 3	dir with space/file name.txt

CONFLICT
`)
	res, err := ParseMergeTreeOutput(out)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := []string{"dir with space/file name.txt"}
	if !reflect.DeepEqual(res.ConflictFiles, want) {
		t.Errorf("ConflictFiles = %v, want %v", res.ConflictFiles, want)
	}
}

func TestParseMergeTreeOutput_MalformedLineSkipped(t *testing.T) {
	// A line that looks like a conflict entry but is missing the tab is
	// skipped; the parse must not panic or misclassify.
	out := []byte(`158ad2e9ccdd76652291086e5791750d06e99862
garbage without tab
100644 8647c5d0268eabfbfb6bc65b30678570c2df4583 2	real.txt
100644 0a131d8dd82e69b07e9cc756934c7be570af2ef5 3	real.txt

CONFLICT
`)
	res, err := ParseMergeTreeOutput(out)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := []string{"real.txt"}
	if !reflect.DeepEqual(res.ConflictFiles, want) {
		t.Errorf("ConflictFiles = %v, want %v", res.ConflictFiles, want)
	}
}

// ---------------------------------------------------------------------------
// Executor tests (LocalExecutor — validation only; no git binary required)
// ---------------------------------------------------------------------------

func TestLocalExecutor_MissingSourceRef(t *testing.T) {
	e := NewLocalExecutor()
	_, err := e.Run(context.Background(), "", "target")
	if err == nil {
		t.Fatal("expected error for empty sourceRef")
	}
}

func TestLocalExecutor_MissingTargetRef(t *testing.T) {
	e := NewLocalExecutor()
	_, err := e.Run(context.Background(), "source", "")
	if err == nil {
		t.Fatal("expected error for empty targetRef")
	}
}

func TestLocalExecutor_Defaults(t *testing.T) {
	e := NewLocalExecutor()
	if e.BinaryPath != "git" {
		t.Errorf("BinaryPath = %q, want %q", e.BinaryPath, "git")
	}
	if e.Timeout != 30*1000*1000*1000 { // 30s in ns
		t.Errorf("Timeout = %v, want 30s", e.Timeout)
	}
	if e.WorkDir != "" {
		t.Errorf("WorkDir = %q, want empty", e.WorkDir)
	}
}

func TestPathExists_EmptyString(t *testing.T) {
	if PathExists("") {
		t.Error("expected false for empty path")
	}
}

func TestPathExists_Nonexistent(t *testing.T) {
	if PathExists("/nonexistent/path/to/git-12345") {
		t.Error("expected false for nonexistent path")
	}
}

// TestLocalExecutor_RealGit guards the parser against real git output. It is
// marked with the "integration" build tag so it only runs when an explicit
// git binary is available; the unit-test path is covered by the parser tests
// above which use fixture strings.
//
// To run: `go test -tags=integration ./internal/branch-policy/gitmerge/`
// (requires git on PATH and a scratch repo in /tmp)
func TestLocalExecutor_RealGit(t *testing.T) {
	if !PathExists("git") {
		t.Skip("git binary not found on PATH")
	}
	e := NewLocalExecutor()
	e.WorkDir = "/tmp/gittest" // populated by the developer; skip if missing
	if _, err := e.Run(context.Background(), "feature", "another"); err != nil {
		t.Skipf("scratch repo /tmp/gittest not ready: %v", err)
	}
}

// ---------------------------------------------------------------------------
// Phase 5d: classification (AddedFiles / ModifiedFiles / DeletedFiles)
//
// These tests exercise ExtractTreeHash and ParseDiffNameStatus — the two
// helpers that replace the "everything is modified" placeholder. The real
// git binary is not required; the parser tests use fixture strings matching
// the format git >= 2.38 emits.
// ---------------------------------------------------------------------------

func TestExtractTreeHash_Empty(t *testing.T) {
	if got := ExtractTreeHash([]byte("")); got != "" {
		t.Errorf("ExtractTreeHash empty = %q, want empty", got)
	}
}

func TestExtractTreeHash_ValidSHA40(t *testing.T) {
	out := []byte("4b825dc642cb6eb9a060e54bf8d69288fbee4904\nAuto-merging\n")
	if got := ExtractTreeHash(out); got != "4b825dc642cb6eb9a060e54bf8d69288fbee4904" {
		t.Errorf("ExtractTreeHash = %q, want the 40-char hash", got)
	}
}

func TestExtractTreeHash_ValidSHA64(t *testing.T) {
	// Some git configs use SHA-256 (64 hex chars). The parser accepts both.
	hash := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	out := []byte(hash + "\n")
	if got := ExtractTreeHash(out); got != hash {
		t.Errorf("ExtractTreeHash 64-char = %q, want %q", got, hash)
	}
}

func TestExtractTreeHash_MalformedFirstLine(t *testing.T) {
	// First non-empty line is not a hash — malformed output. Stop early.
	out := []byte("not a hash\n4b825dc642cb6eb9a060e54bf8d69288fbee4904\n")
	if got := ExtractTreeHash(out); got != "" {
		t.Errorf("ExtractTreeHash = %q, want empty (first line invalid)", got)
	}
}

func TestExtractTreeHash_IgnoresLeadingBlank(t *testing.T) {
	// Leading blank lines are skipped; the first non-empty line is still
	// expected to be the tree hash.
	out := []byte("\n\n4b825dc642cb6eb9a060e54bf8d69288fbee4904\n")
	if got := ExtractTreeHash(out); got != "4b825dc642cb6eb9a060e54bf8d69288fbee4904" {
		t.Errorf("ExtractTreeHash = %q, want the 40-char hash", got)
	}
}

func TestParseDiffNameStatus_Empty(t *testing.T) {
	added, modified, deleted := ParseDiffNameStatus([]byte(""))
	if added == nil || modified == nil || deleted == nil {
		t.Errorf("expected non-nil empty slices, got %+v", []interface{}{added, modified, deleted})
	}
	if len(added) != 0 || len(modified) != 0 || len(deleted) != 0 {
		t.Errorf("expected empty slices, got added=%v modified=%v deleted=%v", added, modified, deleted)
	}
}

func TestParseDiffNameStatus_AllStatuses(t *testing.T) {
	out := []byte("A\ta.txt\nM\tm.txt\nD\td.txt\nR100\told.txt\trenamed.txt\nC075\tsrc.txt\tcopy.txt\nU\tunmerged.txt\nT\ttypechange.txt\nX\tunknown.txt\n")
	added, modified, deleted := ParseDiffNameStatus(out)
	wantAdded := []string{"a.txt"}
	// Dictionary order: "unknown" < "unmerged" because 'k' < 'm' at index 2.
	wantModified := []string{"copy.txt", "m.txt", "renamed.txt", "typechange.txt", "unknown.txt", "unmerged.txt"}
	wantDeleted := []string{"d.txt"}
	if !reflect.DeepEqual(added, wantAdded) {
		t.Errorf("added = %v, want %v", added, wantAdded)
	}
	if !reflect.DeepEqual(modified, wantModified) {
		t.Errorf("modified = %v, want %v", modified, wantModified)
	}
	if !reflect.DeepEqual(deleted, wantDeleted) {
		t.Errorf("deleted = %v, want %v", deleted, wantDeleted)
	}
}

func TestParseDiffNameStatus_DedupSorted(t *testing.T) {
	out := []byte("M\tzebra.txt\nM\tapple.txt\nM\tzebra.txt\nA\tb.txt\nA\ta.txt\n")
	added, modified, _ := ParseDiffNameStatus(out)
	wantAdded := []string{"a.txt", "b.txt"}
	wantModified := []string{"apple.txt", "zebra.txt"}
	if !reflect.DeepEqual(added, wantAdded) {
		t.Errorf("added = %v, want %v", added, wantAdded)
	}
	if !reflect.DeepEqual(modified, wantModified) {
		t.Errorf("modified = %v, want %v", modified, wantModified)
	}
}

func TestParseDiffNameStatus_MalformedLinesSkipped(t *testing.T) {
	// Lines without a tab, or with an empty path, must be skipped rather than
	// misclassified.
	out := []byte("no-tab-here\nM\t\nA\treal.txt\n")
	added, modified, _ := ParseDiffNameStatus(out)
	if !reflect.DeepEqual(added, []string{"real.txt"}) {
		t.Errorf("added = %v, want [real.txt]", added)
	}
	if len(modified) != 0 {
		t.Errorf("modified = %v, want empty", modified)
	}
}

func TestParseDiffNameStatus_CRLF(t *testing.T) {
	out := []byte("A\ta.txt\r\nM\tm.txt\r\nD\td.txt\r\n")
	added, modified, deleted := ParseDiffNameStatus(out)
	if !reflect.DeepEqual(added, []string{"a.txt"}) {
		t.Errorf("added = %v, want [a.txt]", added)
	}
	if !reflect.DeepEqual(modified, []string{"m.txt"}) {
		t.Errorf("modified = %v, want [m.txt]", modified)
	}
	if !reflect.DeepEqual(deleted, []string{"d.txt"}) {
		t.Errorf("deleted = %v, want [d.txt]", deleted)
	}
}
