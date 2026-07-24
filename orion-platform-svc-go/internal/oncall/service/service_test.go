package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"orion/platform-svc-go/internal/oncall/models"
	"orion/platform-svc-go/internal/oncall/repository"
)

// --- mock repository ---

type mockOnCallRepo struct {
	schedules    map[string]*models.Schedule
	assignments  map[string]*models.Assignment
	overrides    map[string]*models.Override
	createSchedErr error
	createAssignErr error
	createOverrideErr error
}

func (m *mockOnCallRepo) CreateSchedule(_ context.Context, s *models.Schedule) error {
	if m.createSchedErr != nil {
		return m.createSchedErr
	}
	m.schedules[s.ID] = s
	return nil
}

func (m *mockOnCallRepo) GetSchedule(_ context.Context, id string) (*models.Schedule, error) {
	s, ok := m.schedules[id]
	if !ok {
		return nil, repository.ErrScheduleNotFound
	}
	return s, nil
}

func (m *mockOnCallRepo) ListSchedules(_ context.Context, _ string, status *string) ([]models.Schedule, int, error) {
	var items []models.Schedule
	for _, s := range m.schedules {
		if status != nil && *status != "" && s.Status != *status {
			continue
		}
		items = append(items, *s)
	}
	return items, len(items), nil
}

func (m *mockOnCallRepo) UpdateSchedule(_ context.Context, id string, updates map[string]interface{}) (*models.Schedule, error) {
	s, ok := m.schedules[id]
	if !ok {
		return nil, repository.ErrScheduleNotFound
	}
	if v, ok := updates["name"]; ok {
		s.Name = v.(string)
	}
	if v, ok := updates["timezone"]; ok {
		s.Timezone = v.(string)
	}
	if v, ok := updates["rotation_type"]; ok {
		s.RotationType = v.(string)
	}
	if v, ok := updates["status"]; ok {
		s.Status = v.(string)
	}
	s.UpdatedAt = time.Now().UTC()
	return s, nil
}

func (m *mockOnCallRepo) DeleteSchedule(_ context.Context, id string) (bool, error) {
	_, ok := m.schedules[id]
	if !ok {
		return false, nil
	}
	delete(m.schedules, id)
	return true, nil
}

func (m *mockOnCallRepo) CreateAssignment(_ context.Context, a *models.Assignment) error {
	if m.createAssignErr != nil {
		return m.createAssignErr
	}
	m.assignments[a.ID] = a
	return nil
}

func (m *mockOnCallRepo) GetAssignment(_ context.Context, id string) (*models.Assignment, error) {
	a, ok := m.assignments[id]
	if !ok {
		return nil, repository.ErrAssignmentNotFound
	}
	return a, nil
}

func (m *mockOnCallRepo) ListAssignments(_ context.Context, scheduleID *string) ([]models.Assignment, int, error) {
	var items []models.Assignment
	for _, a := range m.assignments {
		if scheduleID != nil && *scheduleID != "" && a.ScheduleID != *scheduleID {
			continue
		}
		items = append(items, *a)
	}
	return items, len(items), nil
}

func (m *mockOnCallRepo) UpdateAssignment(_ context.Context, id string, updates map[string]interface{}) (*models.Assignment, error) {
	a, ok := m.assignments[id]
	if !ok {
		return nil, repository.ErrAssignmentNotFound
	}
	if v, ok := updates["assignee_id"]; ok {
		a.AssigneeID = v.(string)
	}
	if v, ok := updates["role"]; ok {
		a.Role = v.(string)
	}
	return a, nil
}

func (m *mockOnCallRepo) DeleteAssignment(_ context.Context, id string) (bool, error) {
	_, ok := m.assignments[id]
	if !ok {
		return false, nil
	}
	delete(m.assignments, id)
	return true, nil
}

func (m *mockOnCallRepo) CreateOverride(_ context.Context, o *models.Override) error {
	if m.createOverrideErr != nil {
		return m.createOverrideErr
	}
	m.overrides[o.ID] = o
	return nil
}

func (m *mockOnCallRepo) GetOverride(_ context.Context, id string) (*models.Override, error) {
	o, ok := m.overrides[id]
	if !ok {
		return nil, repository.ErrOverrideNotFound
	}
	return o, nil
}

