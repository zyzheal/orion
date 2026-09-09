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
	return ParseMergeTreeOutput(stdout.Bytes())
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
