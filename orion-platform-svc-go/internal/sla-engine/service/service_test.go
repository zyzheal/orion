package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/sla-engine/models"
)

// ── Mock Repository ──────────────────────────────────────────────────────────

type mockSLARepository struct {
	profiles   map[string]*models.SLAProfile
	trackers   map[string]*models.SLATracker
	holidays   map[string]*models.SLAHoliday
	violations map[string][]models.SLAViolation
}

func newMockRepo() *mockSLARepository {
	return &mockSLARepository{
		profiles:   make(map[string]*models.SLAProfile),
		trackers:   make(map[string]*models.SLATracker),
		holidays:   make(map[string]*models.SLAHoliday),
		violations: make(map[string][]models.SLAViolation),
	}
}

func (m *mockSLARepository) CreateProfile(ctx context.Context, p *models.SLAProfile) error {
	m.profiles[p.ID] = p
	return nil
}

func (m *mockSLARepository) GetProfile(ctx context.Context, tenantID, id string) (*models.SLAProfile, error) {
	p, ok := m.profiles[id]
	if !ok {
		return nil, sentinel.NotFound
	}
	return p, nil
}

func (m *mockSLARepository) ListProfiles(ctx context.Context, tenantID string, q models.ProfileListQuery) ([]models.SLAProfile, error) {
	var out []models.SLAProfile
	for _, p := range m.profiles {
		if p.TenantID == tenantID {
			out = append(out, *p)
		}
	}
	return out, nil
}

func (m *mockSLARepository) UpdateProfile(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if _, ok := m.profiles[id]; !ok {
		return sentinel.NotFound
	}
	return nil
}

func (m *mockSLARepository) DeleteProfile(ctx context.Context, tenantID, id string) error {
	delete(m.profiles, id)
	return nil
}

func (m *mockSLARepository) CreateTracker(ctx context.Context, t *models.SLATracker) error {
	m.trackers[t.ID] = t
	return nil
}

func (m *mockSLARepository) GetTracker(ctx context.Context, tenantID, id string) (*models.SLATracker, error) {
	t, ok := m.trackers[id]
	if !ok {
		return nil, sentinel.NotFound
	}
	return t, nil
}

func (m *mockSLARepository) ListTrackers(ctx context.Context, tenantID string, q models.TrackerListQuery) ([]models.SLATracker, error) {
	var out []models.SLATracker
	for _, t := range m.trackers {
		if t.TenantID == tenantID {
			if q.TargetType != "" && t.TargetType != q.TargetType {
				continue
			}
			if q.Status != "" && t.Status != q.Status {
				continue
			}
			tr := *t
			out = append(out, tr)
		}
	}
	return out, nil
}

func (m *mockSLARepository) UpdateTracker(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if _, ok := m.trackers[id]; !ok {
		return sentinel.NotFound
	}
	t := m.trackers[id]
	for k, v := range updates {
		switch k {
		case "status":
			if s, ok := v.(string); ok {
				t.Status = s
			}
		case "paused_at":
			if tv, ok := v.(time.Time); ok {
				t.PausedAt = &tv
			}
		case "paused_reason":
			if r, ok := v.(string); ok {
				t.PausedReason = r
			}
		case "response_time":
			if iv, ok := v.(int64); ok {
				t.ResponseTime = &iv
			}
		case "resolution_time":
			if iv, ok := v.(int64); ok {
				t.ResolutionTime = &iv
			}
		}
	}
	return nil
}

func (m *mockSLARepository) DeleteTracker(ctx context.Context, tenantID, id string) error {
	delete(m.trackers, id)
	return nil
}

func (m *mockSLARepository) CreateHoliday(ctx context.Context, h *models.SLAHoliday) error {
	m.holidays[h.ID] = h
	return nil
}

func (m *mockSLARepository) ListHolidays(ctx context.Context, tenantID string, year int) ([]models.SLAHoliday, error) {
	var out []models.SLAHoliday
	for _, h := range m.holidays {
		if h.TenantID == tenantID && h.Date.Year() == year {
			hi := *h
			out = append(out, hi)
		}
	}
	return out, nil
}

