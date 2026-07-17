package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"orion/platform-svc-go/internal/efficiency/models"
)

// -- mock repo --

type mockEfficiencyRepo struct {
	snapshots          map[string][]models.MetricSnapshot        // key: tenantID
	reportHistory      map[string][]models.ReportHistoryEntry    // key: tenantID
	teamData           map[string]map[string]*models.TeamData    // key: tenantID -> teamID
	projectData        map[string]map[string]*models.ProjectData // key: tenantID -> projectID
	globalDeployments  map[string][]models.GlobalDeployment      // key: tenantID
	globalPipelines    map[string][]models.GlobalPipeline        // key: tenantID
	dbErr              error
}

func newMockEfficiencyRepo() *mockEfficiencyRepo {
	return &mockEfficiencyRepo{
		snapshots:         make(map[string][]models.MetricSnapshot),
		reportHistory:     make(map[string][]models.ReportHistoryEntry),
		teamData:          make(map[string]map[string]*models.TeamData),
		projectData:       make(map[string]map[string]*models.ProjectData),
		globalDeployments: make(map[string][]models.GlobalDeployment),
		globalPipelines:   make(map[string][]models.GlobalPipeline),
	}
}

func (m *mockEfficiencyRepo) CreateSnapshot(_ context.Context, s *models.MetricSnapshot) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	m.snapshots[s.TenantID] = append(m.snapshots[s.TenantID], *s)
	return nil
}

func (m *mockEfficiencyRepo) ListSnapshotsByTenant(_ context.Context, tenantID string, _limit int) ([]models.MetricSnapshot, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	items := m.snapshots[tenantID]
	if len(items) == 0 {
		return nil, sql.ErrNoRows
	}
	out := make([]models.MetricSnapshot, len(items))
	copy(out, items)
	return out, nil
}

func (m *mockEfficiencyRepo) PruneOldSnapshots(_ context.Context, _tenantID string, _keep int) error {
	return m.dbErr
}

func (m *mockEfficiencyRepo) CreateReportHistory(_ context.Context, e *models.ReportHistoryEntry) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	e.ID = "rh-1"
	m.reportHistory[e.TenantID] = append(m.reportHistory[e.TenantID], *e)
	return nil
}

func (m *mockEfficiencyRepo) ListReportHistory(_ context.Context, tenantID string, _limit int) ([]models.ReportHistoryEntry, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	items := m.reportHistory[tenantID]
	out := make([]models.ReportHistoryEntry, len(items))
	copy(out, items)
	return out, nil
}

func (m *mockEfficiencyRepo) CreateTeamData(_ context.Context, t *models.TeamData) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	if m.teamData[t.TenantID] == nil {
		m.teamData[t.TenantID] = make(map[string]*models.TeamData)
	}
	m.teamData[t.TenantID][t.ID] = t
	return nil
}

func (m *mockEfficiencyRepo) GetTeamData(_ context.Context, tenantID, teamID string) (*models.TeamData, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	p, ok := m.teamData[tenantID][teamID]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return p, nil
}

func (m *mockEfficiencyRepo) ListTeamData(_ context.Context, tenantID string) ([]models.TeamData, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	items := m.teamData[tenantID]
	out := make([]models.TeamData, 0, len(items))
	// Return empty slice when no team data (not ErrNoRows)
	if len(items) == 0 {
		return out, nil
	}
	for _, v := range items {
		out = append(out, *v)
	}
	return out, nil
}

func (m *mockEfficiencyRepo) CreateProjectData(_ context.Context, p *models.ProjectData) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	if m.projectData[p.TenantID] == nil {
		m.projectData[p.TenantID] = make(map[string]*models.ProjectData)
	}
	m.projectData[p.TenantID][p.ID] = p
	return nil
}

func (m *mockEfficiencyRepo) GetProjectData(_ context.Context, tenantID, projectID string) (*models.ProjectData, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	p, ok := m.projectData[tenantID][projectID]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return p, nil
}

