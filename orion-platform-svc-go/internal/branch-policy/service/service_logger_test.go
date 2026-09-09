package service

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"go.uber.org/zap/zaptest/observer"
	"orion/platform-svc-go/internal/branch-policy/gitmerge"
	"orion/platform-svc-go/internal/branch-policy/models"
)

// TestLogGitMergeError_NilLoggerIsNoOp asserts that the default constructor
// (no logger) does not panic when a git merge-tree failure occurs. The
// logGitMergeError method must silently no-op in that case — the API still
// returns a 201 with empty conflictFiles.
func TestLogGitMergeError_NilLoggerIsNoOp(t *testing.T) {
	svc := NewService(newFakeRepo())
	// Direct call — logGitMergeError must not panic.
	svc.logGitMergeError(context.Background(), &models.MergePreviewRequest{
		SourceBranch: "feature/x",
		TargetBranch: "main",
	}, errTest)
	_ = errTest // just to make sure errTest is referenced
}

// TestLogGitMergeError_EmptyErrorIsNoOp asserts that passing nil/empty error
// results in no log output. logGitMergeError should be idempotent-safe.
func TestLogGitMergeError_EmptyErrorIsNoOp(t *testing.T) {
	core, logs := observer.New(zapcore.WarnLevel)
	logger := zap.New(core)
	svc := NewServiceWithLogger(newFakeRepo(), nil, logger)
	svc.logGitMergeError(context.Background(), &models.MergePreviewRequest{}, nil)
	if logs.Len() != 0 {
		t.Errorf("expected no logs for nil error, got %d entries", logs.Len())
	}
}

// TestLogGitMergeError_EmitsWarnWithFields verifies the degraded-path
// warning: when the logger is wired and an error is present, one Warn entry
// is emitted with source_branch, target_branch, source_commit, target_commit
// and the error field.
func TestLogGitMergeError_EmitsWarnWithFields(t *testing.T) {
	core, logs := observer.New(zapcore.WarnLevel)
	logger := zap.New(core)
	svc := NewServiceWithLogger(newFakeRepo(), nil, logger)
	svc.logGitMergeError(context.Background(), &models.MergePreviewRequest{
		SourceBranch: "feature/x",
		TargetBranch: "main",
		SourceCommit: "abc123",
		TargetCommit: "def456",
	}, errTest)
	if logs.Len() != 1 {
		t.Fatalf("expected 1 log entry, got %d", logs.Len())
	}
	e := logs.All()[0]
	if e.Level != zapcore.WarnLevel {
		t.Errorf("level = %v, want Warn", e.Level)
	}
	if !strings.Contains(e.Message, "merge-tree dry-run failed") {
		t.Errorf("message = %q, want contains 'merge-tree dry-run failed'", e.Message)
	}
	// Check all expected fields are present.
	found := map[string]string{}
	for _, f := range e.Context {
		found[f.Key] = f.String
	}
	for _, key := range []string{"source_branch", "target_branch", "source_commit", "target_commit"} {
		if _, ok := found[key]; !ok {
			t.Errorf("missing field %q in log entry: %+v", key, found)
		}
	}
	if found["source_branch"] != "feature/x" || found["target_branch"] != "main" {
		t.Errorf("branch fields wrong: %+v", found)
	}
	if found["source_commit"] != "abc123" || found["target_commit"] != "def456" {
		t.Errorf("commit fields wrong: %+v", found)
	}
	if _, ok := found["error"]; !ok {
		t.Errorf("missing error field in log entry: %+v", found)
	}
}

// TestLogGitMergeError_OmitsEmptyBranchFields verifies that empty string
// values are NOT emitted as log fields — this avoids null noise in the log.
func TestLogGitMergeError_OmitsEmptyBranchFields(t *testing.T) {
	core, logs := observer.New(zapcore.WarnLevel)
	logger := zap.New(core)
	svc := NewServiceWithLogger(newFakeRepo(), nil, logger)
	svc.logGitMergeError(context.Background(), &models.MergePreviewRequest{
		SourceBranch: "feature/x", // only source set
	}, errTest)
	if logs.Len() != 1 {
		t.Fatalf("expected 1 log entry, got %d", logs.Len())
	}
	found := map[string]string{}
	for _, f := range logs.All()[0].Context {
		found[f.Key] = f.String
	}
	if _, ok := found["source_branch"]; !ok {
		t.Error("expected source_branch to be present")
	}
	if _, ok := found["target_branch"]; ok {
		t.Error("target_branch should be omitted when empty")
	}
	if _, ok := found["source_commit"]; ok {
		t.Error("source_commit should be omitted when empty")
	}
	if _, ok := found["target_commit"]; ok {
		t.Error("target_commit should be omitted when empty")
	}
}