func (m *mockSLARepository) DeleteHoliday(ctx context.Context, tenantID, id string) error {
	delete(m.holidays, id)
	return nil
}

func (m *mockSLARepository) GetActiveTrackersByProfile(ctx context.Context, tenantID, profileID string) ([]models.SLATracker, error) {
	var out []models.SLATracker
	for _, t := range m.trackers {
		if t.TenantID == tenantID && t.SLAProfileID == profileID && t.Status == "active" {
			tr := *t
			out = append(out, tr)
		}
	}
	return out, nil
}

func (m *mockSLARepository) GetTrackerStatistics(ctx context.Context, tenantID string) (models.TrackerStatistics, error) {
	var s models.TrackerStatistics
	for _, t := range m.trackers {
		if t.TenantID == tenantID {
			s.Total++
			switch t.Status {
			case "open", "active":
				s.Active++
			case "responded":
				s.Responded++
			case "resolved":
				s.Resolved++
			case "breached":
				s.Breached++
			case "paused":
				s.Paused++
			}
		}
	}
	return s, nil
}

func (m *mockSLARepository) GetHolidaysForPeriod(ctx context.Context, tenantID string, start, end interface{}) ([]models.SLAHoliday, error) {
	return nil, nil
}

func (m *mockSLARepository) CreateViolation(ctx context.Context, v *models.SLAViolation) error {
	m.violations[v.TrackerID] = append(m.violations[v.TrackerID], *v)
	return nil
}

func (m *mockSLARepository) ListViolations(ctx context.Context, tenantID string, q models.ViolationListQuery) ([]models.SLAViolation, error) {
	var out []models.SLAViolation
	for _, vs := range m.violations {
		out = append(out, vs...)
	}
	return out, nil
}

func (m *mockSLARepository) MarkViolated(ctx context.Context, tenantID, trackerID string, violationType, details string) (*models.SLAViolation, error) {
	if _, ok := m.trackers[trackerID]; !ok {
		return nil, sentinel.NotFound
	}
	v := &models.SLAViolation{
		ID:            "v_" + trackerID,
		TenantID:      tenantID,
		TrackerID:     trackerID,
		ViolationType: violationType,
		Details:       details,
		ViolatedAt:    time.Now(),
		CreatedAt:     time.Now(),
	}
	m.violations[trackerID] = append(m.violations[trackerID], *v)
	return v, nil
}

func (m *mockSLARepository) GetViolationsByTracker(ctx context.Context, trackerID string) ([]models.SLAViolation, error) {
	return m.violations[trackerID], nil
}

