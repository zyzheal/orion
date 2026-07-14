package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/pipeline-trend/models"

	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// intervalFromPeriod converts a period string to a PostgreSQL interval.
func intervalFromPeriod(period string) string {
	switch period {
	case "7d":
		return "7 days"
	case "30d":
		return "30 days"
	case "90d":
		return "90 days"
	default:
		return "30 days"
	}
}

// dateTruncFmt returns the date_trunc granularity argument.
func dateTruncFmt(granularity string) string {
	switch granularity {
	case "hour":
		return "hour"
	case "day":
		return "day"
	case "week":
		return "week"
	default:
		return "day"
	}
}

// GetRunHistoryTrend returns aggregated run history for a single pipeline.
func (r *Repository) GetRunHistoryTrend(ctx context.Context, pipelineID, period, granularity string) ([]models.TrendEntry, error) {
	interval := intervalFromPeriod(period)
	trunc := dateTruncFmt(granularity)

	query := fmt.Sprintf(`
		SELECT
			to_char(date_trunc('%s', started_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS date,
			COUNT(*)                                                                  AS total,
			COUNT(*) FILTER (WHERE status = 'succeeded')                               AS succeeded,
			COUNT(*) FILTER (WHERE status = 'failed')                                  AS failed,
			COUNT(*) FILTER (WHERE status = 'cancelled')                               AS cancelled,
			AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at)))      AS avg_duration
		FROM pipeline_runs
		WHERE pipeline_id = $1
		  AND started_at >= NOW() - INTERVAL '%s'
		GROUP BY date_trunc('%s', started_at)
		ORDER BY date_trunc('%s', started_at) ASC
	`, trunc, interval, trunc, trunc)

	var entries []struct {
		Date        string   `db:"date"`
		Total       int      `db:"total"`
		Succeeded   int      `db:"succeeded"`
		Failed      int      `db:"failed"`
		Cancelled   int      `db:"cancelled"`
		AvgDuration *float64 `db:"avg_duration"`
	}

	err := r.db.SelectContext(ctx, &entries, query, pipelineID)
	if err != nil {
		return nil, fmt.Errorf("query pipeline trend: %w", err)
	}

	result := make([]models.TrendEntry, len(entries))
	for i, e := range entries {
		result[i] = models.TrendEntry{
			Date:        e.Date,
			Total:       e.Total,
			Succeeded:   e.Succeeded,
			Failed:      e.Failed,
			Cancelled:   e.Cancelled,
			AvgDuration: e.AvgDuration,
		}
	}
	return result, nil
}

// GetRunHistoryCompare returns aggregated run history for each pipeline.
func (r *Repository) GetRunHistoryCompare(ctx context.Context, pipelineIDs []string, period, granularity string) (map[string][]models.TrendEntry, error) {
	result := make(map[string][]models.TrendEntry, len(pipelineIDs))
	for _, pid := range pipelineIDs {
		entries, err := r.GetRunHistoryTrend(ctx, pid, period, granularity)
		if err != nil {
			return nil, fmt.Errorf("query compare for pipeline %s: %w", pid, err)
		}
		result[pid] = entries
	}
	return result, nil
}

// getDB is exposed for service-layer use if needed.
func (r *Repository) getDB() *sqlx.DB {
	return r.db
}

// Ensure the repository is usable at package init.
var _ = time.Now