package service

// internal_helpers.go — Helper methods for efficiency service
// (restored after accidental deletion of duplicate file)

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/efficiency/models"
)

// computeChangePercent returns percentage change from prev to cur.
func (s *Service) computeChangePercent(cur, prev float64) float64 {
	if prev == 0 {
		if cur == 0 {
			return 0
		}
		return 100.0
	}
	return (cur - prev) / prev * 100
}

// loadAllFromRepo loads global deployments, pipelines, team/project data from repo.
func (s *Service) loadAllFromRepo(ctx context.Context) error {
	_ = ctx
	// For each tenant, load data from repository.
	// In practice this loads from DB; currently a no-op since repo stores by tenant ID
	// and we iterate tenants via the service's existing maps.
	_ = s
	return nil
}

// getCachedData returns copies of the cached deployments and pipeline records for a tenant.
func (s *Service) getCachedData(tenantID string) ([]models.DeploymentRecord, []models.PipelineCompletionRecord) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	d := s.globalDeployments[tenantID]
	p := s.globalPipelines[tenantID]
	dCopy := make([]models.DeploymentRecord, len(d))
	copy(dCopy, d)
	pCopy := make([]models.PipelineCompletionRecord, len(p))
	copy(pCopy, p)
	return dCopy, pCopy
}

// saveReportHistory appends a report to the in-memory history.
func (s *Service) saveReportHistory(tenantID string, report *models.EfficiencyReport) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.reportHistory[tenantID] = append(s.reportHistory[tenantID], report)
}

// persistReportHistoryAsync asynchronously persists the report to the repository.
func (s *Service) persistReportHistoryAsync(ctx context.Context, tenantID string, report *models.EfficiencyReport) {
	if s.repo == nil {
		return
	}
	data, err := json.Marshal(report)
	if err != nil {
		return
	}
	entry := &models.ReportHistoryEntry{
		ID:          fmt.Sprintf("rpt-%s", report.ReportID),
		TenantID:    tenantID,
		ReportData:  string(data),
		GeneratedAt: report.GeneratedAt,
	}
	_ = s.repo.CreateReportHistory(ctx, entry)
}

// getTeamPayload returns the team payload for a tenant/team.
func (s *Service) getTeamPayload(tenantID, teamID string) *teamPayload {
	teams := s.teamData[tenantID]
	return teams[teamID]
}

// getProjectPayload returns the project payload for a tenant/project.
func (s *Service) getProjectPayload(tenantID, projectID string) *projectPayload {
	projects := s.projectData[tenantID]
	return projects[projectID]
}

// persistTeamDataAsync asynchronously persists team data to the repository.
func (s *Service) persistTeamDataAsync(ctx context.Context, tenantID, teamID, name string, members int, pipelines []models.PipelineCompletionRecord, deployments []models.DeploymentRecord) error {
	if s.repo == nil {
		return nil
	}
	pd, _ := json.Marshal(pipelines)
	dd, _ := json.Marshal(deployments)
	_ = s.repo.CreateTeamData(ctx, &models.TeamData{
		ID:        fmt.Sprintf("team-%s-%s", tenantID, teamID),
		TenantID:  tenantID,
		Name:      name,
		Members:   members,
		Pipelines: string(pd),
		Deployments: string(dd),
	})
	return nil
}

// persistProjectDataAsync asynchronously persists project data to the repository.
func (s *Service) persistProjectDataAsync(ctx context.Context, tenantID, projectID, name string, pipelines []models.PipelineCompletionRecord, deployments []models.DeploymentRecord, commits int) error {
	if s.repo == nil {
		return nil
	}
	pd, _ := json.Marshal(pipelines)
	dd, _ := json.Marshal(deployments)
	return s.repo.CreateProjectData(ctx, &models.ProjectData{
		ID:        fmt.Sprintf("proj-%s-%s", tenantID, projectID),
		TenantID:  tenantID,
		Name:      name,
		Pipelines: string(pd),
		Deployments: string(dd),
		Commits:   commits,
	})
}

// persistGlobalDeploymentsAsync asynchronously persists global deployments.
func (s *Service) persistGlobalDeploymentsAsync(ctx context.Context, tenantID string, deployments []models.DeploymentRecord) error {
	if s.repo == nil || len(deployments) == 0 {
		return nil
	}
	dd, _ := json.Marshal(deployments)
	return s.repo.CreateGlobalDeployment(ctx, &models.GlobalDeployment{
		ID:           fmt.Sprintf("gd-%s", tenantID),
		TenantID:     tenantID,
		DeploymentData: string(dd),
		DeployedAt:   deployments[0].DeployedAt,
	})
}

// persistGlobalPipelinesAsync asynchronously persists global pipelines.
func (s *Service) persistGlobalPipelinesAsync(ctx context.Context, tenantID string, pipelines []models.PipelineCompletionRecord) error {
	if s.repo == nil || len(pipelines) == 0 {
		return nil
	}
	pd, _ := json.Marshal(pipelines)
	return s.repo.CreateGlobalPipeline(ctx, &models.GlobalPipeline{
		ID:          fmt.Sprintf("gp-%s", tenantID),
		TenantID:    tenantID,
		PipelineData: string(pd),
		CompletedAt: pipelines[0].CompletedAt,
	})
}

// computePeriodMetrics computes metrics for a single period.
func (s *Service) computePeriodMetrics(pipelines []models.PipelineCompletionRecord, deployments []models.DeploymentRecord, start, end time.Time, period models.PeriodSpec) models.PeriodMetrics {
	_ = start
	_ = end
	total := len(pipelines)
	successful := 0
	var totalDur int64
	for _, p := range pipelines {
		totalDur += p.DurationMs
		if p.Status == "success" {
			successful++
		}
	}
	successRate := 0.0
	var avgBuildMs int64
	if total > 0 {
		successRate = float64(successful) / float64(total) * 100
		avgBuildMs = totalDur / int64(total)
	}

	failedDeploys := 0
	for _, d := range deployments {
		if d.Status == "failed" || d.Status == "rolled_back" {
			failedDeploys++
		}
	}
	cfr := 0.0
	if len(deployments) > 0 {
		cfr = float64(failedDeploys) / float64(len(deployments)) * 100
	}

	return models.PeriodMetrics{
		Label:              period.Label,
		Start:              period.Start.Format(time.RFC3339),
		End:                period.End.Format(time.RFC3339),
		PipelineRuns:       total,
		SuccessRate:        round2(successRate),
		AverageBuildTimeMs: avgBuildMs,
		Deployments:        len(deployments),
		ChangeFailureRate:  round2(cfr),
	}
}
