package service

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/llm-trace/models"
)

// ============================================================
// P3: TR-08 成本面板扩展 — 模块级成本归因
// ============================================================

func TestModuleNameMap_CoversTR09(t *testing.T) {
	if _, ok := ModuleNameMap["dev-agent"]; !ok {
		t.Error("ModuleNameMap missing dev-agent (TR-09)")
	}
	if _, ok := ModuleNameMap["pipeline"]; !ok {
		t.Error("ModuleNameMap missing pipeline (TR-09)")
	}
}

func TestModuleNameMap_CoversTR10(t *testing.T) {
	if _, ok := ModuleNameMap["lowcode"]; !ok {
		t.Error("ModuleNameMap missing lowcode (TR-10)")
	}
	if _, ok := ModuleNameMap["ai-generate"]; !ok {
		t.Error("ModuleNameMap missing ai-generate (TR-10)")
	}
}

func TestModuleNameMap_CoversTR11(t *testing.T) {
	if _, ok := ModuleNameMap["ops"]; !ok {
		t.Error("ModuleNameMap missing ops (TR-11)")
	}
	if _, ok := ModuleNameMap["runbook"]; !ok {
		t.Error("ModuleNameMap missing runbook (TR-11)")
	}
}

func TestModuleNameMap_EvalAndChatops(t *testing.T) {
	if _, ok := ModuleNameMap["eval"]; !ok {
		t.Error("ModuleNameMap missing eval (TR-05)")
	}
	if _, ok := ModuleNameMap["chatops"]; !ok {
		t.Error("ModuleNameMap missing chatops")
	}
}

func TestModuleNameMap_UnknownFallback(t *testing.T) {
	label, ok := ModuleNameMap["unknown"]
	if !ok || label == "" {
		t.Error("ModuleNameMap should have 'unknown' fallback")
	}
}

// ============================================================
// P3: 模块级成本面板 — 聚合与确定性
// ============================================================

// A single trace per scenario is the shape that used to panic: the accumulator
// was read before its ByDay map was allocated, and writing to a nil map aborts
// with "assignment to entry in nil map". Anything that reaches the assertion
// below proves the map exists.
func TestGetModuleCostDashboard_SingleTracePerScenarioDoesNotPanic(t *testing.T) {
	traces := []models.LLMTrace{
		{ScenarioID: sql.NullString{String: "pipeline", Valid: true}, Currency: "CNY",
			TotalTokens: 300, TotalCost: 1.5, Status: models.TraceStatusCompleted,
			CreatedAt: time.Date(2026, 8, 20, 9, 0, 0, 0, time.UTC)},
		{Currency: "CNY", TotalTokens: 50, TotalCost: 0.25, Status: models.TraceStatusFailed,
			CreatedAt: time.Date(2026, 8, 20, 9, 5, 0, 0, time.UTC)},
	}
	got, err := NewService(&fakeRepo{traces: traces}).GetModuleCostDashboard(
		context.Background(), "tenant-1", nil, nil)
	if err != nil {
		t.Fatalf("GetModuleCostDashboard: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("got %d groups, want 2 (pipeline + unknown)", len(got))
	}
	byScenario := map[string]ModuleCostSummary{}
	for _, g := range got {
		byScenario[g.Scenario] = g
	}
	p := byScenario["pipeline"]
	if p.Requests != 1 || p.Tokens != 300 || p.Cost != 1.5 {
		t.Errorf("pipeline = %+v, want 1 request / 300 tokens / 1.5 cost", p)
	}
	if p.SuccessRate != 1.0 {
		t.Errorf("pipeline successRate = %v, want 1", p.SuccessRate)
	}
	if len(p.ByDay) != 1 || p.ByDay[0].Date != "2026-08-20" || p.ByDay[0].Cost != 1.5 {
		t.Errorf("pipeline ByDay = %+v, want one day at 1.5", p.ByDay)
	}
	u := byScenario["unknown"]
	if u.Requests != 1 || u.SuccessRate != 0 {
		t.Errorf("unknown = %+v, want 1 request and zero success", u)
	}
}

// Insertion order is deliberately reverse-chronological so the assertion below
// fails if the response is built by walking the day map in iteration order.
func TestGetModuleCostDashboard_AggregatesByDayInSortedOrder(t *testing.T) {
	newTrace := func(day int, tokens int, cost float64) models.LLMTrace {
		return models.LLMTrace{
			ScenarioID:  sql.NullString{String: "chatops", Valid: true},
			Currency:    "CNY",
			TotalTokens: tokens,
			TotalCost:   cost,
			Status:      models.TraceStatusCompleted,
			CreatedAt:   time.Date(2026, 8, day, 12, 0, 0, 0, time.UTC),
		}
	}
	traces := []models.LLMTrace{
		newTrace(22, 100, 1.0),
		newTrace(20, 200, 2.0),
		newTrace(21, 300, 3.0),
		newTrace(20, 50, 0.5),
	}
	got, err := NewService(&fakeRepo{traces: traces}).GetModuleCostDashboard(
		context.Background(), "tenant-1", nil, nil)
	if err != nil {
		t.Fatalf("GetModuleCostDashboard: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("got %d groups, want 1", len(got))
	}
	g := got[0]
	if g.Requests != 4 || g.Tokens != 650 || g.Cost != 6.5 {
		t.Errorf("totals = %+v, want 4 requests / 650 tokens / 6.5 cost", g)
	}
	if g.SuccessRate != 1.0 {
		t.Errorf("successRate = %v, want 1", g.SuccessRate)
	}
	wantDays := []string{"2026-08-20", "2026-08-21", "2026-08-22"}
	if len(g.ByDay) != len(wantDays) {
		t.Fatalf("ByDay has %d entries, want %d: %+v", len(g.ByDay), len(wantDays), g.ByDay)
	}
	for i, want := range wantDays {
		if g.ByDay[i].Date != want {
			t.Errorf("ByDay[%d].Date = %q, want %q", i, g.ByDay[i].Date, want)
		}
	}
	if g.ByDay[0].Cost != 2.5 || g.ByDay[0].Tokens != 250 {
		t.Errorf("2026-08-20 = %+v, want cost 2.5 tokens 250", g.ByDay[0])
	}
	if g.ByDay[2].Cost != 1.0 {
		t.Errorf("2026-08-22 cost = %v, want 1.0", g.ByDay[2].Cost)
	}
}

func TestGetModuleCostDashboard_EmptyTenantReturnsAnEmptySlice(t *testing.T) {
	got, err := NewService(&fakeRepo{}).GetModuleCostDashboard(
		context.Background(), "tenant-1", nil, nil)
	if err != nil {
		t.Fatalf("GetModuleCostDashboard: %v", err)
	}
	if got == nil || len(got) != 0 {
		t.Fatalf("got %v, want a non-nil empty slice", got)
	}
}

func TestGetModuleCostDashboard_PropagatesRepositoryFault(t *testing.T) {
	f := &fakeRepo{listByRangeErr: errors.New("range query down")}
	got, err := NewService(f).GetModuleCostDashboard(context.Background(), "tenant-1", nil, nil)
	if err == nil {
		t.Fatal("err = nil, want the repository fault")
	}
	if got != nil {
		t.Fatalf("summaries = %v, want nil with an error", got)
	}
	if !strings.Contains(err.Error(), "range query down") {
		t.Errorf("error = %q, want the repository fault", err.Error())
	}
}