func (m *mockSLARepository) GetViolationStatistics(ctx context.Context, tenantID string) (models.ViolationStatistics, error) {
	var s models.ViolationStatistics
	for _, vs := range m.violations {
		s.TotalViolations += len(vs)
	}
	return s, nil
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func makeProfile(repo *mockSLARepository, id string) *models.SLAProfile {
	bh := true
	p := &models.SLAProfile{
		ID:            id,
		TenantID:      "t1",
		Name:          "Standard SLA",
		Type:          "both",
		Priority:      "P2",
		ResponseSLA:   "4h",
		ResolutionSLA: "24h",
		Status:        "active",
		BusinessHours: bh,
		WorkingDays:   "Mon,Tue,Wed,Thu,Fri",
		WorkingHours:  "09:00-18:00",
	}
	repo.CreateProfile(context.Background(), p)
	return p
}

func makeTracker(repo *mockSLARepository, id, slaProfileID, targetID, targetType string, openedAt time.Time, status string) *models.SLATracker {
	t := &models.SLATracker{
		ID:                 id,
		TenantID:           "t1",
		SLAProfileID:       slaProfileID,
		TargetID:           targetID,
		TargetType:         targetType,
		OpenedAt:           openedAt,
		ResponseDeadline:   openedAt.Add(4 * time.Hour),
		ResolutionDeadline: openedAt.Add(24 * time.Hour),
		Status:             status,
		CreatedAt:          openedAt,
	}
	repo.CreateTracker(context.Background(), t)
	return t
}

// ── Tests ────────────────────────────────────────────────────────────────────

func TestCalculateDeadlines(t *testing.T) {
	ctx := context.Background()
	calc := NewSLACalculator(newMockRepo())
	profile := &models.SLAProfile{
		ResponseSLA:   "4h",
		ResolutionSLA: "24h",
		WorkingDays:   "Mon,Tue,Wed,Thu,Fri",
		WorkingHours:  "09:00-18:00",
	}
	openedAt := time.Date(2026, 1, 27, 10, 0, 0, 0, time.UTC) // Tuesday

	rd, resd := calc.CalculateDeadlines(ctx, profile, openedAt)
	if rd.Before(openedAt) {
		t.Error("responseDeadline should be after openedAt")
	}
	if resd.Before(rd) {
		t.Error("resolutionDeadline should be after responseDeadline")
	}
}

func TestCalculateDeadlinesHandlesEmptyDuration(t *testing.T) {
	ctx := context.Background()
	calc := NewSLACalculator(newMockRepo())
	profile := &models.SLAProfile{
		ResponseSLA:   "",
		ResolutionSLA: "",
	}
	openedAt := time.Now()

	rd, resd := calc.CalculateDeadlines(ctx, profile, openedAt)
	// Empty durations fall back to defaults (1h/8h in addBusinessHours),
	// so both should be after openedAt.
	if rd.Before(openedAt) {
		t.Error("responseDeadline should not be before openedAt")
	}
	if resd.Before(rd) {
		t.Error("resolutionDeadline should not be before responseDeadline")
	}
}

func TestCreateTracker(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	calc := NewSLACalculator(repo)
	makeProfile(repo, "p1")

	tracker, err := calc.CreateTracker(ctx, "t1", "p1", "target1", "ticket", time.Now())
	if err != nil {
		t.Fatalf("CreateTracker returned error: %v", err)
	}
	if tracker.SLAProfileID != "p1" {
		t.Errorf("SLAProfileID=%s, want p1", tracker.SLAProfileID)
	}
	if tracker.TargetType != "ticket" {
		t.Errorf("TargetType=%s, want ticket", tracker.TargetType)
	}
	if tracker.Status != "active" {
		t.Errorf("Status=%s, want active", tracker.Status)
	}
}

func TestCreateTrackerFailsWithEmptyProfileID(t *testing.T) {
	ctx := context.Background()
	calc := NewSLACalculator(newMockRepo())
	_, err := calc.CreateTracker(ctx, "t1", "", "target1", "ticket", time.Now())
	if err == nil {
		t.Error("expected error for empty profileID, got nil")
	}
}

func TestCreateTrackerFailsWithInactiveProfile(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	calc := NewSLACalculator(repo)
	p := makeProfile(repo, "p1")
	p.Status = "disabled"

	_, err := calc.CreateTracker(ctx, "t1", "p1", "target1", "ticket", time.Now())
	if err == nil {
		t.Error("expected error for inactive profile, got nil")
	}
}

func TestPauseTracker(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	calc := NewSLACalculator(repo)
	_ = makeTracker(repo, "t1", "p1", "target1", "ticket", time.Now(), "active")

	err := calc.PauseTracker(ctx, "t1", "t1", "awaiting vendor")
	if err != nil {
		t.Fatalf("PauseTracker returned error: %v", err)
	}
	t2, _ := calc.GetTracker(ctx, "t1", "t1")
	if t2.Status != "paused" {
		t.Errorf("Status=%s, want paused", t2.Status)
	}
	if t2.PausedAt == nil {
		t.Error("PausedAt should be set")
	}
}

func TestPauseTrackerNotFound(t *testing.T) {
	ctx := context.Background()
	calc := NewSLACalculator(newMockRepo())
	err := calc.PauseTracker(ctx, "t1", "nonexistent", "reason")
	if err == nil {
		t.Error("expected error for nonexistent tracker, got nil")
	}
}

func TestPauseTrackerBlocksResolvedStatus(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	calc := NewSLACalculator(repo)
	_ = makeTracker(repo, "t1", "p1", "target1", "ticket", time.Now(), "resolved")

	err := calc.PauseTracker(ctx, "t1", "t1", "reason")
	if err == nil {
		t.Error("expected error for resolved tracker, got nil")
	}
}

func TestResumeTracker(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	calc := NewSLACalculator(repo)
	_ = makeTracker(repo, "t1", "p1", "target1", "ticket", time.Now(), "paused")

	err := calc.ResumeTracker(ctx, "t1", "t1")
	if err != nil {
		t.Fatalf("ResumeTracker returned error: %v", err)
	}
	t2, _ := calc.GetTracker(ctx, "t1", "t1")
	if t2.Status != "active" {
		t.Errorf("Status=%s, want active", t2.Status)
	}
}

func TestResumeTrackerNotFound(t *testing.T) {
	ctx := context.Background()
	calc := NewSLACalculator(newMockRepo())
	err := calc.ResumeTracker(ctx, "t1", "nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent tracker, got nil")
	}
}

