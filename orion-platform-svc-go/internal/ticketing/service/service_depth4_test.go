package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/repository"
	"orion/platform-svc-go/internal/ticketing/testutil"
)

// ---------------------------------------------------------------------------
// suspendRepoMock — SuspendRepositoryInterface with stateful fields
// ---------------------------------------------------------------------------

type suspendRepoMock struct {
	repository.SuspendRepositoryInterface

	createErr error
	updateErr error
	getErr    error

	records         []*models.SuspendRecord
	getByIDResult   *models.SuspendRecord
	getByIDError    error
	createCount     int
	suspensions     []models.Suspend
	engSuspensions  []models.Suspend
	impact          *models.EngineerSuspendImpact
	pendingByEng    int
	activeByEng     int
	listByEngineer  []models.SuspendRecord
}

func (m *suspendRepoMock) GetByID(ctx context.Context, id string) (*models.SuspendRecord, error) {
	if m.getByIDError != nil {
		return nil, m.getByIDError
	}
	if m.getByIDResult != nil {
		return m.getByIDResult, nil
	}
	if len(m.records) > 0 && m.records[0].ID == id {
		return m.records[0], nil
	}
	return nil, errors.New("not found")
}

func (m *suspendRepoMock) Create(ctx context.Context, rec *models.SuspendRecord) error {
	m.createCount++
	if m.createErr != nil {
		return m.createErr
	}
	m.records = append(m.records, rec)
	return nil
}

func (m *suspendRepoMock) Update(ctx context.Context, rec *models.SuspendRecord) error {
	if m.updateErr != nil {
		return m.updateErr
	}
	for i, r := range m.records {
		if r.ID == rec.ID {
			m.records[i] = rec
			return nil
		}
	}
	return nil
}

func (m *suspendRepoMock) ListByEngineer(ctx context.Context, engineerID string) ([]models.SuspendRecord, error) {
	return m.listByEngineer, nil
}

func (m *suspendRepoMock) CountPendingByEngineer(ctx context.Context, engineerID string) (int, error) {
	return m.pendingByEng, nil
}

func (m *suspendRepoMock) CountActiveByEngineer(ctx context.Context, engineerID string) (int, error) {
	return m.activeByEng, nil
}

// ---------------------------------------------------------------------------
// SuspendService
// ---------------------------------------------------------------------------

func newSuspendService(mock *suspendRepoMock) *SuspendService {
	return NewSuspendService(mock, testutil.NewMockDispatchRepository(), NewSLAService(testutil.NewMockSLARepository(), testutil.NewMockTicketRepository()))
}

func TestSuspendServiceCreateSuspendValidation(t *testing.T) {
	mock := &suspendRepoMock{}
	s := newSuspendService(mock)

	// Invalid reason
	_, err := s.CreateSuspend(context.Background(), &models.CreateSuspendRequest{
		Reason: "invalid", StartTime: "2026-01-01T00:00:00Z", EndTime: "2026-01-02T00:00:00Z",
	})
	if err == nil || !strings.Contains(err.Error(), "invalid suspend reason") {
		t.Errorf("expected invalid reason, got %v", err)
	}

	// Invalid start_time
	_, err = s.CreateSuspend(context.Background(), &models.CreateSuspendRequest{
		Reason: "vacation", StartTime: "not_a_time", EndTime: "2026-01-02T00:00:00Z",
	})
	if err == nil || !strings.Contains(err.Error(), "invalid start_time") {
		t.Errorf("expected invalid start, got %v", err)
	}

	// Invalid end_time
	_, err = s.CreateSuspend(context.Background(), &models.CreateSuspendRequest{
		Reason: "vacation", StartTime: "2026-01-01T00:00:00Z", EndTime: "not_a_time",
	})
	if err == nil || !strings.Contains(err.Error(), "invalid end_time") {
		t.Errorf("expected invalid end, got %v", err)
	}
}

