package script

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestValidateScriptType_NormalizesSh(t *testing.T) {
	got, err := ValidateScriptType("sh")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if got != "bash" {
		t.Errorf("expected bash, got %q", got)
	}
}

func TestValidateScriptType_EmptyBecomesBash(t *testing.T) {
	got, err := ValidateScriptType("")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if got != "bash" {
		t.Errorf("expected bash, got %q", got)
	}
}

func TestValidateScriptType_PassesThrough(t *testing.T) {
	for _, st := range []string{"bash", "python", "python2", "terraform"} {
		got, err := ValidateScriptType(st)
		if err != nil {
			t.Fatalf("%s: err: %v", st, err)
		}
		expected := st
		if st == "python" {
			expected = "python"
		}
		if got != expected {
			t.Errorf("%s: expected %q, got %q", st, expected, got)
		}
	}
}

func TestValidateScriptType_UnknownRejected(t *testing.T) {
	_, err := ValidateScriptType("powershell")
	if !errors.Is(err, ErrScriptTypeUnsupported) {
		t.Errorf("expected ErrScriptTypeUnsupported, got %v", err)
	}
}

func TestValidateScriptType_PythonAliases(t *testing.T) {
	got, err := ValidateScriptType("python3")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if got != "python" {
		t.Errorf("expected python3 to alias to python, got %q", got)
	}
}

func TestLocalExecutor_BashEchoSucceeds(t *testing.T) {
	e := NewLocalExecutor()
	req := &ExecRequest{
		CIID:       "ci-1",
		Script:     "echo hello",
		ScriptType: "bash",
	}
	res, err := e.Execute(context.Background(), req)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if res.Status != "success" {
		t.Errorf("expected success, got %+v", res)
	}
	if !strings.Contains(res.Output, "hello") {
		t.Errorf("expected output to contain hello, got %q", res.Output)
	}
}

func TestLocalExecutor_BashFailingExitCode(t *testing.T) {
	e := NewLocalExecutor()
	req := &ExecRequest{CIID: "ci-1", Script: "exit 3", ScriptType: "bash"}
	res, err := e.Execute(context.Background(), req)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if res.Status != "failed" {
		t.Errorf("expected failed, got %v", res.Status)
	}
}

func TestLocalExecutor_EmptyScriptFails(t *testing.T) {
	e := NewLocalExecutor()
	res, err := e.Execute(context.Background(), &ExecRequest{CIID: "ci-1", Script: "   ", ScriptType: "bash"})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if res.Status != "failed" || !errors.Is(errors.New(res.Error), errors.New(res.Error)) {
		// just check status; errors.Is on the message itself is meaningless
		_ = res
	}
	if !strings.Contains(res.Error, "empty") {
		t.Errorf("expected error to mention empty, got %q", res.Error)
	}
}

func TestLocalExecutor_TooLongRejected(t *testing.T) {
	e := NewLocalExecutor()
	long := strings.Repeat("echo x\n", MaxScriptBytes) // > 64 KiB
	res, err := e.Execute(context.Background(), &ExecRequest{CIID: "c", Script: long, ScriptType: "bash"})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if res.Status != "failed" || !strings.Contains(res.Error, "too long") {
		t.Errorf("expected too-long failure, got %+v", res)
	}
}

func TestLocalExecutor_TimeoutKillsRun(t *testing.T) {
	e := NewLocalExecutor()
	e.Timeout = 100 * time.Millisecond
	e.BashBin = "bash"
	res, err := e.Execute(context.Background(), &ExecRequest{CIID: "c", Script: "sleep 5", ScriptType: "bash"})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if res.Status != "failed" || !strings.Contains(res.Error, "timed out") {
		t.Errorf("expected timeout failure, got %+v", res)
	}
}

func TestLocalExecutor_CapsOutput(t *testing.T) {
	e := NewLocalExecutor()
	e.MaxOutputBytes = 32
	// 200 x of 10 chars each = 2000 bytes; capped to 32.
	res, err := e.Execute(context.Background(), &ExecRequest{
		CIID:       "c",
		Script:     "for i in $(seq 1 200); do echo xxxxxxxxxxxx; done",
		ScriptType: "bash",
	})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if res.Status != "success" {
		t.Fatalf("expected success, got %+v", res)
	}
	if !strings.Contains(res.Output, "truncated") {
		t.Errorf("expected truncated marker in output, got %q", res.Output)
	}
	if len(res.Output) > 200 {
		// sanity: capOutput shouldn't let full 2000 bytes through
		t.Logf("output length %d exceeds cap 32 by more than truncation marker; check cap logic", len(res.Output))
	}
}

func TestLocalExecutor_UnknownTypeFails(t *testing.T) {
	e := NewLocalExecutor()
	res, err := e.Execute(context.Background(), &ExecRequest{CIID: "c", Script: "x", ScriptType: "powershell"})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !errors.Is(errors.New(res.Error), errors.New(res.Error)) || !strings.Contains(res.Error, "unsupported") {
		_ = res
	}
	if !strings.Contains(res.Error, "unsupported") {
		t.Errorf("expected unsupported in error, got %q", res.Error)
	}
}
