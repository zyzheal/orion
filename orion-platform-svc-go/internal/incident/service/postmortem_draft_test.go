package service

import (
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/incident/models"
)

func Test_InferIncidentRootCause_Timeout(t *testing.T) {
	errMsg := "upstream timeout after 5s"
	inc := &models.Incident{ErrorMessage: &errMsg, Service: "gateway"}
	got := inferIncidentRootCause(inc)
	if !strings.Contains(got, "超时") {
		t.Fatalf("timeout root cause = %q", got)
	}
}

func Test_InferIncidentRootCause_Memory(t *testing.T) {
	errMsg := "container OOMKilled"
	inc := &models.Incident{ErrorMessage: &errMsg}
	got := inferIncidentRootCause(inc)
	if !strings.Contains(got, "内存") {
		t.Fatalf("oom root cause = %q", got)
	}
}

func Test_InferIncidentRootCause_Default(t *testing.T) {
	inc := &models.Incident{Title: "卡片加载慢"}
	got := inferIncidentRootCause(inc)
	if got == "" {
		t.Fatal("default root cause should not be empty")
	}
	if !strings.Contains(got, "待确认") {
		t.Fatalf("default root cause = %q, want 待确认 marker", got)
	}
}

func Test_InferIncidentRootCause_LinkedChange(t *testing.T) {
	changeID := "chg-123"
	inc := &models.Incident{LinkedChangeID: &changeID}
	got := inferIncidentRootCause(inc)
	if !strings.Contains(got, "chg-123") {
		t.Fatalf("linked change root cause = %q, want mention change id", got)
	}
}

func Test_FormatTimeline(t *testing.T) {
	events := []models.TimelineEvent{
		{Content: "detected", CreatedAt: time.Date(2026, 8, 13, 10, 0, 0, 0, time.UTC)},
		{Content: "escalated", CreatedAt: time.Date(2026, 8, 13, 10, 5, 0, 0, time.UTC)},
	}
	got := formatTimeline(events)
	if !strings.Contains(got, "[10:00] detected") || !strings.Contains(got, "[10:05] escalated") {
		t.Fatalf("timeline summary = %q", got)
	}
	if formatTimeline(nil) != "" {
		t.Fatal("empty timeline should produce empty summary")
	}
}

func Test_BuildActionItems(t *testing.T) {
	items := buildActionItems(&models.Incident{SlaBreach: true}, "根因", nil)
	if len(items) < 3 {
		t.Fatalf("sla+empty timeline action items = %+v, want >=3", items)
	}
}

func Test_StatusVerb(t *testing.T) {
	if statusVerb("resolved") != "已解决" {
		t.Fatal("resolved verb mismatch")
	}
	if statusVerb("investigating") != "处理中" {
		t.Fatal("investigating verb mismatch")
	}
	if statusVerb("foo") != "已创建" {
		t.Fatal("default verb mismatch")
	}
}

func Test_InferContributingFactors(t *testing.T) {
	factors := inferContributingFactors(&models.Incident{Priority: "high", EscalationLevel: 2})
	if len(factors) < 2 {
		t.Fatalf("factors = %+v, want >=2", factors)
	}
	empty := inferContributingFactors(&models.Incident{})
	if len(empty) != 1 || !strings.Contains(empty[0], "缺少") {
		t.Fatalf("empty factors = %+v", empty)
	}
}