func TestSuspendServiceCreateSuspendSucceeds(t *testing.T) {
	mock := &suspendRepoMock{}
	s := newSuspendService(mock)
	now := time.Now().UTC()
	req := &models.CreateSuspendRequest{
		Reason: "vacation",
		StartTime: now.Format(time.RFC3339),
		EndTime: now.Add(24 * time.Hour).Format(time.RFC3339),
		EngineerID: "e1",
	}
	rec, err := s.CreateSuspend(context.Background(), req)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if rec == nil || rec.Status != "pending" || rec.EngineerID != "e1" {
		t.Errorf("rec = %+v", rec)
	}
	if mock.createCount != 1 {
		t.Errorf("createCount = %d, want 1", mock.createCount)
	}
}

func TestSuspendServiceCreateSuspendPropagatesCreateError(t *testing.T) {
	mock := &suspendRepoMock{createErr: errors.New("db")}
	s := newSuspendService(mock)
	now := time.Now().UTC()
	_, err := s.CreateSuspend(context.Background(), &models.CreateSuspendRequest{
		Reason: "vacation",
		StartTime: now.Format(time.RFC3339),
		EndTime: now.Add(time.Hour).Format(time.RFC3339),
	})
	if err == nil || !strings.Contains(err.Error(), "db") {
		t.Errorf("err = %v", err)
	}
}

func TestSuspendServiceActivateSuspend(t *testing.T) {
	mock := &suspendRepoMock{
		records: []*models.SuspendRecord{{ID: "s1", Status: "pending", EngineerID: "e1"}},
	}
	s := newSuspendService(mock)
	rec, err := s.ActivateSuspend(context.Background(), "s1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if rec.Status != "active" {
		t.Errorf("status = %q, want active", rec.Status)
	}
}

func TestSuspendServiceActivateSuspendNotFound(t *testing.T) {
	mock := &suspendRepoMock{getByIDError: errors.New("nope")}
	s := newSuspendService(mock)
	if _, err := s.ActivateSuspend(context.Background(), "x"); err == nil {
		t.Error("expected not-found error")
	}
}

func TestSuspendServiceActivateSuspendRejectsWrongStatus(t *testing.T) {
	mock := &suspendRepoMock{getByIDResult: &models.SuspendRecord{ID: "s1", Status: "active"}}
	s := newSuspendService(mock)
	_, err := s.ActivateSuspend(context.Background(), "s1")
	if err == nil || !strings.Contains(err.Error(), "cannot activate") {
		t.Errorf("err = %v", err)
	}
}

func TestSuspendServiceActivateSuspendPropagatesUpdateError(t *testing.T) {
	mock := &suspendRepoMock{
		getByIDResult: &models.SuspendRecord{ID: "s1", Status: "pending"},
		updateErr:     errors.New("db"),
	}
	s := newSuspendService(mock)
	if _, err := s.ActivateSuspend(context.Background(), "s1"); err == nil {
		t.Error("expected update error")
	}
}

func TestSuspendServiceEndSuspend(t *testing.T) {
	mock := &suspendRepoMock{
		getByIDResult: &models.SuspendRecord{ID: "s1", Status: "active"},
	}
	s := newSuspendService(mock)
	if _, err := s.EndSuspend(context.Background(), "s1"); err != nil {
		t.Errorf("err: %v", err)
	}
}

func TestSuspendServiceEndSuspendNotFound(t *testing.T) {
	mock := &suspendRepoMock{getByIDError: errors.New("nope")}
	s := newSuspendService(mock)
	if _, err := s.EndSuspend(context.Background(), "x"); err == nil {
		t.Error("expected error")
	}
}

func TestSuspendServiceCancelSuspend(t *testing.T) {
	mock := &suspendRepoMock{
		getByIDResult: &models.SuspendRecord{ID: "s1", Status: "pending"},
	}
	s := newSuspendService(mock)
	if _, err := s.CancelSuspend(context.Background(), "s1"); err != nil {
		t.Errorf("err: %v", err)
	}
}