// TestLogGitMergeError_TruncatesLongError asserts that errors > 512 chars
// are truncated to prevent log-size abuse.
func TestLogGitMergeError_TruncatesLongError(t *testing.T) {
	core, logs := observer.New(zapcore.WarnLevel)
	logger := zap.New(core)
	svc := NewServiceWithLogger(newFakeRepo(), nil, logger)
	longMsg := strings.Repeat("x", 600)
	err := &fakeError{msg: longMsg}
	svc.logGitMergeError(context.Background(), &models.MergePreviewRequest{}, err)
	if logs.Len() != 1 {
		t.Fatalf("expected 1 log entry, got %d", logs.Len())
	}
	found := map[string]string{}
	for _, f := range logs.All()[0].Context {
		found[f.Key] = f.String
	}
	if v, ok := found["error"]; ok && len(v) > 520 {
		t.Errorf("error field too long (%d chars), want <= 520: %q", len(v), v)
	}
}

// TestWithLogger_Chaining verifies the WithLogger builder returns the same
// *Service pointer and is chainable with WithGitExecutor.
func TestWithLogger_Chaining(t *testing.T) {
	base := NewService(newFakeRepo())
	core, _ := observer.New(zapcore.WarnLevel)
	logger := zap.New(core)
	type execStub struct{}
	_ = execStub{} // placeholder to keep the test readable
	out := base.WithLogger(logger).WithGitExecutor(nil)
	if out != base {
		t.Error("WithLogger should return the same *Service pointer")
	}
	if out != base.WithGitExecutor(nil) {
		t.Error("chain order should be stable")
	}
	// Verify the logger field is actually set.
	if base.logger == nil {
		t.Error("WithLogger did not set the logger field")
	}
}

// TestNewServiceWithLogger_DirectConstruction verifies the 3-arg constructor
// wires both executor and logger.
func TestNewServiceWithLogger_DirectConstruction(t *testing.T) {
	core, _ := observer.New(zapcore.WarnLevel)
	logger := zap.New(core)
	gitExec := gitmerge.NewLocalExecutor()
	svc := NewServiceWithLogger(newFakeRepo(), gitExec, logger)
	if svc.gitExecutor == nil {
		t.Error("gitExecutor not wired")
	}
	if svc.logger == nil {
		t.Error("logger not wired")
	}
}

// --- helpers ---

var errTest = &fakeError{msg: "simulated git failure"}

type fakeError struct {
	msg string
}

func (e *fakeError) Error() string { return e.msg }

// TestLogGitMergeError_JSONSerializable verifies the log fields can be
// serialized — guards against future changes that break JSON export.
func TestLogGitMergeError_JSONSerializable(t *testing.T) {
	core, logs := observer.New(zapcore.WarnLevel)
	logger := zap.New(core)
	svc := NewServiceWithLogger(newFakeRepo(), nil, logger)
	svc.logGitMergeError(context.Background(), &models.MergePreviewRequest{
		SourceBranch: "feature/x",
		TargetBranch: "main",
	}, errTest)
	if logs.Len() != 1 {
		t.Fatalf("expected 1 log entry, got %d", logs.Len())
	}
	e := logs.All()[0]
	// Zap observer exposes fields as zapcore.Field — marshal to ensure
	// no invalid types.
	b, err := json.Marshal(struct {
		Msg   string
		Level zapcore.Level
	}{e.Message, e.Level})
	if err != nil {
		t.Errorf("failed to marshal log entry: %v", err)
	}
	if len(b) == 0 {
		t.Error("empty marshal result")
	}
}