func (m *mockEfficiencyRepo) ListProjectData(_ context.Context, tenantID string) ([]models.ProjectData, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	items := m.projectData[tenantID]
	out := make([]models.ProjectData, 0, len(items))
	if len(items) == 0 {
		return out, nil
	}
	for _, v := range items {
		out = append(out, *v)
	}
	return out, nil
}

func (m *mockEfficiencyRepo) CreateGlobalDeployment(_ context.Context, d *models.GlobalDeployment) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	m.globalDeployments[d.TenantID] = append(m.globalDeployments[d.TenantID], *d)
	return nil
}

func (m *mockEfficiencyRepo) ListGlobalDeployments(_ context.Context, tenantID string) ([]models.GlobalDeployment, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	items := m.globalDeployments[tenantID]
	out := make([]models.GlobalDeployment, len(items))
	copy(out, items)
	return out, nil
}

func (m *mockEfficiencyRepo) DeleteGlobalDeploymentsByTenant(_ context.Context, tenantID string) error {
	return m.dbErr
}

func (m *mockEfficiencyRepo) CreateGlobalPipeline(_ context.Context, p *models.GlobalPipeline) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	m.globalPipelines[p.TenantID] = append(m.globalPipelines[p.TenantID], *p)
	return nil
}

func (m *mockEfficiencyRepo) ListGlobalPipelines(_ context.Context, tenantID string) ([]models.GlobalPipeline, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	items := m.globalPipelines[tenantID]
	out := make([]models.GlobalPipeline, len(items))
	copy(out, items)
	return out, nil
}

func (m *mockEfficiencyRepo) DeleteGlobalPipelinesByTenant(_ context.Context, tenantID string) error {
	return m.dbErr
}

// -- helpers --

func mockSvc(repo *mockEfficiencyRepo) *Service {
	return NewService(repo)
}

func buildSuccessDeployment(tenantID string, at time.Time) models.DeploymentRecord {
	return models.DeploymentRecord{
		TenantID:    tenantID,
		DeploymentID: "d-1",
		Service:     "svc",
		Environment: "prod",
		Status:      "success",
		DeployedAt:  at,
	}
}

func buildSuccessPipeline(tenantID string, at time.Time, durMs int64) models.PipelineCompletionRecord {
	return models.PipelineCompletionRecord{
		TenantID:    tenantID,
		RunID:       "run-1",
		PipelineID:  "p-1",
		Status:      "success",
		DurationMs:  durMs,
		CompletedAt: at,
	}
}

// -- tests --

func TestGenerateReport(t *testing.T) {
	ctx := context.Background()
	now := time.Now().UTC()

	repo := newMockEfficiencyRepo()
	svc := mockSvc(repo)

	// Inject real data
	svc.InjectGlobalData(ctx, "t1",
		[]models.DeploymentRecord{buildSuccessDeployment("t1", now)},
		[]models.PipelineCompletionRecord{buildSuccessPipeline("t1", now, 5000)},
	)

	report, err := svc.GenerateReport(ctx, "t1", models.TimeWindowDay, 1)
	if err != nil {
		t.Fatalf("GenerateReport error: %v", err)
	}
	if report.ReportID == "" {
		t.Fatal("report ID should be set")
	}
	if report.TotalPipelineRuns != 1 {
		t.Fatalf("expected 1 pipeline run, got %d", report.TotalPipelineRuns)
	}
	if report.TotalDeployments != 1 {
		t.Fatalf("expected 1 deployment, got %d", report.TotalDeployments)
	}
}