func TestRecordResponse(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	calc := NewSLACalculator(repo)
	_ = makeTracker(repo, "t1", "p1", "target1", "ticket", time.Now(), "active")

	err := calc.RecordResponse(ctx, "t1", "t1")
	if err != nil {
		t.Fatalf("RecordResponse returned error: %v", err)
	}
	t2, _ := calc.GetTracker(ctx, "t1", "t1")
	if t2.Status != "responded" {
		t.Errorf("Status=%s, want responded", t2.Status)
	}
	if t2.ResponseTime == nil {
		t.Error("ResponseTime should be set")
	}
}

func TestRecordResolution(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	calc := NewSLACalculator(repo)
	_ = makeTracker(repo, "t1", "p1", "target1", "ticket", time.Now(), "active")

	err := calc.RecordResolution(ctx, "t1", "t1")
	if err != nil {
		t.Fatalf("RecordResolution returned error: %v", err)
	}
	t2, _ := calc.GetTracker(ctx, "t1", "t1")
	if t2.Status != "resolved" {
		t.Errorf("Status=%s, want resolved", t2.Status)
	}
	if t2.ResolutionTime == nil {
		t.Error("ResolutionTime should be set")
	}
}

func TestCheckBreaches(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	calc := NewSLACalculator(repo)
	// Opened 10h ago; response deadline = openedAt + 4h = 6h ago → breached
	past := time.Now().Add(-10 * time.Hour)
	_ = makeTracker(repo, "t1", "p1", "a", "ticket", past, "open")

	breaches := calc.CheckBreaches(ctx, "t1")
	if len(breaches) == 0 {
		t.Error("expected at least one breach for old open tracker")
	}
}

func TestCheckBreachesSkipsResolved(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	calc := NewSLACalculator(repo)
	past := time.Now().Add(-10 * time.Hour)
	_ = makeTracker(repo, "t1", "p1", "a", "ticket", past, "resolved")

	breaches := calc.CheckBreaches(ctx, "t1")
	if len(breaches) != 0 {
		t.Error("resolved trackers should not breach")
	}
}

func TestCheckBreachesSkipsBreached(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	calc := NewSLACalculator(repo)
	past := time.Now().Add(-10 * time.Hour)
	_ = makeTracker(repo, "t1", "p1", "a", "ticket", past, "breached")

	breaches := calc.CheckBreaches(ctx, "t1")
	if len(breaches) != 0 {
		t.Error("already-breached trackers should not breach again")
	}
}

func TestGetTrackerNotFound(t *testing.T) {
	ctx := context.Background()
	calc := NewSLACalculator(newMockRepo())
	_, err := calc.GetTracker(ctx, "t1", "nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent tracker, got nil")
	}
}