func TestSuspendServiceCancelSuspendRejectsActive(t *testing.T) {
	mock := &suspendRepoMock{
		getByIDResult: &models.SuspendRecord{ID: "s1", Status: "active"},
	}
	s := newSuspendService(mock)
	if _, err := s.CancelSuspend(context.Background(), "s1"); err == nil {
		t.Error("expected error for active suspension")
	}
}

func TestSuspendServiceCancelSuspendNotFound(t *testing.T) {
	mock := &suspendRepoMock{getByIDError: errors.New("nope")}
	s := newSuspendService(mock)
	if _, err := s.CancelSuspend(context.Background(), "x"); err == nil {
		t.Error("expected error")
	}
}

// ---------------------------------------------------------------------------
// AnalyticsService — full mock suite
// ---------------------------------------------------------------------------

type analyticsRepoMock struct {
	repository.AnalyticsRepositoryInterface
	stats *models.TicketStatistics
	statsErr error
	resStats *models.ResolutionStats
	resErr error
	backlog *models.BacklogAnalysis
	backlogErr error
	trendData []models.TrendPoint
	trendErr error
	execDash *models.ExecutiveDashboard
	execErr error
}

func (m *analyticsRepoMock) GetTicketStats(ctx context.Context, tenantID string) (*models.TicketStatistics, error) {
	if m.statsErr != nil {
		return nil, m.statsErr
	}
	if m.stats == nil {
		return &models.TicketStatistics{}, nil
	}
	return m.stats, nil
}
func (m *analyticsRepoMock) GetResolutionStats(ctx context.Context, tenantID string) (*models.ResolutionStats, error) {
	return m.resStats, m.resErr
}
func (m *analyticsRepoMock) GetBacklogAnalysis(ctx context.Context, tenantID string) (*models.BacklogAnalysis, error) {
	return m.backlog, m.backlogErr
}
func (m *analyticsRepoMock) GetTrendData(ctx context.Context, tenantID string, days int, granularity string) ([]models.TrendPoint, error) {
	return m.trendData, m.trendErr
}
func (m *analyticsRepoMock) GetExecutiveDashboard(ctx context.Context, tenantID string, start, end time.Time) (*models.ExecutiveDashboard, error) {
	return m.execDash, m.execErr
}

type transferRepoMock struct {
	repository.TransferRepositoryInterface
	history  []models.TransferHistoryEntry
	stats    *models.TransferStats
	statsErr error
	create   []*models.TransferRecord
	list     []models.TransferRecord
	rawStats map[string]any
	rawErr   error
}

func (m *transferRepoMock) TransferTicket(ctx context.Context, tenantID, ticketID, fromUserID, toUserID, reason string) error {
	return nil
}
func (m *transferRepoMock) GetTransferHistory(ctx context.Context, tenantID, ticketID string) ([]models.TransferHistoryEntry, error) {
	return m.history, nil
}
func (m *transferRepoMock) GetTransferStats(ctx context.Context, tenantID string) (*models.TransferStats, error) {
	return m.stats, m.statsErr
}
func (m *transferRepoMock) Create(ctx context.Context, rec *models.TransferRecord) error {
	m.create = append(m.create, rec)
	return nil
}
func (m *transferRepoMock) ListByTicket(ctx context.Context, ticketID string) ([]models.TransferRecord, error) {
	return m.list, nil
}
func (m *transferRepoMock) GetStats(ctx context.Context, start, end time.Time) (map[string]any, error) {
	if m.rawErr != nil {
		return nil, m.rawErr
	}
	if m.rawStats != nil {
		return m.rawStats, nil
	}
	return map[string]any{}, nil
}

func newAnalyticsService(mock *analyticsRepoMock) *AnalyticsService {
	return NewAnalyticsService(
		mock,
		testutil.NewMockDispatchRepository(),
		testutil.NewMockSLARepository(),
		&transferRepoMock{stats: &models.TransferStats{}},
		testutil.NewMockTicketRepository(),
	)
}

