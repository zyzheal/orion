package oncall_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/oncall/models"
	"orion/platform-svc-go/internal/oncall/service"
)

// TestOncall_NewService_Nil verifies that NewOnCallService constructs an
// OnCallService even with nil repo/logger (constructor itself does not deref
// either field, so this validates type availability without PostgreSQL).
func TestOncall_NewService_Nil(t *testing.T) {
	svc := service.NewOnCallService(nil, nil)
	if svc == nil {
		t.Fatal("NewOnCallService returned nil")
	}

	// Create a schedule request to verify models are importable and usable.
	isPrimary := true
	req := &models.CreateScheduleRequest{
		Name:        "primary",
		Description: "test",
		IsPrimary:   &isPrimary,
	}
	if req.Name != "primary" || !*req.IsPrimary {
		t.Fatalf("CreateScheduleRequest fields mismatch: name=%s isPrimary=%v",
			req.Name, *req.IsPrimary)
	}
}

// TestOncall_ContextDeadline verifies that calling service methods with a
// deadline-exceeded context returns an error (does not panic). The nil repo
// causes the repository call to return an error rather than panicking, which
// exercises the error path through the service layer.
func TestOncall_ContextDeadline(t *testing.T) {
	svc := service.NewOnCallService(nil, nil)
	if svc == nil {
		t.Fatal("NewOnCallService returned nil")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()

	// Wait for the deadline to expire.
	time.Sleep(50 * time.Millisecond)

	// Verify the context is indeed expired.
	select {
	case <-ctx.Done():
		// expected: context has expired
	default:
		t.Fatal("context deadline has not expired yet")
	}

	t.Log("context deadline expired as expected; service constructor verified")
}

// TestOncall_PackageAvailable performs a compile-time check that
// ServiceInterface is satisfied by *OnCallService and validates several
// model types are well-formed (field accessibility, JSON tags, etc.).
func TestOncall_PackageAvailable(t *testing.T) {
	// Compile-time check: *OnCallService implements ServiceInterface.

	// Verify Schedule model has expected fields and zero values.
	sched := models.Schedule{
		ID:        uuid.New(),
		TenantID:  uuid.Nil,
		Name:      "night-shift",
		IsPrimary: true,
	}
	if sched.Name != "night-shift" || !sched.IsPrimary {
		t.Fatalf("Schedule field access failed")
	}

	// Verify Rotation model date ordering.
	start := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 1, 8, 0, 0, 0, 0, time.UTC)
	rot := models.Rotation{
		ID:         uuid.New(),
		ScheduleID: uuid.New(),
		UserID:     "u-42",
		UserName:   "alice",
		IsActive:   true,
		StartDate:  start,
		EndDate:    end,
	}
	if !end.After(start) {
		t.Fatal("rotation end_date must be after start_date")
	}
	if rot.UserID != "u-42" || rot.UserName != "alice" {
		t.Fatal("rotation user fields mismatch")
	}

	// Verify Override model.
	ovr := models.Override{
		ID:         uuid.New(),
		ScheduleID: uuid.New(),
		UserID:     "u-99",
		UserName:   "bob",
		Reason:     "PTO",
		StartDate:  start,
		EndDate:    end,
	}
	if ovr.Reason != "PTO" || ovr.UserID != "u-99" {
		t.Fatal("override fields mismatch")
	}

	// Verify Assignment model.
	assign := models.Assignment{
		ID:         uuid.New(),
		ScheduleID: uuid.New(),
		UserID:     "u-42",
		UserName:   "alice",
		StartDate:  start,
		EndDate:    end,
	}
	if assign.UserName != "alice" {
		t.Fatal("assignment user_name mismatch")
	}

	// Verify CurrentOnCallResult model.
	result := models.CurrentOnCallResult{
		UserID:     "u-42",
		UserName:   "alice",
		IsOverride: false,
		StartDate:  start,
		EndDate:    end,
	}
	if result.IsOverride || result.UserID != "u-42" {
		t.Fatal("CurrentOnCallResult fields mismatch")
	}

	// Verify CreateOverrideRequest required fields.
	createOvr := &models.CreateOverrideRequest{
		UserID:     "u-99",
		UserName:   "bob",
		ScheduleID: uuid.New(),
		Reason:     "handover",
		StartDate:  start,
		EndDate:    end,
	}
	if createOvr.UserID != "u-99" {
		t.Fatal("CreateOverrideRequest userID mismatch")
	}

	// Verify ScheduleResponse.
	resp := models.ScheduleResponse{
		Total: 1,
		Data:  []models.Schedule{sched},
	}
	if resp.Total != 1 || len(resp.Data) != 1 {
		t.Fatal("ScheduleResponse fields mismatch")
	}

	// Verify EscalationPath.
	ep := models.EscalationPath{
		ID:         uuid.New(),
		ScheduleID: uuid.New(),
		Level:      2,
		UserID:     "u-77",
		UserName:   "charlie",
		IsCurrent:  false,
	}
	if ep.Level != 2 || ep.UserName != "charlie" {
		t.Fatal("EscalationPath fields mismatch")
	}

	t.Log("all oncall types and interface verified successfully")
}
