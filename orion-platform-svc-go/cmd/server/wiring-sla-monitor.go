package main

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"go.uber.org/zap"
	"orion/go-common/pkg/database"
	alertpipeline_repo "orion/platform-svc-go/internal/alert-pipeline/repository"
	alertsla_monitor "orion/platform-svc-go/internal/alert-sla/monitor"
	alertsla_repo "orion/platform-svc-go/internal/alert-sla/repository"
	baserepo "orion/platform-svc-go/internal/repository"
)

// alertPipelineSource adapts the alert-pipeline repository to the
// monitor.AlertSource interface. It queries alert_pipeline_results for
// active alerts matching the given severity.
type alertPipelineSource struct {
	repo *alertpipeline_repo.Repository
}

// ActiveAlerts returns alerts from the pipeline results table that match
// the given severity. "Active" means status='success' (processed and not
// dropped/errored). AckedAt and ResolvedAt are nil since the pipeline
// results table doesn't track acknowledgment or resolution timestamps.
func (s *alertPipelineSource) ActiveAlerts(ctx context.Context, tenantID, severity string) ([]alertsla_monitor.ActiveAlert, error) {
	ctx = baserepo.WithTenant(ctx, tenantID)

	query := `SELECT alert_id, tenant_id, severity, created_at
		FROM alert_pipeline_results
		WHERE status = 'success'`
	args := []interface{}{}

	if severity != "" && severity != "all" {
		query += ` AND severity = $1`
		args = append(args, severity)
	}
	query += ` ORDER BY created_at DESC LIMIT 500`

	var rows []struct {
		AlertID   string         `db:"alert_id"`
		TenantID  string         `db:"tenant_id"`
		Severity  sql.NullString `db:"severity"`
		CreatedAt time.Time      `db:"created_at"`
	}
	err := s.repo.TenantAwareRepository.Select(ctx, &rows, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query active alerts: %w", err)
	}

	alerts := make([]alertsla_monitor.ActiveAlert, 0, len(rows))
	for _, r := range rows {
		sev := ""
		if r.Severity.Valid {
			sev = r.Severity.String
		}
		alerts = append(alerts, alertsla_monitor.ActiveAlert{
			ID:        r.AlertID,
			TenantID:  r.TenantID,
			Severity:  sev,
			CreatedAt: r.CreatedAt,
			// AckedAt and ResolvedAt are nil — pipeline results don't track these
		})
	}
	return alerts, nil
}

// slaMonitorInstance is the package-level SLA monitor for lifecycle management.
var slaMonitorInstance *alertsla_monitor.Monitor

// wireSLAMonitor creates and starts the SLA breach detection monitor.
// It uses the alert-pipeline repo as its AlertSource.
func wireSLAMonitor(db *database.DB, logger *zap.Logger) {
	slaRepo := alertsla_repo.NewRepository(db.DB)
	pipelineRepo := alertpipeline_repo.NewRepository(db.DB)

	source := &alertPipelineSource{repo: pipelineRepo}

	// Default to "default" tenant; in production, this would be populated
	// from the tenant configuration.
	monitor := alertsla_monitor.NewMonitor(slaRepo, source, logger, "default")
	monitor.SetInterval(60 * time.Second)

	ctx := context.Background()
	monitor.Start(ctx)
	slaMonitorInstance = monitor
	logger.Info("SLA breach monitor started", zap.Float64("interval_seconds", 60))
}

// stopSLAMonitor stops the SLA monitor if it was started.
func stopSLAMonitor() {
	if slaMonitorInstance != nil {
		slaMonitorInstance.Stop()
	}
}