func TestCreateProfile(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	calc := NewSLACalculator(repo)
	bh := true
	req := models.CreateProfileRequest{
		Name:          "Test SLA",
		Type:          "both",
		Priority:      "P2",
		ResponseSLA:   "2h",
		ResolutionSLA: "8h",
		BusinessHours: &bh,
	}
	profile, err := calc.CreateProfile(ctx, "t1", req)
	if err != nil {
		t.Fatalf("CreateProfile returned error: %v", err)
	}
	if profile.Name != "Test SLA" {
		t.Errorf("Name=%s, want Test SLA", profile.Name)
	}
	if profile.TenantID != "t1" {
		t.Errorf("TenantID=%s, want t1", profile.TenantID)
	}
	if profile.ResponseSLA != "2h" {
		t.Errorf("ResponseSLA=%s, want 2h", profile.ResponseSLA)
	}
}

func TestGetProfileNotFound(t *testing.T) {
	ctx := context.Background()
	calc := NewSLACalculator(newMockRepo())
	_, err := calc.GetProfile(ctx, "t1", "nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent profile, got nil")
	}
}

func TestUpdateProfileDefaults(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	calc := NewSLACalculator(repo)
	profile := makeProfile(repo, "p1")

	_, err := calc.UpdateProfile(ctx, "t1", profile.ID, models.UpdateProfileRequest{})
	if err != nil {
		t.Fatalf("UpdateProfile returned error: %v", err)
	}
	updated, _ := calc.GetProfile(ctx, "t1", profile.ID)
	// Defaults should be applied
	if updated.WorkingDays != "Mon,Tue,Wed,Thu,Fri" {
		t.Errorf("WorkingDays=%s, want Mon,Tue,Wed,Thu,Fri", updated.WorkingDays)
	}
	if updated.WorkingHours != "09:00-18:00" {
		t.Errorf("WorkingHours=%s, want 09:00-18:00", updated.WorkingHours)
	}
}

func TestDeleteProfile(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	calc := NewSLACalculator(repo)
	profile := makeProfile(repo, "p1")

	err := calc.DeleteProfile(ctx, "t1", profile.ID)
	if err != nil {
		t.Fatalf("DeleteProfile returned error: %v", err)
	}
	_, err = calc.GetProfile(ctx, "t1", profile.ID)
	if err == nil {
		t.Error("expected error after deletion, got nil")
	}
}

func TestCreateHoliday(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	calc := NewSLACalculator(repo)

	date := time.Date(2026, 12, 25, 0, 0, 0, 0, time.UTC)
	holiday, err := calc.CreateHoliday(ctx, "t1", "Christmas", date)
	if err != nil {
		t.Fatalf("CreateHoliday returned error: %v", err)
	}
	if holiday.Date != date {
		t.Errorf("Date=%v, want %v", holiday.Date, date)
	}
}

func TestListProfiles(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	calc := NewSLACalculator(repo)
	_ = makeProfile(repo, "p1")
	_ = makeProfile(repo, "p2")

	profiles, err := calc.ListProfiles(ctx, "t1", models.ProfileListQuery{})
	if err != nil {
		t.Fatalf("ListProfiles returned error: %v", err)
	}
	if len(profiles) != 2 {
		t.Errorf("got %d profiles, want 2", len(profiles))
	}
}

func TestListTrackersFilterByTargetType(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	calc := NewSLACalculator(repo)
	_ = makeTracker(repo, "t1", "p1", "a", "ticket", time.Now(), "open")
	_ = makeTracker(repo, "t2", "p1", "b", "incident", time.Now(), "open")

	trackers, err := calc.ListTrackers(ctx, "t1", "ticket", "", 0, 0)
	if err != nil {
		t.Fatalf("ListTrackers returned error: %v", err)
	}
	if len(trackers) != 1 {
		t.Errorf("got %d trackers, want 1", len(trackers))
	}
}