func TestAnalyticsServiceGetStatistics(t *testing.T) {
	mock := &analyticsRepoMock{stats: &models.TicketStatistics{}}
	s := newAnalyticsService(mock)
	if _, err := s.GetStatistics(context.Background(), "t1"); err != nil {
		t.Errorf("err: %v", err)
	}
}

func TestAnalyticsServiceGetStatisticsPropagatesError(t *testing.T) {
	mock := &analyticsRepoMock{statsErr: errors.New("db")}
	s := newAnalyticsService(mock)
	if _, err := s.GetStatistics(context.Background(), "t1"); err == nil {
		t.Error("expected error")
	}
}

func TestAnalyticsServiceGetResolutionStats(t *testing.T) {
	mock := &analyticsRepoMock{resStats: &models.ResolutionStats{}}
	s := newAnalyticsService(mock)
	if _, err := s.GetResolutionStats(context.Background(), "t1"); err != nil {
		t.Errorf("err: %v", err)
	}
}

func TestAnalyticsServiceGetResolutionStatsPropagatesError(t *testing.T) {
	mock := &analyticsRepoMock{resErr: errors.New("db")}
	s := newAnalyticsService(mock)
	if _, err := s.GetResolutionStats(context.Background(), "t1"); err == nil {
		t.Error("expected error")
	}
}

func TestAnalyticsServiceGetBacklogAnalysis(t *testing.T) {
	mock := &analyticsRepoMock{backlog: &models.BacklogAnalysis{}}
	s := newAnalyticsService(mock)
	if _, err := s.GetBacklogAnalysis(context.Background(), "t1"); err != nil {
		t.Errorf("err: %v", err)
	}
}

func TestAnalyticsServiceGetBacklogAnalysisPropagatesError(t *testing.T) {
	mock := &analyticsRepoMock{backlogErr: errors.New("db")}
	s := newAnalyticsService(mock)
	if _, err := s.GetBacklogAnalysis(context.Background(), "t1"); err == nil {
		t.Error("expected error")
	}
}

func TestAnalyticsServiceGetTrendReport(t *testing.T) {
	mock := &analyticsRepoMock{trendData: []models.TrendPoint{{}}}
	s := newAnalyticsService(mock)
	if _, err := s.GetTrendReport(context.Background(), "t1", 7, "day"); err != nil {
		t.Errorf("err: %v", err)
	}
}

func TestAnalyticsServiceGetTrendReportPropagatesError(t *testing.T) {
	mock := &analyticsRepoMock{trendErr: errors.New("db")}
	s := newAnalyticsService(mock)
	if _, err := s.GetTrendReport(context.Background(), "t1", 7, "day"); err == nil {
		t.Error("expected error")
	}
}

func TestAnalyticsServiceGetExecutiveDashboard(t *testing.T) {
	mock := &analyticsRepoMock{execDash: &models.ExecutiveDashboard{}}
	s := newAnalyticsService(mock)
	if _, err := s.GetExecutiveDashboard(context.Background(), "t1", time.Now(), time.Now().Add(time.Hour)); err != nil {
		t.Errorf("err: %v", err)
	}
}

func TestAnalyticsServiceGetExecutiveDashboardPropagatesError(t *testing.T) {
	mock := &analyticsRepoMock{execErr: errors.New("db")}
	s := newAnalyticsService(mock)
	if _, err := s.GetExecutiveDashboard(context.Background(), "t1", time.Now(), time.Now().Add(time.Hour)); err == nil {
		t.Error("expected error")
	}
}

func TestAnalyticsServiceGetManagerDashboard(t *testing.T) {
	mock := &analyticsRepoMock{execDash: &models.ExecutiveDashboard{}}
	s := newAnalyticsService(mock)
	if _, err := s.GetManagerDashboard(context.Background(), "t1", time.Now(), time.Now().Add(time.Hour)); err != nil {
		t.Errorf("err: %v", err)
	}
}

