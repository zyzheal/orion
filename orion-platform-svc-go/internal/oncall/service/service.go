package service

import (
	"context"
	"errors"
	"time"

	"orion/platform-svc-go/internal/oncall/models"
	"orion/platform-svc-go/internal/oncall/repository"
)

type Service struct {
	repo OnCallRepo
}

func NewService(repo OnCallRepo) *Service {
	return &Service{repo: repo}
}

// --- Schedule CRUD ---

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateScheduleRequest) (*models.Schedule, error) {
	schedule := &models.Schedule{
		TenantID:    tenantID,
		Name:        req.Name,
		Timezone:    "UTC",
		RotationType: "daily",
		Status:      "active",
	}
	if req.Timezone != "" {
		schedule.Timezone = req.Timezone
	}
	if req.RotationType != "" {
		schedule.RotationType = req.RotationType
	}
	if req.Status != "" {
		schedule.Status = req.Status
	}
	if req.StartDate != nil && *req.StartDate != "" {
		t, err := time.Parse("2006-01-02", *req.StartDate)
		if err == nil {
			schedule.StartDate = &t
		}
	}
	if req.EndDate != nil && *req.EndDate != "" {
		t, err := time.Parse("2006-01-02", *req.EndDate)
		if err == nil {
			schedule.EndDate = &t
		}
	}
	if err := s.repo.CreateSchedule(ctx, schedule); err != nil {
		return nil, err
	}
	return schedule, nil
}

func (s *Service) Get(ctx context.Context, id string) (*models.Schedule, error) {
	return s.repo.GetSchedule(ctx, id)
}

func (s *Service) List(ctx context.Context, tenantID string, status *string) ([]models.Schedule, int, error) {
	return s.repo.ListSchedules(ctx, tenantID, status)
}

func (s *Service) Update(ctx context.Context, id string, req *models.UpdateScheduleRequest) (*models.Schedule, error) {
	updates := map[string]interface{}{}
	if req.Name != nil && *req.Name != "" {
		updates["name"] = *req.Name
	}
	if req.Timezone != nil && *req.Timezone != "" {
		updates["timezone"] = *req.Timezone
	}
	if req.RotationType != nil && *req.RotationType != "" {
		updates["rotation_type"] = *req.RotationType
	}
	if req.Status != nil && *req.Status != "" {
		updates["status"] = *req.Status
	}
	if req.StartDate != nil && *req.StartDate != "" {
		t, err := time.Parse("2006-01-02", *req.StartDate)
		if err == nil {
			updates["start_date"] = t
		}
	}
	if req.EndDate != nil && *req.EndDate != "" {
		t, err := time.Parse("2006-01-02", *req.EndDate)
		if err == nil {
			updates["end_date"] = t
		}
	}
	if len(updates) == 0 {
		return nil, errors.New("no fields to update")
	}
	return s.repo.UpdateSchedule(ctx, id, updates)
}

func (s *Service) Delete(ctx context.Context, id string) (bool, error) {
	return s.repo.DeleteSchedule(ctx, id)
}

// --- Assignment CRUD ---

func (s *Service) CreateAssignment(ctx context.Context, req *models.CreateAssignmentRequest) (*models.Assignment, error) {
	startTime, err := time.Parse("2006-01-02T15:04:05Z", req.StartTime)
	if err != nil {
		return nil, err
	}
	endTime, err := time.Parse("2006-01-02T15:04:05Z", req.EndTime)
	if err != nil {
		return nil, err
	}
	assignment := &models.Assignment{
		ScheduleID:   req.ScheduleID,
		AssigneeID:   req.AssigneeID,
		AssigneeName: req.AssigneeName,
		Role:         "primary",
		StartTime:    startTime,
		EndTime:      endTime,
	}
	if req.Role != "" {
		assignment.Role = req.Role
	}
	if err := s.repo.CreateAssignment(ctx, assignment); err != nil {
		return nil, err
	}
	return assignment, nil
}

func (s *Service) GetAssignment(ctx context.Context, id string) (*models.Assignment, error) {
	return s.repo.GetAssignment(ctx, id)
}

func (s *Service) ListAssignments(ctx context.Context, scheduleID *string) ([]models.Assignment, int, error) {
	return s.repo.ListAssignments(ctx, scheduleID)
}

