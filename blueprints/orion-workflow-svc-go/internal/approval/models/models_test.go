package models

import (
	"testing"
	"time"
)

func TestApproval_Fields(t *testing.T) {
	now := time.Now()
	title := "Deploy to production"
	approval := Approval{
		ID:                "approval-1",
		TenantID:          "tenant-1",
		DefinitionID:      nil,
		ResourceType:      "deployment",
		ResourceID:        "deploy-1",
		Title:             &title,
		Status:            ApprovalPending,
		RequestedBy:       strPtr("user-1"),
		CurrentStep:       0,
		TotalSteps:        2,
		RequiredApprovals: 1,
		Result:            nil,
		CompletedAt:       nil,
		CreatedAt:         now,
	}

	if approval.ID != "approval-1" {
		t.Errorf("expected ID 'approval-1', got '%s'", approval.ID)
	}
	if approval.TenantID != "tenant-1" {
		t.Errorf("expected TenantID 'tenant-1', got '%s'", approval.TenantID)
	}
	if approval.ResourceType != "deployment" {
		t.Errorf("expected ResourceType 'deployment', got '%s'", approval.ResourceType)
	}
	if approval.Status != ApprovalPending {
		t.Errorf("expected Status 'pending', got '%s'", approval.Status)
	}
	if approval.TotalSteps != 2 {
		t.Errorf("expected TotalSteps 2, got %d", approval.TotalSteps)
	}
	if approval.CompletedAt != nil {
		t.Error("expected CompletedAt to be nil")
	}
}

func TestApprovalStep_Fields(t *testing.T) {
	now := time.Now()
	comment := "Looks good"
	step := ApprovalStep{
		ID:         "step-1",
		ApprovalID: "approval-1",
		StepIndex:  0,
		ApproverID: strPtr("user-2"),
		Status:     StepApproved,
		Comment:    &comment,
		ActedAt:    &now,
	}

	if step.ID != "step-1" {
		t.Errorf("expected ID 'step-1', got '%s'", step.ID)
	}
	if step.ApprovalID != "approval-1" {
		t.Errorf("expected ApprovalID 'approval-1', got '%s'", step.ApprovalID)
	}
	if step.StepIndex != 0 {
		t.Errorf("expected StepIndex 0, got %d", step.StepIndex)
	}
	if step.Status != StepApproved {
		t.Errorf("expected Status 'approved', got '%s'", step.Status)
	}
	if *step.Comment != "Looks good" {
		t.Errorf("expected Comment 'Looks good', got '%s'", *step.Comment)
	}
}

func TestApprovalStatus_Constants(t *testing.T) {
	if ApprovalPending != "pending" {
		t.Errorf("expected ApprovalPending = 'pending', got '%s'", ApprovalPending)
	}
	if ApprovalApproved != "approved" {
		t.Errorf("expected ApprovalApproved = 'approved', got '%s'", ApprovalApproved)
	}
	if ApprovalRejected != "rejected" {
		t.Errorf("expected ApprovalRejected = 'rejected', got '%s'", ApprovalRejected)
	}
	if ApprovalCanceled != "canceled" {
		t.Errorf("expected ApprovalCanceled = 'canceled', got '%s'", ApprovalCanceled)
	}
}

func TestStepStatus_Constants(t *testing.T) {
	if StepPending != "pending" {
		t.Errorf("expected StepPending = 'pending', got '%s'", StepPending)
	}
	if StepApproved != "approved" {
		t.Errorf("expected StepApproved = 'approved', got '%s'", StepApproved)
	}
	if StepRejected != "rejected" {
		t.Errorf("expected StepRejected = 'rejected', got '%s'", StepRejected)
	}
	if StepSkipped != "skipped" {
		t.Errorf("expected StepSkipped = 'skipped', got '%s'", StepSkipped)
	}
}

func TestCreateApprovalRequest_Fields(t *testing.T) {
	title := "Deploy to production"
	req := CreateApprovalRequest{
		ResourceType:      "deployment",
		ResourceID:        "deploy-1",
		Title:             &title,
		RequestedBy:       strPtr("user-1"),
		TotalSteps:        2,
		RequiredApprovals: 1,
	}

	if req.ResourceType != "deployment" {
		t.Errorf("expected ResourceType 'deployment', got '%s'", req.ResourceType)
	}
	if req.ResourceID != "deploy-1" {
		t.Errorf("expected ResourceID 'deploy-1', got '%s'", req.ResourceID)
	}
	if *req.Title != "Deploy to production" {
		t.Errorf("expected Title 'Deploy to production', got '%s'", *req.Title)
	}
	if req.TotalSteps != 2 {
		t.Errorf("expected TotalSteps 2, got %d", req.TotalSteps)
	}
}

func TestPaginatedRequest_Defaults(t *testing.T) {
	p := PaginatedRequest{}

	offset := p.Offset()
	if offset != 0 {
		t.Errorf("expected offset 0, got %d", offset)
	}

	limit := p.Limit()
	if limit != 20 {
		t.Errorf("expected limit 20, got %d", limit)
	}
}

func TestPaginatedRequest_Values(t *testing.T) {
	p := PaginatedRequest{Page: 2, PageSize: 50}

	offset := p.Offset()
	if offset != 50 {
		t.Errorf("expected offset 50, got %d", offset)
	}

	limit := p.Limit()
	if limit != 50 {
		t.Errorf("expected limit 50, got %d", limit)
	}
}

func strPtr(s string) *string {
	return &s
}