func TestGenerateReportErrorInjection(t *testing.T) {
	ctx := context.Background()
	repo := newMockEfficiencyRepo()
	repo.dbErr = errors.New("db down")
	svc := mockSvc(repo)

	// Report generation does not depend on repo for its core computation,
	// so it still succeeds; just verify it doesn't panic.
	_, err := svc.GenerateReport(ctx, "t1", models.TimeWindowDay, 1)
	// persistReportHistoryAsync runs in goroutine and ignores errors,
	// so we expect the report itself to be returned.
	if err != nil {
		t.Fatalf("GenerateReport error (should succeed with cached data): %v", err)
	}
}

func TestGetReportHistory(t *testing.T) {
	ctx := context.Background()
	now := time.Now().UTC()
	repo := newMockEfficiencyRepo()
	svc := mockSvc(repo)

	svc.InjectGlobalData(ctx, "t1",
		[]models.DeploymentRecord{buildSuccessDeployment("t1", now)},
		[]models.PipelineCompletionRecord{buildSuccessPipeline("t1", now, 3000)},
	)
	// Generate two reports
	_, err := svc.GenerateReport(ctx, "t1", models.TimeWindowDay, 1)
	if err != nil {
		t.Fatal(err)
	}
	_, err = svc.GenerateReport(ctx, "t1", models.TimeWindowDay, 1)
	if err != nil {
		t.Fatal(err)
	}

	history, err := svc.GetReportHistory(ctx, "t1", 10)
	if err != nil {
		t.Fatalf("GetReportHistory error: %v", err)
	}
	if len(history) != 2 {
		t.Fatalf("expected 2 reports, got %d", len(history))
	}
}

func TestGetReportHistoryEmpty(t *testing.T) {
	ctx := context.Background()
	repo := newMockEfficiencyRepo()
	svc := mockSvc(repo)

	history, err := svc.GetReportHistory(ctx, "t1", 10)
	if err != nil {
		t.Fatalf("GetReportHistory error: %v", err)
	}
	if len(history) != 0 {
		t.Fatalf("expected empty history, got %d", len(history))
	}
}

func TestGetTeamMetrics(t *testing.T) {
	ctx := context.Background()
	now := time.Now().UTC()
	repo := newMockEfficiencyRepo()
	svc := mockSvc(repo)

	svc.RegisterTeam(ctx, "t1", "team-a", "Team A", 5,
		[]models.PipelineCompletionRecord{
			buildSuccessPipeline("t1", now, 2000),
			buildSuccessPipeline("t1", now, 3000),
		},
		[]models.DeploymentRecord{buildSuccessDeployment("t1", now)},
	)

	metrics, err := svc.GetTeamMetrics(ctx, "t1", "team-a")
	if err != nil {
		t.Fatalf("GetTeamMetrics error: %v", err)
	}
	if metrics.TeamID != "team-a" {
		t.Fatalf("expected team-a, got %s", metrics.TeamID)
	}
	if metrics.CompletedPipelines != 2 {
		t.Fatalf("expected 2 pipelines, got %d", metrics.CompletedPipelines)
	}
	if metrics.SuccessRate != 100.0 {
		t.Fatalf("expected 100%% success, got %.1f", metrics.SuccessRate)
	}
}

func TestGetTeamMetricsNotFound(t *testing.T) {
	ctx := context.Background()
	repo := newMockEfficiencyRepo()
	svc := mockSvc(repo)

	metrics, err := svc.GetTeamMetrics(ctx, "t1", "nonexistent")
	if err != nil {
		t.Fatalf("GetTeamMetrics error: %v", err)
	}
	if metrics.TeamID != "nonexistent" {
		t.Fatalf("expected nonexistent team ID, got %s", metrics.TeamID)
	}
	// Empty team should return zero metrics
	if metrics.CompletedPipelines != 0 {
		t.Fatalf("expected 0 pipelines for missing team, got %d", metrics.CompletedPipelines)
	}
}

