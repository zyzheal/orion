// Package gitmerge provides a thin abstraction over `git merge-tree` for the
// branch-policy MergePreview flow. It is intentionally small: the executor
// runs the binary, the parser turns stdout into a Result. Callers that do not
// have git available (e.g. unit tests, air-gapped deploys) can inject a mock
// Executor and keep the rest of the service code path unchanged.
package gitmerge

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

// Result is the parsed output of a `git merge-tree --write-tree` invocation.
// The slices are deduped and sorted by the parser. ConflictFiles is the
// primary signal used by MergePreview.RiskLevel; the other three slices are
// informational and fed straight into MergePreview's audit fields.
type Result struct {
	ConflictFiles []string `json:"conflictFiles"`
	AddedFiles    []string `json:"addedFiles"`
	ModifiedFiles []string `json:"modifiedFiles"`
	DeletedFiles  []string `json:"deletedFiles"`
}

// Executor runs a merge-tree dry-run between two refs and returns the
// resulting conflict/added/modified/deleted file lists. Implementations MUST
// be safe for concurrent use. A nil-returned Result with a nil error is not
// permitted — callers expect either a usable Result or an error.
type Executor interface {
	Run(ctx context.Context, sourceRef, targetRef string) (*Result, error)
}

// LocalExecutor is the default Executor implementation. It shells out to the
// system `git` binary via `git merge-tree --write-tree <source> <target>`.
// WorkDir (optional) pins the repository root; when empty, the process
// inherits the current working directory. Timeout defaults to 30s when
// unset. BinaryPath defaults to "git".
//
// Failures (git missing, non-zero exit that is not the expected "conflicts"
// exit, parse errors) are returned as errors — the caller (CreateMergePreview)
// treats them as "use client-supplied conflicts or empty" so a broken git
// installation does not block the API.
type LocalExecutor struct {
	BinaryPath string
	WorkDir    string
	Timeout    time.Duration
}

// NewLocalExecutor returns a LocalExecutor with sensible defaults.
func NewLocalExecutor() *LocalExecutor {
	return &LocalExecutor{
		BinaryPath: "git",
		Timeout:    30 * time.Second,
	}
}

// Run executes `git merge-tree --write-tree <source> <target>` and parses
// the output. Git exits with code 1 when the merge produced conflicts; that
// is not an error — it is the normal path for conflict detection. Any other
// non-zero exit is an error.
//
// After the merge-tree parse, Run also invokes `git diff --name-status
// <target> <tree-hash>` to classify the resulting files into Added / Modified
// / Deleted buckets. A diff failure is silently degraded: the conflict list
// is preserved and the three classification slices are left empty. This
// matters because merge-tree can succeed while diff fails (e.g. tree hash
// not resolvable in the local object store) — the caller still gets a
// usable Result.
func (e *LocalExecutor) Run(ctx context.Context, sourceRef, targetRef string) (*Result, error) {
	if sourceRef == "" || targetRef == "" {
		return nil, fmt.Errorf("gitmerge: sourceRef and targetRef are required")
	}
	bin := e.BinaryPath
	if bin == "" {
		bin = "git"
	}
	t := e.Timeout
	if t <= 0 {
		t = 30 * time.Second
	}
	runCtx, cancel := context.WithTimeout(ctx, t)
	defer cancel()

	cmd := exec.CommandContext(runCtx, bin, "merge-tree", "--write-tree", sourceRef, targetRef)
	if e.WorkDir != "" {
		cmd.Dir = e.WorkDir
	}
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	if ctx.Err() != nil {
		return nil, fmt.Errorf("gitmerge: context cancelled: %w", ctx.Err())
	}
	if runCtx.Err() == context.DeadlineExceeded {
		return nil, fmt.Errorf("gitmerge: timed out after %s", t)
	}
	// git merge-tree exits 0 when there are no conflicts and 1 when there
	// are conflicts. Both are "success" from our perspective — the parse
	// step tells them apart. Any other exit is a real error.
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			if exitErr.ExitCode() == 1 {
				// Expected: conflicts detected. Continue to parse.
			} else {
				return nil, fmt.Errorf("gitmerge: git exited %d: %s",
					exitErr.ExitCode(), strings.TrimSpace(stderr.String()))
			}
		} else {
			return nil, fmt.Errorf("gitmerge: %w", err)
		}
	}
	res, err := ParseMergeTreeOutput(stdout.Bytes())
	if err != nil {
		return nil, fmt.Errorf("gitmerge: parse merge-tree output: %w", err)
	}

	// Phase 5d: after merge-tree, classify changed files by running
	// `git diff --name-status <target> <tree-hash>`. The diff is relative
	// to the target (merge direction is source → target), so AddedFiles are
	// files the source brings in that the target did not have, and so on.
	treeHash := ExtractTreeHash(stdout.Bytes())
	if treeHash != "" {
		added, modified, deleted, diffErr := e.runDiffNameStatus(runCtx, bin, targetRef, treeHash)
		if diffErr == nil {
			res.AddedFiles = added
			res.ModifiedFiles = modified
			res.DeletedFiles = deleted
		}
		// diffErr is intentionally swallowed — see Run's docstring. The
		// merge-tree step succeeded; the caller still gets a usable Result.
		_ = diffErr
	}
	return res, nil
}

// runDiffNameStatus shells out to `git diff --name-status <targetRef> <treeHash>`
// and returns the classified file lists. The ctx is reused from the outer
// merge-tree call — the same total timeout budget applies to both git
// invocations. A non-nil error means classification was skipped (the caller
// leaves the classification slices empty).
func (e *LocalExecutor) runDiffNameStatus(ctx context.Context, bin, targetRef, treeHash string) (added, modified, deleted []string, err error) {
	cmd := exec.CommandContext(ctx, bin, "diff", "--name-status", targetRef, treeHash)
	if e.WorkDir != "" {
		cmd.Dir = e.WorkDir
	}
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if runErr := cmd.Run(); runErr != nil {
		// Distinguish "git not found" from "target ref not resolvable".
		// Both are non-fatal for the caller, but the error string is
		// useful for debugging degraded paths.
		return nil, nil, nil, fmt.Errorf("gitmerge: git diff --name-status: %v: %s",
			runErr, strings.TrimSpace(stderr.String()))
	}
	added, modified, deleted = ParseDiffNameStatus(stdout.Bytes())
	return
}

// PathExists reports whether the given path exists and is executable — used
// by callers to decide whether to construct a LocalExecutor at all.
func PathExists(path string) bool {
	if path == "" {
		return false
	}
	st, err := os.Stat(path)
	if err != nil {
		return false
	}
	return st.Mode()&0111 != 0 // any execute bit
}
