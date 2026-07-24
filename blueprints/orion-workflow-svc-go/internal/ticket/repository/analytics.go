package repository

import (
	"context"
	"fmt"
	"time"

	"orion/workflow-svc-go/internal/ticket/models"

	"orion/go-common/pkg/database"
)

type AnalyticsRepository struct {
	db *database.DB
}

func NewAnalyticsRepository(db *database.DB) *AnalyticsRepository {
	return &AnalyticsRepository{db: db}
}

func (r *AnalyticsRepository) GetTicketStats(ctx context.Context, tenantID string) (*models.TicketStatistics, error) {
	stats := &models.TicketStatistics{
		ByPriority: make(map[string]int),
		ByCategory: make(map[string]int),
	}

	if err := r.db.GetContext(ctx, &stats.TotalTickets, "SELECT COUNT(*) FROM tickets WHERE tenant_id = $1", tenantID); err != nil {
		return nil, fmt.Errorf("total tickets: %w", err)
	}
	r.db.GetContext(ctx, &stats.OpenTickets, "SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND status = 'open'", tenantID)
	r.db.GetContext(ctx, &stats.AssignedTickets, "SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND status = 'assigned'", tenantID)
	r.db.GetContext(ctx, &stats.InProgressTickets, "SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND status = 'in-progress'", tenantID)
	r.db.GetContext(ctx, &stats.ResolvedTickets, "SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND status = 'resolved'", tenantID)
	r.db.GetContext(ctx, &stats.ClosedTickets, "SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND status = 'closed'", tenantID)

	r.db.GetContext(ctx, &stats.AvgResolutionMs,
		`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) * 1000), 0)
		FROM tickets WHERE tenant_id = $1 AND resolved_at IS NOT NULL`, tenantID)

	// By priority
	rows, err := r.db.QueryContext(ctx, "SELECT priority, COUNT(*) FROM tickets WHERE tenant_id = $1 GROUP BY priority", tenantID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var p string
			var c int
			rows.Scan(&p, &c)
			stats.ByPriority[p] = c
		}
	}

	// By category
	rows2, err := r.db.QueryContext(ctx, "SELECT type, COUNT(*) FROM tickets WHERE tenant_id = $1 GROUP BY type", tenantID)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var t string
			var c int
			rows2.Scan(&t, &c)
			stats.ByCategory[t] = c
		}
	}

	return stats, nil
}

func (r *AnalyticsRepository) GetResolutionStats(ctx context.Context, tenantID string) (*models.ResolutionStats, error) {
	stats := &models.ResolutionStats{
		ByPriority: make(map[string]float64),
		ByCategory: make(map[string]float64),
	}

	if err := r.db.GetContext(ctx, &stats.TotalResolved,
		"SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND resolved_at IS NOT NULL", tenantID); err != nil {
		return nil, fmt.Errorf("total resolved: %w", err)
	}
	r.db.GetContext(ctx, &stats.AvgResolutionMs,
		`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) * 1000), 0)
		FROM tickets WHERE tenant_id = $1 AND resolved_at IS NOT NULL`, tenantID)

	// By priority
	rows, err := r.db.QueryContext(ctx,
		`SELECT priority, AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) * 1000)
		FROM tickets WHERE tenant_id = $1 AND resolved_at IS NOT NULL GROUP BY priority`, tenantID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var p string
			var avg float64
			rows.Scan(&p, &avg)
			stats.ByPriority[p] = avg
		}
	}

	return stats, nil
}

func (r *AnalyticsRepository) GetBacklogAnalysis(ctx context.Context, tenantID string) (*models.BacklogAnalysis, error) {
	analysis := &models.BacklogAnalysis{
		ByPriority: make(map[string]int),
		ByCategory: make(map[string]int),
	}

	if err := r.db.GetContext(ctx, &analysis.TotalOpen,
		"SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND status IN ('open', 'assigned', 'in-progress')", tenantID); err != nil {
		return nil, fmt.Errorf("total open: %w", err)
	}

	// By priority
	rows, err := r.db.QueryContext(ctx,
		`SELECT priority, COUNT(*) FROM tickets WHERE tenant_id = $1 AND status IN ('open', 'assigned', 'in-progress') GROUP BY priority`, tenantID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var p string
			var c int
			rows.Scan(&p, &c)
			analysis.ByPriority[p] = c
		}
	}

	// Stale (older than 7 days with no update)
	r.db.GetContext(ctx, &analysis.StaleCount,
		`SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND status IN ('open', 'assigned') AND updated_at < NOW() - INTERVAL '7 days'`, tenantID)

	return analysis, nil
}

func (r *AnalyticsRepository) GetTrendData(ctx context.Context, tenantID string, days int, granularity string) ([]models.TrendPoint, error) {
	var points []models.TrendPoint

	rows, err := r.db.QueryContext(ctx,
		`SELECT DATE_TRUNC($1, created_at) as ts, COUNT(*) as cnt
		FROM tickets WHERE tenant_id = $2 AND created_at > NOW() - ($3 || ' days')::interval
		GROUP BY ts ORDER BY ts`, granularity, tenantID, days)
	if err != nil {
		return points, err
	}
	defer rows.Close()

	for rows.Next() {
		var p models.TrendPoint
		rows.Scan(&p.Timestamp, &p.Value)
		points = append(points, p)
	}

	return points, nil
}

// Executive dashboard aggregation
func (r *AnalyticsRepository) GetExecutiveDashboard(ctx context.Context, tenantID string, start, end time.Time) (*models.ExecutiveDashboard, error) {
	dash := &models.ExecutiveDashboard{
		PeriodStart: start,
		PeriodEnd:   end,
		ByPriority:  make(map[string]int),
		ByCategory:  make(map[string]int),
	}

	if err := r.db.GetContext(ctx, &dash.TotalTickets,
		"SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3", tenantID, start, end); err != nil {
		return nil, fmt.Errorf("total tickets: %w", err)
	}
	r.db.GetContext(ctx, &dash.OpenTickets,
		"SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND status IN ('open','assigned','in-progress') AND created_at BETWEEN $2 AND $3", tenantID, start, end)
	r.db.GetContext(ctx, &dash.ResolvedTickets,
		"SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND status IN ('resolved','closed') AND created_at BETWEEN $2 AND $3", tenantID, start, end)
	r.db.GetContext(ctx, &dash.AvgResolutionMs,
		`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) * 1000), 0)
		FROM tickets WHERE tenant_id = $1 AND resolved_at IS NOT NULL AND created_at BETWEEN $2 AND $3`, tenantID, start, end)

	// By priority
	rows, err := r.db.QueryContext(ctx,
		"SELECT priority, COUNT(*) FROM tickets WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3 GROUP BY priority", tenantID, start, end)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var p string
			var c int
			rows.Scan(&p, &c)
			dash.ByPriority[p] = c
		}
	}

	// Trend data
	dash.TrendData, _ = r.GetTrendData(ctx, tenantID, int(end.Sub(start).Hours()/24), "day")

	return dash, nil
}