func TestGetProjectMetrics(t *testing.T) {
	ctx := context.Background()
	now := time.Now().UTC()
	repo := newMockEfficiencyRepo()
	svc := mockSvc(repo)

	svc.RegisterProject(ctx, "t1", "proj-1", "Project X", 42,
		[]models.PipelineCompletionRecord{buildSuccessPipeline("t1", now, 5000)},
		[]models.DeploymentRecord{buildSuccessDeployment("t1", now)},
	)

	metrics, err := svc.GetProjectMetrics(ctx, "t1", "proj-1")
	if err != nil {
		t.Fatalf("GetProjectMetrics error: %v", err)
	}
	if metrics.ProjectID != "proj-1" {
		t.Fatalf("expected proj-1, got %s", metrics.ProjectID)
	}
	if metrics.CommitCount != 42 {
		t.Fatalf("expected 42 commits, got %d", metrics.CommitCount)
	}
}

func TestGetProjectMetricsNotFound(t *testing.T) {
	ctx := context.Background()
	repo := newMockEfficiencyRepo()
	svc := mockSvc(repo)

	metrics, err := svc.GetProjectMetrics(ctx, "t1", "nonexistent")
	if err != nil {
		t.Fatalf("GetProjectMetrics error: %v", err)
	}
	if metrics.ProjectID != "nonexistent" {
		t.Fatalf("expected nonexistent project, got %s", metrics.ProjectID)
	}
}

func TestGetAllTeams(t *testing.T) {
	ctx := context.Background()
	repo := newMockEfficiencyRepo()
	svc := mockSvc(repo)

	teams := svc.GetAllTeams(ctx, "t1")
	if len(teams) != 6 { // defaultTeams
		t.Fatalf("expected 6 default teams, got %d", len(teams))
	}

	// After registration
	svc.RegisterTeam(ctx, "t1", "custom", "Custom Team", 3, nil, nil)
	teams = svc.GetAllTeams(ctx, "t1")
	if len(teams) != 1 {
		t.Fatalf("expected 1 registered team, got %d", len(teams))
	}
	if teams[0].TeamID != "custom" {
		t.Fatalf("expected custom team, got %s", teams[0].TeamID)
	}
}

func TestComparePeriods(t *testing.T) {
	ctx := context.Background()
	now := time.Now().UTC()
	repo := newMockEfficiencyRepo()
	svc := mockSvc(repo)

	// Period A (older)
	startA := now.Add(-14 * 24 * time.Hour)
	endA := now.Add(-7 * 24 * time.Hour)
	// Period B (recent)
	startB := now.Add(-7 * 24 * time.Hour)
	endB := now

	svc.InjectGlobalData(ctx, "t1",
		[]models.DeploymentRecord{buildSuccessDeployment("t1", endB.Add(-time.Hour))},
		[]models.PipelineCompletionRecord{buildSuccessPipeline("t1", endB.Add(-time.Hour), 4000)},
	)

	result, err := svc.ComparePeriods(ctx, "t1", models.PeriodSpec{
		Label: "A", Start: startA, End: endA,
	}, models.PeriodSpec{
		Label: "B", Start: startB, End: endB,
	})
	if err != nil {
		t.Fatalf("ComparePeriods error: %v", err)
	}
	if result.PeriodA.Label != "A" || result.PeriodB.Label != "B" {
		t.Fatal("period labels mismatch")
	}
}

func TestGetAllDORA(t *testing.T) {
	ctx := context.Background()
	now := time.Now().UTC()
	repo := newMockEfficiencyRepo()
	svc := mockSvc(repo)

	deploys := []models.DeploymentRecord{
		buildSuccessDeployment("t1", now.Add(-time.Hour)),
	}
	pipes := []models.PipelineCompletionRecord{
		buildSuccessPipeline("t1", now.Add(-time.Hour), 5000),
	}
	dora, err := svc.GetAllDORA(ctx, "t1", deploys, pipes, nil, models.TimeWindowDay, 1)
	if err != nil {
		t.Fatalf("GetAllDORA error: %v", err)
	}
	if dora.DeploymentFrequency.Value <= 0 {
		t.Fatal("deployment frequency should be positive")
	}
}

