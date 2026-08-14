package service

import (
	"strings"
	"testing"

	"orion/platform-svc-go/internal/alert/models"
)

func Test_InferCause_CPU(t *testing.T) {
	cause, suggestions := inferCause(&models.Alert{Metric: "cpu_usage_percent"})
	if !strings.Contains(cause, "资源类") {
		t.Fatalf("cpu cause = %q, want 资源类", cause)
	}
	if len(suggestions) == 0 || suggestions[0].Priority != 1 {
		t.Fatalf("cpu suggestions = %+v, want priority-1 suggestion", suggestions)
	}
}

func Test_InferCause_Memory(t *testing.T) {
	cause, suggestions := inferCause(&models.Alert{Metric: "memory_usage_bytes"})
	if !strings.Contains(cause, "内存") {
		t.Fatalf("memory cause = %q, want 内存", cause)
	}
	if len(suggestions) == 0 {
		t.Fatal("memory suggestions empty, want non-empty")
	}
}

func Test_InferCause_Latency(t *testing.T) {
	cause, _ := inferCause(&models.Alert{Metric: "http_p99_latency"})
	if !strings.Contains(cause, "延迟") {
		t.Fatalf("latency cause = %q, want 延迟", cause)
	}
	causeByName, _ := inferCause(&models.Alert{Metric: "x", Name: "service-latency-异常"})
	if !strings.Contains(causeByName, "延迟") {
		t.Fatalf("latency-by-name cause = %q, want 延迟", causeByName)
	}
}

func Test_InferCause_Errors(t *testing.T) {
	cause, suggestions := inferCause(&models.Alert{Metric: "error_rate_5xx"})
	if !strings.Contains(cause, "错误率") {
		t.Fatalf("error cause = %q, want 错误率", cause)
	}
	if len(suggestions) < 2 {
		t.Fatalf("error suggestions = %+v, want >=2", suggestions)
	}
}

func Test_InferCause_CriticalFallback(t *testing.T) {
	cause, _ := inferCause(&models.Alert{Metric: "custom_metric", Severity: "critical"})
	if !strings.Contains(cause, "高严重级别") {
		t.Fatalf("critical cause = %q, want 高严重级别", cause)
	}
}

func Test_InferCause_NoMatch(t *testing.T) {
	cause, suggestions := inferCause(&models.Alert{Metric: "unrelated_metric", Severity: "warning"})
	if !strings.Contains(cause, "常规告警") {
		t.Fatalf("fallback cause = %q, want 常规告警", cause)
	}
	if len(suggestions) != 1 {
		t.Fatalf("fallback suggestions = %+v, want exactly 1", suggestions)
	}
}

func Test_Truncate(t *testing.T) {
	if got := truncate("short", 10); got != "short" {
		t.Fatalf("truncate short = %q, want unchanged", got)
	}
	long := "abcdefghijklmnop"
	if got := truncate(long, 6); got != "abcdef..." {
		t.Fatalf("truncate long = %q, want abcdef...", got)
	}
}

func Test_ExplainAlert_NotPersisted(t *testing.T) {
	// inferCause is a pure helper; ensure it does not panic for nil-ish input
	cause, suggestions := inferCause(&models.Alert{})
	if cause == "" {
		t.Fatal("empty alert should still produce a non-empty cause")
	}
	if len(suggestions) == 0 {
		t.Fatal("empty alert should still produce suggestions")
	}
}