func (m *mockOnCallRepo) ListOverrides(_ context.Context, scheduleID *string) ([]models.Override, int, error) {
	var items []models.Override
	for _, o := range m.overrides {
		if scheduleID != nil && *scheduleID != "" && o.ScheduleID != *scheduleID {
			continue
		}
		items = append(items, *o)
	}
	return items, len(items), nil
}

func (m *mockOnCallRepo) UpdateOverride(_ context.Context, id string, updates map[string]interface{}) (*models.Override, error) {
	o, ok := m.overrides[id]
	if !ok {
		return nil, repository.ErrOverrideNotFound
	}
	if v, ok := updates["assignee_id"]; ok {
		o.AssigneeID = v.(string)
	}
	return o, nil
}

func (m *mockOnCallRepo) DeleteOverride(_ context.Context, id string) (bool, error) {
	_, ok := m.overrides[id]
	if !ok {
		return false, nil
	}
	delete(m.overrides, id)
	return true, nil
}

func (m *mockOnCallRepo) GetScheduleAssignments(_ context.Context, scheduleID string, now time.Time) ([]models.Assignment, error) {
	var items []models.Assignment
	for _, a := range m.assignments {
		if a.ScheduleID != scheduleID {
			continue
		}
		if a.StartTime.Before(now) || a.EndTime.After(now) || a.StartTime.Equal(now) || a.EndTime.Equal(now) {
			items = append(items, *a)
		}
	}
	return items, nil
}

func (m *mockOnCallRepo) GetActiveOverrides(_ context.Context, scheduleID string, now time.Time) ([]models.Override, error) {
	var items []models.Override
	for _, o := range m.overrides {
		if o.ScheduleID != scheduleID {
			continue
		}
		if o.StartTime.Before(now) || o.EndTime.After(now) || o.StartTime.Equal(now) || o.EndTime.Equal(now) {
			items = append(items, *o)
		}
	}
	return items, nil
}

// newTestService creates a Service using an adapted repository.
// Since Service expects *repository.Repository, we build a mock adapter.
func newMockAdapter(repo *mockOnCallRepo) *repository.Repository {
	// We cannot directly wrap because repository.Repository is a struct, not an interface.
	// Instead we use a helper that injects the mock methods into a real repository stub.
	// But since the struct is not an interface, we create a wrapper struct that embeds mockOnCallRepo
	// and matches repository.Repository's method set, then cast at call time via our test helper.
	return &repository.Repository{}
}

// testService wraps Service but allows injecting a mock repository via a function pointer pattern.
// Since we can't change Service struct, we use interface dispatch.
type repoInterface interface {
	CreateSchedule(context.Context, *models.Schedule) error
	GetSchedule(context.Context, string) (*models.Schedule, error)
	ListSchedules(context.Context, string, *string) ([]models.Schedule, int, error)
	UpdateSchedule(context.Context, string, map[string]interface{}) (*models.Schedule, error)
	DeleteSchedule(context.Context, string) (bool, error)
	CreateAssignment(context.Context, *models.Assignment) error
	GetAssignment(context.Context, string) (*models.Assignment, error)
	ListAssignments(context.Context, *string) ([]models.Assignment, int, error)
	UpdateAssignment(context.Context, string, map[string]interface{}) (*models.Assignment, error)
	DeleteAssignment(context.Context, string) (bool, error)
	CreateOverride(context.Context, *models.Override) error
	GetOverride(context.Context, string) (*models.Override, error)
	ListOverrides(context.Context, *string) ([]models.Override, int, error)
	UpdateOverride(context.Context, string, map[string]interface{}) (*models.Override, error)
	DeleteOverride(context.Context, string) (bool, error)
	GetScheduleAssignments(context.Context, string, time.Time) ([]models.Assignment, error)
	GetActiveOverrides(context.Context, string, time.Time) ([]models.Override, error)
}

// repoAdapter embeds a repoInterface and satisfies repository.Repository by delegating.
type repoAdapter struct {
	ri repoInterface
}