func TestGetBottlenecks(t *testing.T) {
	ctx := context.Background()
	repo := newMockEfficiencyRepo()
	svc := mockSvc(repo)

	bns := svc.GetBottlenecks(ctx, "t1", models.TimeWindowDay, 1)
	// With no data, should return "overall healthy"
	if len(bns) != 1 {
		t.Fatalf("expected 1 bottleneck (healthy), got %d", len(bns))
	}
	if bns[0].ID != "bn-ok" {
		t.Fatalf("expected bn-ok, got %s", bns[0].ID)
	}
}

func TestPersistTeamDataAsync(t *testing.T) {
	ctx := context.Background()
	repo := newMockEfficiencyRepo()
	svc := mockSvc(repo)

	pipelines := []models.PipelineCompletionRecord{buildSuccessPipeline("t1", time.Now().UTC(), 2000)}
	deployments := []models.DeploymentRecord{buildSuccessDeployment("t1", time.Now().UTC())}

	err := svc.persistTeamDataAsync(ctx, "t1", "team-1", "Team One", 4, pipelines, deployments)
	if err != nil {
		t.Fatalf("persistTeamDataAsync error: %v", err)
	}

	// Small sleep to let goroutine complete
	time.Sleep(50 * time.Millisecond)

	td, err := repo.GetTeamData(ctx, "t1", "team-1")
	if err != nil {
		t.Fatalf("GetTeamData error after persist: %v", err)
	}
	if td.Name != "Team One" {
		t.Fatalf("expected Team One, got %s", td.Name)
	}
}

func TestPersistTeamDataAsyncDBError(t *testing.T) {
	ctx := context.Background()
	repo := newMockEfficiencyRepo()
	repo.dbErr = errors.New("db error")
	svc := mockSvc(repo)

	err := svc.persistTeamDataAsync(ctx, "t1", "team-1", "Team One", 4, nil, nil)
	if err != nil {
		// persistTeamDataAsync ignores json errors but returns nil on db errors via goroutine
		t.Fatalf("persistTeamDataAsync error: %v", err)
	}
	// Should silently ignore the db error
}

func TestPersistGlobalDeploymentsAsync(t *testing.T) {
	ctx := context.Background()
	repo := newMockEfficiencyRepo()
	svc := mockSvc(repo)

	deploys := []models.DeploymentRecord{buildSuccessDeployment("t1", time.Now().UTC())}
	err := svc.persistGlobalDeploymentsAsync(ctx, "t1", deploys)
	if err != nil {
		t.Fatalf("persistGlobalDeploymentsAsync error: %v", err)
	}

	time.Sleep(50 * time.Millisecond)
	gds, err := repo.ListGlobalDeployments(ctx, "t1")
	if err != nil {
		t.Fatalf("ListGlobalDeployments error: %v", err)
	}
	if len(gds) != 1 {
		t.Fatalf("expected 1 global deployment, got %d", len(gds))
	}
}

func TestPersistReportHistoryAsync(t *testing.T) {
	ctx := context.Background()
	repo := newMockEfficiencyRepo()
	svc := mockSvc(repo)

	report := &models.EfficiencyReport{
		TenantID:    "t1",
		TimeWindow:  models.TimeWindowDay,
		GeneratedAt: time.Now().UTC(),
	}
	svc.persistReportHistoryAsync(ctx, "t1", report)

	time.Sleep(50 * time.Millisecond)
	entries, err := repo.ListReportHistory(ctx, "t1", 10)
	if err != nil {
		t.Fatalf("ListReportHistory error: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 report history entry, got %d", len(entries))
	}
}

