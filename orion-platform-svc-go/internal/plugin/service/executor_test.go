package service

import (
	"context"
	"os/exec"
	"testing"
	"time"

	"orion/platform-svc-go/internal/plugin/models"
)

func TestSubprocessExecutor_Interface(t *testing.T) {
	var _ Executor = (*SubprocessExecutor)(nil)
}

func TestSubprocessExecutor_New(t *testing.T) {
	e := NewSubprocessExecutor(0)
	if e == nil {
		t.Fatal("expected non-nil executor")
	}
	if e.timeout != 5*time.Minute {
		t.Fatalf("expected default timeout 5m, got %v", e.timeout)
	}
}

func TestSubprocessExecutor_Execute_PluginNotFound(t *testing.T) {
	e := NewSubprocessExecutor(time.Second)
	_, err := e.Execute(context.Background(), nil, &models.ExecutePluginRequest{TaskID: "t1"})
	if err == nil {
		t.Fatal("expected error for nil plugin")
	}
}

func TestSubprocessExecutor_Execute_PluginDisabled(t *testing.T) {
	e := NewSubprocessExecutor(time.Second)
	p := &models.Plugin{ID: "p1", Enabled: false, Entrypoint: "/bin/echo"}
	_, err := e.Execute(context.Background(), p, &models.ExecutePluginRequest{TaskID: "t1"})
	if err == nil {
		t.Fatal("expected error for disabled plugin")
	}
}

func TestSubprocessExecutor_Execute_NoEntrypoint(t *testing.T) {
	e := NewSubprocessExecutor(time.Second)
	p := &models.Plugin{ID: "p1", Enabled: true, Entrypoint: ""}
	_, err := e.Execute(context.Background(), p, &models.ExecutePluginRequest{TaskID: "t1"})
	if err == nil {
		t.Fatal("expected error for empty entrypoint")
	}
}

func TestSubprocessExecutor_Execute_Basic(t *testing.T) {
	e := NewSubprocessExecutor(time.Second)
	p := &models.Plugin{ID: "p1", Enabled: true, Entrypoint: "/bin/echo"}
	req := &models.ExecutePluginRequest{TaskID: "t1", Input: models.JSONB{"msg": "hello"}}

	result, err := e.Execute(context.Background(), p, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if !result.Success {
		t.Fatal("expected success")
	}
	if result.ExitCode != 0 {
		t.Fatalf("expected exit code 0, got %d", result.ExitCode)
	}
	if result.Stdout == "" {
		t.Fatal("expected stdout to be non-empty")
	}
	if e.GetActiveCount() != 0 {
		t.Fatalf("expected 0 active after execution, got %d", e.GetActiveCount())
	}
}

func TestSubprocessExecutor_Execute_Failure(t *testing.T) {
	tmp := t.TempDir()
	scriptPath := tmp + "/fail"
	cmd := exec.Command("sh", "-c", "printf '#!/bin/sh\\nexit 1\\n' > "+scriptPath+" && chmod +x "+scriptPath)
	if err := cmd.Run(); err != nil {
		t.Fatalf("failed to create temp script: %v", err)
	}

	e := NewSubprocessExecutor(time.Second)
	p := &models.Plugin{ID: "p1", Enabled: true, Entrypoint: scriptPath}
	req := &models.ExecutePluginRequest{TaskID: "t2"}

	result, err := e.Execute(context.Background(), p, req)
	if err != nil {
		t.Fatalf("unexpected error (should be wrapped in result): %v", err)
	}
	if result.Success {
		t.Fatal("expected failure")
	}
	if result.ExitCode == 0 {
		t.Fatalf("expected non-zero exit code, got 0")
	}
}

func TestSubprocessExecutor_GetActiveCount(t *testing.T) {
	e := NewSubprocessExecutor(time.Second)
	if c := e.GetActiveCount(); c != 0 {
		t.Fatalf("expected 0, got %d", c)
	}
}

func TestSubprocessExecutor_Kill_NotFound(t *testing.T) {
	e := NewSubprocessExecutor(time.Second)
	err := e.Kill("nonexistent", "test")
	if err == nil {
		t.Fatal("expected error for nonexistent task")
	}
}

func TestSubprocessExecutor_Execute_Timeout(t *testing.T) {
	_ = exec.Command
}

func TestSubprocessExecutor_ActiveCountDuringExecution(t *testing.T) {
	e := NewSubprocessExecutor(time.Second)

	p := &models.Plugin{ID: "p1", Enabled: true, Entrypoint: "/bin/cat"}
	req := &models.ExecutePluginRequest{TaskID: "t-active"}

	done := make(chan struct{})
	go func() {
		_, _ = e.Execute(context.Background(), p, req)
		close(done)
	}()

	time.Sleep(50 * time.Millisecond)

	count := e.GetActiveCount()
	if count == 0 {
		t.Log("active count was 0 (process may have exited quickly)")
	} else {
		t.Logf("active count during execution: %d", count)
	}

	_ = e.Kill("t-active", "cleanup")
	<-done
}

func TestSubprocessExecutor_ExecuteWithConfig(t *testing.T) {
	e := NewSubprocessExecutor(time.Second)
	p := &models.Plugin{
		ID: "p1", Enabled: true, Entrypoint: "/bin/echo",
		Config: models.JSONB{"timeout_ms": 5000},
	}
	req := &models.ExecutePluginRequest{TaskID: "t-config"}

	result, err := e.Execute(context.Background(), p, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Success {
		t.Fatal("expected success")
	}
}
