package service

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/llm-trace/models"
)

// ModuleCostSummary aggregates cost by business scenario/module for the P3
// cost dashboard extension (TR-08). It reuses existing LLMTrace data and
// groups by ScenarioID — which records the originating module (assistant /
// pipeline / chatops / lowcode etc).
type ModuleCostSummary struct {
	Scenario    string           `json:"scenario"`
	Requests    int              `json:"requests"`
	Tokens      int64            `json:"tokens"`
	Cost        float64          `json:"cost"`
	Currency    string           `json:"currency"`
	SuccessRate float64          `json:"successRate"`
	ByDay       []ModuleDayUsage `json:"byDay,omitempty"`
}

type ModuleDayUsage struct {
	Date   string  `json:"date"`
	Cost   float64 `json:"cost"`
	Tokens int64   `json:"tokens"`
}

// GetModuleCostDashboard aggregates LLM cost by scenario for a time window.
// P3 extension of the usage dashboard for AI cost attribution to TR-09/10/11
// business scenarios.
func (s *Service) GetModuleCostDashboard(ctx context.Context, tenantID string, start, end *time.Time) ([]ModuleCostSummary, error) {
	now := time.Now().UTC()
	effectiveStart := start
	if effectiveStart == nil {
		d := now.AddDate(0, 0, -7)
		effectiveStart = &d
	}
	effectiveEnd := end
	if effectiveEnd == nil {
		effectiveEnd = &now
	}

	traces, err := s.repo.ListTracesByTenantAndDateRange(ctx, tenantID, effectiveStart, effectiveEnd)
	if err != nil {
		return nil, err
	}
	if traces == nil {
		traces = []models.LLMTrace{}
	}

	groups := map[string]*moduleCostAccum{}
	for _, t := range traces {
		scenario := t.ScenarioID.String
		if scenario == "" {
			scenario = "unknown"
		}
		g := groups[scenario]
		if g == nil {
			g = &moduleCostAccum{Scenario: scenario, Currency: t.Currency}
			groups[scenario] = g
		}
		g.Requests++
		g.Tokens += int64(t.TotalTokens)
		g.Cost += t.TotalCost
		if t.Status == models.TraceStatusCompleted {
			g.Success++
		}
		day := t.CreatedAt.UTC().Format("2006-01-02")
		d := g.ByDay[day]
		d.Date = day
		d.Cost += t.TotalCost
		d.Tokens += int64(t.TotalTokens)
		g.ByDay[day] = d
	}

	result := make([]ModuleCostSummary, 0, len(groups))
	for _, g := range groups {
		sum := ModuleCostSummary{
			Scenario:    g.Scenario,
			Requests:    g.Requests,
			Tokens:      g.Tokens,
			Cost:        g.Cost,
			Currency:    g.Currency,
			SuccessRate: float64(g.Success) / float64(maxInt(g.Requests, 1)),
		}
		for _, d := range g.ByDay {
			sum.ByDay = append(sum.ByDay, d)
		}
		result = append(result, sum)
	}
	return result, nil
}

type moduleCostAccum struct {
	Scenario string
	Currency string
	Requests int
	Success  int
	Tokens   int64
	Cost     float64
	ByDay    map[string]ModuleDayUsage
}

// Register default module name tags for the cost dashboard scenario labels.
// These map the internal ScenarioID values to human-readable names.
var ModuleNameMap = map[string]string{
	"assistant":   "AI 助手",
	"dev-agent":   "研发流程 Agent (TR-09)",
	"pipeline":    "AI 流水线 (TR-09)",
	"ai-generate": "LowCode AI 生成 (TR-10)",
	"lowcode":     "LowCode (TR-10)",
	"ops":         "Ops 问答助手 (TR-11)",
	"chatops":     "ChatOps",
	"runbook":     "Runbook (TR-11)",
	"eval":        "评测集 (TR-05)",
	"unknown":     "未分类",
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
