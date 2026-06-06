package repository

import (
	"fmt"
	"time"

	"orion-ticket-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

type AnalyticsRepository struct {
	db *sqlx.DB
}

func NewAnalyticsRepository(db *sqlx.DB) *AnalyticsRepository {
	return &AnalyticsRepository{db: db}
}

func (r *AnalyticsRepository) GetTicketStats(tenantID string) (*models.TicketStatistics, error) {
	stats := &models.TicketStatistics{
		ByPriority: make(map[string]int),
		ByCategory: make(map[string]int),
	}

	if err := r.db.Get(&stats.TotalTickets, "SELECT COUNT(*) FROM tickets WHERE tenant_id = $1", tenantID); err != nil {
		return nil, fmt.Errorf("total tickets: %w", err)
	}
	r.db.Get(&stats.OpenTickets, "SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND status = 'open'", tenantID)
	r.db.Get(&stats.AssignedTickets, "SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND status = 'assigned'", tenantID)
	r.db.Get(&stats.InProgressTickets, "SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND status = 'in-progress'", tenantID)
	r.db.Get(&stats.ResolvedTickets, "SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND status = 'resolved'", tenantID)
	r.db.Get(&stats.ClosedTickets, "SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND status = 'closed'", tenantID)

	r.db.Get(&stats.AvgResolutionMs,
		`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) * 1000), 0)
		FROM tickets WHERE tenant_id = $1 AND resolved_at IS NOT NULL`, tenantID)

	// By priority
	rows, err := r.db.Query("SELECT priority, COUNT(*) FROM tickets WHERE tenant_id = $1 GROUP BY priority", tenantID)
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
	rows2, err := r.db.Query("SELECT type, COUNT(*) FROM tickets WHERE tenant_id = $1 GROUP BY type", tenantID)
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

func (r *AnalyticsRepository) GetResolutionStats(tenantID string) (*models.ResolutionStats, error) {
	stats := &models.ResolutionStats{
		ByPriority: make(map[string]float64),
		ByCategory: make(map[string]float64),
	}

	if err := r.db.Get(&stats.TotalResolved,
		"SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND resolved_at IS NOT NULL", tenantID); err != nil {
		return nil, fmt.Errorf("total resolved: %w", err)
	}
	r.db.Get(&stats.AvgResolutionMs,
		`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) * 1000), 0)
		FROM tickets WHERE tenant_id = $1 AND resolved_at IS NOT NULL`, tenantID)

	// By priority
	rows, err := r.db.Query(
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

func (r *AnalyticsRepository) GetBacklogAnalysis(tenantID string) (*models.BacklogAnalysis, error) {
	analysis := &models.BacklogAnalysis{
		ByPriority: make(map[string]int),
		ByCategory: make(map[string]int),
	}

	if err := r.db.Get(&analysis.TotalOpen,
		"SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND status IN ('open', 'assigned', 'in-progress')", tenantID); err != nil {
		return nil, fmt.Errorf("total open: %w", err)
	}

	// By priority
	rows, err := r.db.Query(
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
	r.db.Get(&analysis.StaleCount,
		`SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND status IN ('open', 'assigned') AND updated_at < NOW() - INTERVAL '7 days'`, tenantID)

	return analysis, nil
}

func (r *AnalyticsRepository) GetTrendData(tenantID string, days int, granularity string) ([]models.TrendPoint, error) {
	var points []models.TrendPoint

	rows, err := r.db.Query(
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
func (r *AnalyticsRepository) GetExecutiveDashboard(tenantID string, start, end time.Time) (*models.ExecutiveDashboard, error) {
	dash := &models.ExecutiveDashboard{
		PeriodStart: start,
		PeriodEnd:   end,
		ByPriority:  make(map[string]int),
		ByCategory:  make(map[string]int),
	}

	if err := r.db.Get(&dash.TotalTickets,
		"SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3", tenantID, start, end); err != nil {
		return nil, fmt.Errorf("total tickets: %w", err)
	}
	r.db.Get(&dash.OpenTickets,
		"SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND status IN ('open','assigned','in-progress') AND created_at BETWEEN $2 AND $3", tenantID, start, end)
	r.db.Get(&dash.ResolvedTickets,
		"SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND status IN ('resolved','closed') AND created_at BETWEEN $2 AND $3", tenantID, start, end)
	r.db.Get(&dash.AvgResolutionMs,
		`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) * 1000), 0)
		FROM tickets WHERE tenant_id = $1 AND resolved_at IS NOT NULL AND created_at BETWEEN $2 AND $3`, tenantID, start, end)

	// By priority
	rows, err := r.db.Query(
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
	dash.TrendData, _ = r.GetTrendData(tenantID, int(end.Sub(start).Hours()/24), "day")

	return dash, nil
}