func newAnalyticsServiceWithEngineer() *AnalyticsService {
	dispatch := testutil.NewMockDispatchRepository()
	dispatch.Engineers = []models.EngineerProfile{
		{EngineerID: "e1", Score: 85, CurrentLoad: 2, MaxCapacity: 10},
	}
	return NewAnalyticsService(
		&analyticsRepoMock{},
		dispatch,
		testutil.NewMockSLARepository(),
		&transferRepoMock{stats: &models.TransferStats{}},
		testutil.NewMockTicketRepository(),
	)
}

func TestAnalyticsServiceGetEngineerDashboard(t *testing.T) {
	s := newAnalyticsServiceWithEngineer()
	if _, err := s.GetEngineerDashboard(context.Background(), "e1", time.Now(), time.Now().Add(time.Hour)); err != nil {
		t.Errorf("err: %v", err)
	}
}

func TestAnalyticsServiceGetEngineerDashboardNotFound(t *testing.T) {
	s := newAnalyticsServiceWithEngineer()
	if _, err := s.GetEngineerDashboard(context.Background(), "ghost", time.Now(), time.Now().Add(time.Hour)); err == nil {
		t.Error("expected not-found error")
	}
}

func TestAnalyticsServiceGetEfficiencyScore(t *testing.T) {
	s := newAnalyticsServiceWithEngineer()
	if _, err := s.GetEfficiencyScore(context.Background(), "e1", time.Now(), time.Now().Add(time.Hour)); err != nil {
		t.Errorf("err: %v", err)
	}
}

func TestAnalyticsServiceGetEfficiencyScoreNotFound(t *testing.T) {
	s := newAnalyticsServiceWithEngineer()
	if _, err := s.GetEfficiencyScore(context.Background(), "ghost", time.Now(), time.Now().Add(time.Hour)); err == nil {
		t.Error("expected not-found error")
	}
}

func TestAnalyticsServiceComparePeriods(t *testing.T) {
	mock := &analyticsRepoMock{}
	s := newAnalyticsService(mock)
	if _, err := s.ComparePeriods(context.Background(), "t1", time.Now(), time.Now().Add(time.Hour), time.Now().Add(-time.Hour*24), time.Now().Add(-time.Hour*23)); err != nil {
		t.Errorf("err: %v", err)
	}
}

func TestAnalyticsServiceExportBIData(t *testing.T) {
	mock := &analyticsRepoMock{}
	s := newAnalyticsService(mock)
	if _, err := s.ExportBIData(context.Background(), "t1", "tickets", "day", time.Now(), time.Now().Add(time.Hour)); err != nil {
		t.Errorf("err: %v", err)
	}
}

func TestAnalyticsServiceGetTimeTrend(t *testing.T) {
	mock := &analyticsRepoMock{trendData: []models.TrendPoint{{}}}
	s := newAnalyticsService(mock)
	if _, err := s.GetTimeTrend(context.Background(), "t1", "created", time.Now(), time.Now().Add(time.Hour), "day"); err != nil {
		t.Errorf("err: %v", err)
	}
}

// ---------------------------------------------------------------------------
// TransferService
// ---------------------------------------------------------------------------

func newTransferServiceForTest(mockTransfer *transferRepoMock, mockTicket *testutil.MockTicketRepository, mockSuspend *suspendRepoMock) *TransferService {
	return NewTransferService(
		mockTransfer,
		mockTicket,
		testutil.NewMockDispatchRepository(),
		mockSuspend,
	)
}

func TestTransferServiceUpdateAndGetConfig(t *testing.T) {
	s := newTransferServiceForTest(&transferRepoMock{}, testutil.NewMockTicketRepository(), &suspendRepoMock{})
	if got := s.GetConfig().MaxTransfers; got <= 0 {
		t.Errorf("default MaxTransfers=%d, want >0", got)
	}
	updated := models.AutoTransferConfig{MaxTransfers: 3}
	s.UpdateConfig(updated)
	if got := s.GetConfig().MaxTransfers; got != 3 {
		t.Errorf("got MaxTransfers=%d, want 3", got)
	}
}

