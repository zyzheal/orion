package service

import (
	"context"
	"orion/platform-svc-go/internal/efficiency/models"
)

// EfficiencyRepo abstracts the persistence layer for the efficiency service.
type EfficiencyRepo interface {
	CreateSnapshot(ctx context.Context, s *models.MetricSnapshot) error
	ListSnapshotsByTenant(ctx context.Context, tenantID string, limit int) ([]models.MetricSnapshot, error)
	PruneOldSnapshots(ctx context.Context, tenantID string, keep int) error
	CreateReportHistory(ctx context.Context, entry *models.ReportHistoryEntry) error
	ListReportHistory(ctx context.Context, tenantID string, limit int) ([]models.ReportHistoryEntry, error)
	CreateTeamData(ctx context.Context, t *models.TeamData) error
	GetTeamData(ctx context.Context, tenantID, teamID string) (*models.TeamData, error)
	ListTeamData(ctx context.Context, tenantID string) ([]models.TeamData, error)
	CreateProjectData(ctx context.Context, p *models.ProjectData) error
	GetProjectData(ctx context.Context, tenantID, projectID string) (*models.ProjectData, error)
	ListProjectData(ctx context.Context, tenantID string) ([]models.ProjectData, error)
	CreateGlobalDeployment(ctx context.Context, d *models.GlobalDeployment) error
	ListGlobalDeployments(ctx context.Context, tenantID string) ([]models.GlobalDeployment, error)
	DeleteGlobalDeploymentsByTenant(ctx context.Context, tenantID string) error
	CreateGlobalPipeline(ctx context.Context, p *models.GlobalPipeline) error
	ListGlobalPipelines(ctx context.Context, tenantID string) ([]models.GlobalPipeline, error)
	DeleteGlobalPipelinesByTenant(ctx context.Context, tenantID string) error
}