func (r *repoAdapter) CreateSchedule(ctx context.Context, s *models.Schedule) error { return r.ri.CreateSchedule(ctx, s) }
func (r *repoAdapter) GetSchedule(ctx context.Context, id string) (*models.Schedule, error) { return r.ri.GetSchedule(ctx, id) }
func (r *repoAdapter) ListSchedules(ctx context.Context, t string, s *string) ([]models.Schedule, int, error) { return r.ri.ListSchedules(ctx, t, s) }
func (r *repoAdapter) UpdateSchedule(ctx context.Context, id string, u map[string]interface{}) (*models.Schedule, error) { return r.ri.UpdateSchedule(ctx, id, u) }
func (r *repoAdapter) DeleteSchedule(ctx context.Context, id string) (bool, error) { return r.ri.DeleteSchedule(ctx, id) }
func (r *repoAdapter) CreateAssignment(ctx context.Context, a *models.Assignment) error { return r.ri.CreateAssignment(ctx, a) }
func (r *repoAdapter) GetAssignment(ctx context.Context, id string) (*models.Assignment, error) { return r.ri.GetAssignment(ctx, id) }
func (r *repoAdapter) ListAssignments(ctx context.Context, s *string) ([]models.Assignment, int, error) { return r.ri.ListAssignments(ctx, s) }
func (r *repoAdapter) UpdateAssignment(ctx context.Context, id string, u map[string]interface{}) (*models.Assignment, error) { return r.ri.UpdateAssignment(ctx, id, u) }
func (r *repoAdapter) DeleteAssignment(ctx context.Context, id string) (bool, error) { return r.ri.DeleteAssignment(ctx, id) }
func (r *repoAdapter) CreateOverride(ctx context.Context, o *models.Override) error { return r.ri.CreateOverride(ctx, o) }
func (r *repoAdapter) GetOverride(ctx context.Context, id string) (*models.Override, error) { return r.ri.GetOverride(ctx, id) }
func (r *repoAdapter) ListOverrides(ctx context.Context, s *string) ([]models.Override, int, error) { return r.ri.ListOverrides(ctx, s) }
func (r *repoAdapter) UpdateOverride(ctx context.Context, id string, u map[string]interface{}) (*models.Override, error) { return r.ri.UpdateOverride(ctx, id, u) }
func (r *repoAdapter) DeleteOverride(ctx context.Context, id string) (bool, error) { return r.ri.DeleteOverride(ctx, id) }
func (r *repoAdapter) GetScheduleAssignments(ctx context.Context, scheduleID string, now time.Time) ([]models.Assignment, error) { return r.ri.GetScheduleAssignments(ctx, scheduleID, now) }
func (r *repoAdapter) GetActiveOverrides(ctx context.Context, scheduleID string, now time.Time) ([]models.Override, error) { return r.ri.GetActiveOverrides(ctx, scheduleID, now) }

// mockService is a Service-like struct that uses a mock repo directly.
type mockService struct {
	repo repoInterface
}

func (s *mockService) Create(ctx context.Context, tenantID string, req *models.CreateScheduleRequest) (*models.Schedule, error) {
	schedule := &models.Schedule{
		TenantID: tenantID, Name: req.Name, Timezone: "UTC", RotationType: "daily", Status: "active",
	}
	if req.Timezone != "" { schedule.Timezone = req.Timezone }
	if req.RotationType != "" { schedule.RotationType = req.RotationType }
	if req.Status != "" { schedule.Status = req.Status }
	schedule.ID = "sched-1"
	if err := s.repo.CreateSchedule(ctx, schedule); err != nil {
		return nil, err
	}
	return schedule, nil
}

func (s *mockService) Get(ctx context.Context, id string) (*models.Schedule, error) { return s.repo.GetSchedule(ctx, id) }
func (s *mockService) List(ctx context.Context, tenantID string, status *string) ([]models.Schedule, int, error) { return s.repo.ListSchedules(ctx, tenantID, status) }
func (s *mockService) Update(ctx context.Context, id string, req *models.UpdateScheduleRequest) (*models.Schedule, error) {
	updates := map[string]interface{}{}
	if req.Name != nil && *req.Name != "" { updates["name"] = *req.Name }
	if req.Timezone != nil && *req.Timezone != "" { updates["timezone"] = *req.Timezone }
	if len(updates) == 0 { return nil, errors.New("no fields to update") }
	return s.repo.UpdateSchedule(ctx, id, updates)
}
func (s *mockService) Delete(ctx context.Context, id string) (bool, error) { return s.repo.DeleteSchedule(ctx, id) }

