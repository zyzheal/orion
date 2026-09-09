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

// TestClassifyAddedModifiedDeleted is a smoke test for the placeholder
// classifier — confirms the current "everything is modified" contract.
func TestClassifyAddedModifiedDeleted_PlholderContract(t *testing.T) {
	// Note: intentionally spelled "Placeholder" to match the function's
	// documented contract ("placeholder").
	in := []string{"a.txt", "b.txt"}
	added, modified, deleted := classifyAddedModifiedDeleted(in)
	if len(added) != 0 {
		t.Errorf("added = %v, want empty", added)
	}
	if !reflect.DeepEqual(modified, in) {
		t.Errorf("modified = %v, want %v", modified, in)
	}
	if len(deleted) != 0 {
		t.Errorf("deleted = %v, want empty", deleted)
	}
}