func TestSaveSnapshot(t *testing.T) {
	ctx := context.Background()
	repo := newMockEfficiencyRepo()
	svc := mockSvc(repo)

	svc.saveSnapshot(ctx, "t1", models.TimeWindowWeek, models.MetricSnapshot{
		DeploymentFrequency: 1.5,
		LeadTimeMs:          100000,
		ChangeFailureRate:   2.0,
		MTTRMs:              50000,
	})

	time.Sleep(50 * time.Millisecond)
	snaps, err := repo.ListSnapshotsByTenant(ctx, "t1", 10)
	if err != nil {
		t.Fatalf("ListSnapshotsByTenant error: %v", err)
	}
	if len(snaps) != 1 {
		t.Fatalf("expected 1 snapshot, got %d", len(snaps))
	}
}

func TestSaveSnapshotDBError(t *testing.T) {
	ctx := context.Background()
	repo := newMockEfficiencyRepo()
	repo.dbErr = errors.New("db down")
	svc := mockSvc(repo)

	// Should not panic even with db error (runs in goroutine, ignores)
	svc.saveSnapshot(ctx, "t1", models.TimeWindowDay, models.MetricSnapshot{})
}

func TestGetCachedData(t *testing.T) {
	ctx := context.Background()
	now := time.Now().UTC()
	repo := newMockEfficiencyRepo()
	svc := mockSvc(repo)

	deploys := []models.DeploymentRecord{buildSuccessDeployment("t1", now)}
	pipes := []models.PipelineCompletionRecord{buildSuccessPipeline("t1", now, 1000)}
	svc.InjectGlobalData(ctx, "t1", deploys, pipes)

	d, p := svc.getCachedData("t1")
	if len(d) != 1 || len(p) != 1 {
		t.Fatalf("expected 1 deploy and 1 pipeline, got %d/%d", len(d), len(p))
	}
	// Verify they are copies (not the same slice)
	d[0].Status = "mutated"
	d2, _ := svc.getCachedData("t1")
	if d2[0].Status != "success" {
		t.Fatal("cached data should be a copy, not mutated")
	}
}

func TestRegisterProjectPersist(t *testing.T) {
	ctx := context.Background()
	repo := newMockEfficiencyRepo()
	svc := mockSvc(repo)

	svc.RegisterProject(ctx, "t1", "p1", "Proj", 10, nil, nil)

	time.Sleep(50 * time.Millisecond)
	pd, err := repo.GetProjectData(ctx, "t1", "p1")
	if err != nil {
		t.Fatalf("GetProjectData error: %v", err)
	}
	if pd.Commits != 10 {
		t.Fatalf("expected 10 commits, got %d", pd.Commits)
	}
}

func TestInjectGlobalData(t *testing.T) {
	ctx := context.Background()
	repo := newMockEfficiencyRepo()
	svc := mockSvc(repo)

	deploys := []models.DeploymentRecord{buildSuccessDeployment("t1", time.Now().UTC())}
	pipes := []models.PipelineCompletionRecord{buildSuccessPipeline("t1", time.Now().UTC(), 500)}
	svc.InjectGlobalData(ctx, "t1", deploys, pipes)

	time.Sleep(50 * time.Millisecond)
	gds, _ := repo.ListGlobalDeployments(ctx, "t1")
	gps, _ := repo.ListGlobalPipelines(ctx, "t1")
	if len(gds) != 1 {
		t.Fatalf("expected 1 global deployment, got %d", len(gds))
	}
	if len(gps) != 1 {
		t.Fatalf("expected 1 global pipeline, got %d", len(gps))
	}
}

func TestJSONRoundTrip(t *testing.T) {
	// Verify payload JSON round-trip doesn't break
	record := models.PipelineCompletionRecord{
		TenantID: "t1", Status: "success", DurationMs: 4200,
	}
	data, err := json.Marshal(record)
	if err != nil {
		t.Fatal(err)
	}
	var got models.PipelineCompletionRecord
	err = json.Unmarshal(data, &got)
	if err != nil {
		t.Fatal(err)
	}
	if got.DurationMs != 4200 {
		t.Fatalf("round-trip failed: got %d", got.DurationMs)
	}
}