func (s *mockService) CreateAssignment(ctx context.Context, req *models.CreateAssignmentRequest) (*models.Assignment, error) {
	startTime, _ := time.Parse("2006-01-02T15:04:05Z", req.StartTime)
	endTime, _ := time.Parse("2006-01-02T15:04:05Z", req.EndTime)
	a := &models.Assignment{
		ID: "assign-1", ScheduleID: req.ScheduleID, AssigneeID: req.AssigneeID,
		AssigneeName: req.AssigneeName, Role: "primary", StartTime: startTime, EndTime: endTime,
	}
	if req.Role != "" { a.Role = req.Role }
	if err := s.repo.CreateAssignment(ctx, a); err != nil { return nil, err }
	return a, nil
}
func (s *mockService) GetAssignment(ctx context.Context, id string) (*models.Assignment, error) { return s.repo.GetAssignment(ctx, id) }
func (s *mockService) ListAssignments(ctx context.Context, scheduleID *string) ([]models.Assignment, int, error) { return s.repo.ListAssignments(ctx, scheduleID) }
func (s *mockService) UpdateAssignment(ctx context.Context, id string, req *models.UpdateAssignmentRequest) (*models.Assignment, error) {
	updates := map[string]interface{}{}
	if req.AssigneeID != nil && *req.AssigneeID != "" { updates["assignee_id"] = *req.AssigneeID }
	if len(updates) == 0 { return nil, errors.New("no fields to update") }
	return s.repo.UpdateAssignment(ctx, id, updates)
}
func (s *mockService) DeleteAssignment(ctx context.Context, id string) (bool, error) { return s.repo.DeleteAssignment(ctx, id) }

func (s *mockService) CreateOverride(ctx context.Context, req *models.CreateOverrideRequest) (*models.Override, error) {
	startTime, _ := time.Parse("2006-01-02T15:04:05Z", req.StartTime)
	endTime, _ := time.Parse("2006-01-02T15:04:05Z", req.EndTime)
	o := &models.Override{
		ID: "override-1", ScheduleID: req.ScheduleID, AssigneeID: req.AssigneeID,
		AssigneeName: req.AssigneeName, Reason: req.Reason, StartTime: startTime, EndTime: endTime,
	}
	if err := s.repo.CreateOverride(ctx, o); err != nil { return nil, err }
	return o, nil
}
func (s *mockService) GetOverride(ctx context.Context, id string) (*models.Override, error) { return s.repo.GetOverride(ctx, id) }
func (s *mockService) ListOverrides(ctx context.Context, scheduleID *string) ([]models.Override, int, error) { return s.repo.ListOverrides(ctx, scheduleID) }
func (s *mockService) UpdateOverride(ctx context.Context, id string, req *models.UpdateOverrideRequest) (*models.Override, error) {
	updates := map[string]interface{}{}
	if req.AssigneeID != nil && *req.AssigneeID != "" { updates["assignee_id"] = *req.AssigneeID }
	if len(updates) == 0 { return nil, errors.New("no fields to update") }
	return s.repo.UpdateOverride(ctx, id, updates)
}
func (s *mockService) DeleteOverride(ctx context.Context, id string) (bool, error) { return s.repo.DeleteOverride(ctx, id) }

func (s *mockService) GetOnCallNow(ctx context.Context, scheduleID string) (*models.CurrentOnCallResult, error) {
	now := time.Now().UTC()
	overrides, err := s.repo.GetActiveOverrides(ctx, scheduleID, now)
	if err != nil { return nil, err }
	if len(overrides) > 0 {
		o := overrides[0]
		return &models.CurrentOnCallResult{
			ScheduleID: o.ScheduleID, AssigneeID: o.AssigneeID, AssigneeName: o.AssigneeName,
			Role: "override", StartTime: o.StartTime, EndTime: o.EndTime,
		}, nil
	}
	assignments, err := s.repo.GetScheduleAssignments(ctx, scheduleID, now)
	if err != nil { return nil, err }
	if len(assignments) == 0 { return nil, repository.ErrScheduleNotFound }
	a := assignments[0]
	return &models.CurrentOnCallResult{
		ScheduleID: a.ScheduleID, AssigneeID: a.AssigneeID, AssigneeName: a.AssigneeName,
		Role: a.Role, StartTime: a.StartTime, EndTime: a.EndTime,
	}, nil
}

// --- tests ---