func (s *Service) UpdateAssignment(ctx context.Context, id string, req *models.UpdateAssignmentRequest) (*models.Assignment, error) {
	updates := map[string]interface{}{}
	if req.AssigneeID != nil && *req.AssigneeID != "" {
		updates["assignee_id"] = *req.AssigneeID
	}
	if req.AssigneeName != nil && *req.AssigneeName != "" {
		updates["assignee_name"] = *req.AssigneeName
	}
	if req.Role != nil && *req.Role != "" {
		updates["role"] = *req.Role
	}
	if req.StartTime != nil && *req.StartTime != "" {
		t, err := time.Parse("2006-01-02T15:04:05Z", *req.StartTime)
		if err == nil {
			updates["start_time"] = t
		}
	}
	if req.EndTime != nil && *req.EndTime != "" {
		t, err := time.Parse("2006-01-02T15:04:05Z", *req.EndTime)
		if err == nil {
			updates["end_time"] = t
		}
	}
	if len(updates) == 0 {
		return nil, errors.New("no fields to update")
	}
	return s.repo.UpdateAssignment(ctx, id, updates)
}

func (s *Service) DeleteAssignment(ctx context.Context, id string) (bool, error) {
	return s.repo.DeleteAssignment(ctx, id)
}

// --- Override CRUD ---

func (s *Service) CreateOverride(ctx context.Context, req *models.CreateOverrideRequest) (*models.Override, error) {
	startTime, err := time.Parse("2006-01-02T15:04:05Z", req.StartTime)
	if err != nil {
		return nil, err
	}
	endTime, err := time.Parse("2006-01-02T15:04:05Z", req.EndTime)
	if err != nil {
		return nil, err
	}
	override := &models.Override{
		ScheduleID:   req.ScheduleID,
		AssigneeID:   req.AssigneeID,
		AssigneeName: req.AssigneeName,
		Reason:       req.Reason,
		StartTime:    startTime,
		EndTime:      endTime,
	}
	if err := s.repo.CreateOverride(ctx, override); err != nil {
		return nil, err
	}
	return override, nil
}

func (s *Service) GetOverride(ctx context.Context, id string) (*models.Override, error) {
	return s.repo.GetOverride(ctx, id)
}

func (s *Service) ListOverrides(ctx context.Context, scheduleID *string) ([]models.Override, int, error) {
	return s.repo.ListOverrides(ctx, scheduleID)
}

func (s *Service) UpdateOverride(ctx context.Context, id string, req *models.UpdateOverrideRequest) (*models.Override, error) {
	updates := map[string]interface{}{}
	if req.AssigneeID != nil && *req.AssigneeID != "" {
		updates["assignee_id"] = *req.AssigneeID
	}
	if req.AssigneeName != nil && *req.AssigneeName != "" {
		updates["assignee_name"] = *req.AssigneeName
	}
	if req.Reason != nil {
		updates["reason"] = req.Reason
	}
	if req.StartTime != nil && *req.StartTime != "" {
		t, err := time.Parse("2006-01-02T15:04:05Z", *req.StartTime)
		if err == nil {
			updates["start_time"] = t
		}
	}
	if req.EndTime != nil && *req.EndTime != "" {
		t, err := time.Parse("2006-01-02T15:04:05Z", *req.EndTime)
		if err == nil {
			updates["end_time"] = t
		}
	}
	if len(updates) == 0 {
		return nil, errors.New("no fields to update")
	}
	return s.repo.UpdateOverride(ctx, id, updates)
}

func (s *Service) DeleteOverride(ctx context.Context, id string) (bool, error) {
	return s.repo.DeleteOverride(ctx, id)
}

// --- On-Call Now ---

func (s *Service) GetOnCallNow(ctx context.Context, scheduleID string) (*models.CurrentOnCallResult, error) {
	now := time.Now().UTC()

	// Check overrides first (they take precedence)
	overrides, err := s.repo.GetActiveOverrides(ctx, scheduleID, now)
	if err != nil {
		return nil, err
	}
	if len(overrides) > 0 {
		o := overrides[0]
		return &models.CurrentOnCallResult{
			ScheduleID:  o.ScheduleID,
			AssigneeID:  o.AssigneeID,
			AssigneeName: o.AssigneeName,
			Role:        "override",
			StartTime:   o.StartTime,
			EndTime:     o.EndTime,
		}, nil
	}

	// Fall back to regular assignments
	assignments, err := s.repo.GetScheduleAssignments(ctx, scheduleID, now)
	if err != nil {
		return nil, err
	}
	if len(assignments) == 0 {
		return nil, repository.ErrScheduleNotFound
	}

	a := assignments[0]
	return &models.CurrentOnCallResult{
		ScheduleID:  a.ScheduleID,
		AssigneeID:  a.AssigneeID,
		AssigneeName: a.AssigneeName,
		Role:        a.Role,
		StartTime:   a.StartTime,
		EndTime:     a.EndTime,
	}, nil
}

// --- Errors ---

func IsNotFound(err error) bool {
	return repository.IsNotFound(err)
}