func TestMarkViolated(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	calc := NewSLACalculator(repo)
	_ = makeTracker(repo, "t1", "p1", "a", "ticket", time.Now(), "active")

	v, err := calc.MarkViolated(ctx, "t1", "t1", "response", "missed deadline")
	if err != nil {
		t.Fatalf("MarkViolated returned error: %v", err)
	}
	if v.ViolationType != "response" {
		t.Errorf("ViolationType=%s, want response", v.ViolationType)
	}
}

func TestMarkViolatedNotFound(t *testing.T) {
	ctx := context.Background()
	calc := NewSLACalculator(newMockRepo())
	_, err := calc.MarkViolated(ctx, "t1", "nonexistent", "response", "detail")
	if err == nil {
		t.Error("expected error for nonexistent tracker, got nil")
	}
}

func TestTrackerStatistics(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	calc := NewSLACalculator(repo)
	_ = makeTracker(repo, "t1", "p1", "a", "ticket", time.Now(), "open")
	_ = makeTracker(repo, "t2", "p1", "b", "ticket", time.Now(), "paused")

	stats, err := calc.GetTrackerStatistics(ctx, "t1")
	if err != nil {
		t.Fatalf("GetTrackerStatistics returned error: %v", err)
	}
	if stats.Total != 2 {
		t.Errorf("Total=%d, want 2", stats.Total)
	}
	if stats.Paused != 1 {
		t.Errorf("Paused=%d, want 1", stats.Paused)
	}
}

func TestGetViolationStatistics(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	calc := NewSLACalculator(repo)
	_ = makeTracker(repo, "t1", "p1", "a", "ticket", time.Now(), "active")
	_, _ = calc.MarkViolated(ctx, "t1", "t1", "response", "detail")
	_, _ = calc.MarkViolated(ctx, "t1", "t1", "resolution", "detail")

	stats, err := calc.GetViolationStatistics(ctx, "t1")
	if err != nil {
		t.Fatalf("GetViolationStatistics returned error: %v", err)
	}
	if stats.TotalViolations != 2 {
		t.Errorf("TotalViolations=%d, want 2", stats.TotalViolations)
	}
}

func TestIsNotFound(t *testing.T) {
	trueErr := sentinel.NotFound
	if !errors.Is(trueErr, sentinel.NotFound) {
		t.Error("sentinel.NotFound should match itself")
	}
	falseErr := errors.New("other")
	if errors.Is(falseErr, sentinel.NotFound) {
		t.Error("IsNotFound returned true for non-NotFoundError")
	}
}

func TestTrackerStatisticsEmpty(t *testing.T) {
	ctx := context.Background()
	calc := NewSLACalculator(newMockRepo())
	stats, err := calc.GetTrackerStatistics(ctx, "t1")
	if err != nil {
		t.Fatalf("GetTrackerStatistics returned error: %v", err)
	}
	if stats.Total != 0 {
		t.Errorf("Total=%d, want 0", stats.Total)
	}
}

func TestScanBreaches(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	calc := NewSLACalculator(repo)
	// Opened 10h ago, response deadline 4h ago → breached
	_ = makeTracker(repo, "t1", "p1", "a", "ticket", time.Now().Add(-10*time.Hour), "active")

	alerts, err := calc.ScanBreaches(ctx, "t1")
	if err != nil {
		t.Fatalf("ScanBreaches returned error: %v", err)
	}
	if len(alerts) == 0 {
		t.Error("expected at least one breach alert")
	}
}

func TestGetViolationsByTracker(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	calc := NewSLACalculator(repo)
	_ = makeTracker(repo, "t1", "p1", "a", "ticket", time.Now(), "active")
	_, _ = calc.MarkViolated(ctx, "t1", "t1", "response", "detail")

	vs, err := calc.GetViolationsByTracker(ctx, "t1")
	if err != nil {
		t.Fatalf("GetViolationsByTracker returned error: %v", err)
	}
	if len(vs) != 1 {
		t.Errorf("got %d violations, want 1", len(vs))
	}
}