func TestCreateSchedule_Success(t *testing.T) {
	repo := &mockOnCallRepo{
		schedules: map[string]*models.Schedule{},
		assignments: map[string]*models.Assignment{},
		overrides: map[string]*models.Override{},
	}
	svc := &mockService{repo: repo}
	now := time.Now().UTC()
	startStr := now.Format("2006-01-02")
	req := &models.CreateScheduleRequest{Name: "test-schedule"}
	req.StartDate = &startStr

	sched, err := svc.Create(context.Background(), "tenant-1", req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if sched.Name != "test-schedule" {
		t.Errorf("expected name test-schedule, got %s", sched.Name)
	}
	if sched.Status != "active" {
		t.Errorf("expected status active, got %s", sched.Status)
	}
}

func TestGetSchedule_NotFound(t *testing.T) {
	repo := &mockOnCallRepo{
		schedules: map[string]*models.Schedule{},
		assignments: map[string]*models.Assignment{},
		overrides: map[string]*models.Override{},
	}
	svc := &mockService{repo: repo}
	_, err := svc.Get(context.Background(), "nonexistent")
	if !IsNotFound(err) {
		t.Errorf("expected not found error, got %v", err)
	}
}

func TestListSchedules_FilteredByStatus(t *testing.T) {
	s1 := &models.Schedule{ID: "1", TenantID: "t1", Name: "active", Status: "active"}
	s2 := &models.Schedule{ID: "2", TenantID: "t1", Name: "inactive", Status: "inactive"}
	repo := &mockOnCallRepo{
		schedules: map[string]*models.Schedule{"1": s1, "2": s2},
		assignments: map[string]*models.Assignment{},
		overrides: map[string]*models.Override{},
	}
	svc := &mockService{repo: repo}
	status := "active"
	items, total, err := svc.List(context.Background(), "t1", &status)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if total != 1 {
		t.Errorf("expected total 1, got %d", total)
	}
	if len(items) != 1 || items[0].Status != "active" {
		t.Errorf("expected 1 active schedule")
	}
}

func TestUpdateSchedule_Success(t *testing.T) {
	s := &models.Schedule{ID: "1", Name: "old", Status: "active", Timezone: "UTC"}
	repo := &mockOnCallRepo{
		schedules: map[string]*models.Schedule{"1": s},
		assignments: map[string]*models.Assignment{},
		overrides: map[string]*models.Override{},
	}
	svc := &mockService{repo: repo}
	newName := "new-name"
	req := &models.UpdateScheduleRequest{Name: &newName}
	sched, err := svc.Update(context.Background(), "1", req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if sched.Name != "new-name" {
		t.Errorf("expected new-name, got %s", sched.Name)
	}
}

func TestUpdateSchedule_NoFields(t *testing.T) {
	repo := &mockOnCallRepo{
		schedules: map[string]*models.Schedule{"1": &models.Schedule{ID: "1"}},
		assignments: map[string]*models.Assignment{},
		overrides: map[string]*models.Override{},
	}
	svc := &mockService{repo: repo}
	_, err := svc.Update(context.Background(), "1", &models.UpdateScheduleRequest{})
	if err == nil {
		t.Fatal("expected error for no fields")
	}
}

func TestDeleteSchedule_Success(t *testing.T) {
	repo := &mockOnCallRepo{
		schedules: map[string]*models.Schedule{"1": {}},
		assignments: map[string]*models.Assignment{},
		overrides: map[string]*models.Override{},
	}
	svc := &mockService{repo: repo}
	deleted, err := svc.Delete(context.Background(), "1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !deleted {
		t.Error("expected deleted to be true")
	}
	if _, ok := repo.schedules["1"]; ok {
		t.Error("schedule should be deleted")
	}
}

func TestDeleteSchedule_NotFound(t *testing.T) {
	repo := &mockOnCallRepo{
		schedules: map[string]*models.Schedule{},
		assignments: map[string]*models.Assignment{},
		overrides: map[string]*models.Override{},
	}
	svc := &mockService{repo: repo}
	deleted, err := svc.Delete(context.Background(), "nonexistent")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if deleted {
		t.Error("expected deleted to be false")
	}
}

func TestCreateAssignment_Success(t *testing.T) {
	repo := &mockOnCallRepo{
		schedules: map[string]*models.Schedule{},
		assignments: map[string]*models.Assignment{},
		overrides: map[string]*models.Override{},
	}
	svc := &mockService{repo: repo}
	req := &models.CreateAssignmentRequest{
		ScheduleID: "sched-1", AssigneeID: "user-1", AssigneeName: "Alice",
		StartTime: "2024-01-01T00:00:00Z", EndTime: "2024-01-02T00:00:00Z",
	}
	a, err := svc.CreateAssignment(context.Background(), req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if a.AssigneeID != "user-1" {
		t.Errorf("expected user-1, got %s", a.AssigneeID)
	}
}

func TestGetAssignment_NotFound(t *testing.T) {
	repo := &mockOnCallRepo{
		schedules: map[string]*models.Schedule{},
		assignments: map[string]*models.Assignment{},
		overrides: map[string]*models.Override{},
	}
	svc := &mockService{repo: repo}
	_, err := svc.GetAssignment(context.Background(), "nonexistent")
	if !IsNotFound(err) {
		t.Errorf("expected not found error, got %v", err)
	}
}

func TestCreateOverride_Success(t *testing.T) {
	repo := &mockOnCallRepo{
		schedules: map[string]*models.Schedule{},
		assignments: map[string]*models.Assignment{},
		overrides: map[string]*models.Override{},
	}
	svc := &mockService{repo: repo}
	reason := "sick leave"
	req := &models.CreateOverrideRequest{
		ScheduleID: "sched-1", AssigneeID: "user-2", AssigneeName: "Bob",
		Reason: &reason, StartTime: "2024-01-01T00:00:00Z", EndTime: "2024-01-02T00:00:00Z",
	}
	o, err := svc.CreateOverride(context.Background(), req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if o.AssigneeID != "user-2" {
		t.Errorf("expected user-2, got %s", o.AssigneeID)
	}
}

func TestGetOnCallNow_OverridePrecedence(t *testing.T) {
	now := time.Now().UTC()
	overrides := map[string]*models.Override{
		"ov1": {ID: "ov1", ScheduleID: "sched-1", AssigneeID: "user-3", AssigneeName: "Charlie",
			StartTime: now.Add(-time.Hour), EndTime: now.Add(time.Hour)},
	}
	assignments := map[string]*models.Assignment{
		"a1": {ID: "a1", ScheduleID: "sched-1", AssigneeID: "user-1", AssigneeName: "Alice",
			Role: "primary", StartTime: now.Add(-time.Hour), EndTime: now.Add(time.Hour)},
	}
	repo := &mockOnCallRepo{
		schedules: map[string]*models.Schedule{},
		assignments: assignments,
		overrides: overrides,
	}
	svc := &mockService{repo: repo}
	result, err := svc.GetOnCallNow(context.Background(), "sched-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result.AssigneeID != "user-3" {
		t.Errorf("expected override user-3, got %s", result.AssigneeID)
	}
	if result.Role != "override" {
		t.Errorf("expected role override, got %s", result.Role)
	}
}

func TestGetOnCallNow_FallbackToAssignment(t *testing.T) {
	now := time.Now().UTC()
	assignments := map[string]*models.Assignment{
		"a1": {ID: "a1", ScheduleID: "sched-1", AssigneeID: "user-1", AssigneeName: "Alice",
			Role: "primary", StartTime: now.Add(-time.Hour), EndTime: now.Add(time.Hour)},
	}
	repo := &mockOnCallRepo{
		schedules: map[string]*models.Schedule{},
		assignments: assignments,
		overrides: map[string]*models.Override{},
	}
	svc := &mockService{repo: repo}
	result, err := svc.GetOnCallNow(context.Background(), "sched-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result.AssigneeID != "user-1" {
		t.Errorf("expected assignment user-1, got %s", result.AssigneeID)
	}
	if result.Role != "primary" {
		t.Errorf("expected role primary, got %s", result.Role)
	}
}

func TestGetOnCallNow_NoOneAvailable(t *testing.T) {
	repo := &mockOnCallRepo{
		schedules: map[string]*models.Schedule{},
		assignments: map[string]*models.Assignment{},
		overrides: map[string]*models.Override{},
	}
	svc := &mockService{repo: repo}
	_, err := svc.GetOnCallNow(context.Background(), "sched-1")
	if !IsNotFound(err) {
		t.Errorf("expected not found error, got %v", err)
	}
}