func TestTransferServiceGetTransferHistory(t *testing.T) {
	mockT := &transferRepoMock{list: []models.TransferRecord{{ID: "tr-1"}}}
	s := newTransferServiceForTest(mockT, testutil.NewMockTicketRepository(), &suspendRepoMock{})
	hist, err := s.GetTransferHistory(context.Background(), "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(hist) != 1 || hist[0].ID != "tr-1" {
		t.Errorf("history = %+v", hist)
	}
}

func TestTransferServiceGetTransferStats(t *testing.T) {
	mockT := &transferRepoMock{rawStats: map[string]any{"total_transfers": 5, "avg_hold_duration_ms": 123.0}}
	s := newTransferServiceForTest(mockT, testutil.NewMockTicketRepository(), &suspendRepoMock{})
	stats, err := s.GetTransferStats(context.Background(), time.Now().Add(-time.Hour), time.Now())
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if stats.TotalTransfers != 5 {
		t.Errorf("TotalTransfers=%d, want 5", stats.TotalTransfers)
	}
	if stats.AvgTransfers != 123.0 {
		t.Errorf("AvgTransfers=%v, want 123.0", stats.AvgTransfers)
	}
}

func TestTransferServiceGetTransferStatsFloatToInt(t *testing.T) {
	mockT := &transferRepoMock{rawStats: map[string]any{"total_transfers": float64(42)}}
	s := newTransferServiceForTest(mockT, testutil.NewMockTicketRepository(), &suspendRepoMock{})
	stats, err := s.GetTransferStats(context.Background(), time.Now().Add(-time.Hour), time.Now())
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if stats.TotalTransfers != 42 {
		t.Errorf("TotalTransfers=%d, want 42 (float64 path)", stats.TotalTransfers)
	}
}

func TestTransferServiceGetTransferStatsDefaultsOnEmpty(t *testing.T) {
	mockT := &transferRepoMock{} // empty rawStats
	s := newTransferServiceForTest(mockT, testutil.NewMockTicketRepository(), &suspendRepoMock{})
	stats, err := s.GetTransferStats(context.Background(), time.Time{}, time.Time{})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if stats.TotalTransfers != 0 || stats.AvgTransfers != 0 {
		t.Errorf("empty rawStats should yield zero stats, got %+v", stats)
	}
}

func TestTransferServiceGetTransferStatsPropagatesError(t *testing.T) {
	mockT := &transferRepoMock{rawErr: errors.New("db")}
	s := newTransferServiceForTest(mockT, testutil.NewMockTicketRepository(), &suspendRepoMock{})
	if _, err := s.GetTransferStats(context.Background(), time.Now(), time.Now().Add(time.Hour)); err == nil {
		t.Error("expected error")
	}
}

func TestTransferServiceManualTransferTicketNotFound(t *testing.T) {
	s := newTransferServiceForTest(&transferRepoMock{}, testutil.NewMockTicketRepository(), &suspendRepoMock{})
	if _, err := s.ManualTransfer(context.Background(), "ghost", "t1", "e1", "u1", "reason"); err == nil {
		t.Error("expected ticket-not-found error")
	}
}

func TestTransferServiceCheckAndAutoTransferEmpty(t *testing.T) {
	s := newTransferServiceForTest(&transferRepoMock{}, testutil.NewMockTicketRepository(), &suspendRepoMock{})
	out, err := s.CheckAndAutoTransfer(context.Background(), "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(out) != 0 {
		t.Errorf("expected empty result, got %+v", out)
	}
}

func TestTransferServiceTransferDueToSuspendNotFound(t *testing.T) {
	mockS := &suspendRepoMock{getByIDError: errors.New("nope")}
	s := newTransferServiceForTest(&transferRepoMock{}, testutil.NewMockTicketRepository(), mockS)
	if _, err := s.TransferDueToSuspend(context.Background(), "x"); err == nil {
		t.Error("expected error")
	}
}
