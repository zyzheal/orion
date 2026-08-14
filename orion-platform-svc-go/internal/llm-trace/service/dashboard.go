package service

import (
	"context"
	"math"
	"sort"
	"strings"
	"time"

	"orion/platform-svc-go/internal/llm-trace/models"
)

// GetUsageDashboard aggregates usage for a time window, grouped by model,
// day, and tenant. It is a read-only analytics view for the cost dashboard.
func (s *Service) GetUsageDashboard(ctx context.Context, tenantID string, start, end *time.Time) (*models.UsageDashboard, error) {
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

	dash := &models.UsageDashboard{
		StartDate: effectiveStart.Format("2006-01-02"),
		EndDate:   effectiveEnd.Format("2006-01-02"),
		ByModel:   map[string]*models.ModelUsage{},
		ByTenant:  map[string]*models.TenantUsage{},
		Currency:  s.currency,
	}

	dayTotals := map[string]*models.DayUsage{}

	for _, t := range traces {
		dash.TotalRequests++
		dash.TotalTokens += int64(t.TotalTokens)
		dash.TotalCost += t.TotalCost

		// by model
		mu := dash.ByModel[t.ModelID]
		if mu == nil {
			mu = &models.ModelUsage{}
			dash.ByModel[t.ModelID] = mu
		}
		mu.Requests++
		mu.Tokens += int64(t.TotalTokens)
		mu.Cost += t.TotalCost
		if t.Status == models.TraceStatusCompleted {
			mu.SuccessRate = ((mu.SuccessRate * float64(mu.Requests-1)) + 1) / float64(mu.Requests)
		} else {
			mu.SuccessRate = (mu.SuccessRate * float64(mu.Requests-1)) / float64(mu.Requests)
		}

		// by tenant (when aggregating cross-tenant context)
		tu := dash.ByTenant[t.TenantID]
		if tu == nil {
			tu = &models.TenantUsage{}
			dash.ByTenant[t.TenantID] = tu
		}
		tu.Requests++
		tu.Tokens += int64(t.TotalTokens)
		tu.Cost += t.TotalCost

		// by day
		day := t.CreatedAt.UTC().Format("2006-01-02")
		du := dayTotals[day]
		if du == nil {
			du = &models.DayUsage{Date: day}
			dayTotals[day] = du
		}
		du.Requests++
		du.Tokens += int64(t.TotalTokens)
		du.Cost += t.TotalCost
	}

	// deterministic day ordering
	days := make([]string, 0, len(dayTotals))
	for d := range dayTotals {
		days = append(days, d)
	}
	sort.Strings(days)
	for _, d := range days {
		dash.ByDay = append(dash.ByDay, *dayTotals[d])
	}

	// trend: linear projection of daily avg to monthly
	if len(days) > 0 {
		numDays := effectiveEnd.Sub(*effectiveStart).Hours() / 24
		if numDays <= 0 {
			numDays = 1
		}
		dailyAvg := dash.TotalCost / numDays
		dash.Trend = &models.UsageTrend{
			DailyAvgCost:     round2f(dailyAvg),
			ProjectedMonthly: round2f(dailyAvg * 30),
		}
	}

	// if tenant-scoped request, drop the byTenant view (redundant)
	if tenantID != "" {
		dash.ByTenant = nil
	}

	return dash, nil
}

// round2f rounds to 2 decimals using math.Round for correct ties.
func round2f(v float64) float64 {
	return math.Round(v*100) / 100
}

// hasCostData is a small guard used by tests to avoid importing internals.
func hasCostData(d *models.UsageDashboard) bool {
	return d != nil && d.TotalRequests > 0
}

// normalizeModel key normalizes model identifiers for aggregation keys.
func normalizeModel(m string) string {
	return strings.TrimSpace(m)
}