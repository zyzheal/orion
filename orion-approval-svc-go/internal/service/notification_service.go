package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"orion/approval-svc-go/internal/models"
)

// NotificationService sends notifications for approval events.
type NotificationService struct {
	// In production, this would hold webhook/email/Slack clients
}

func NewNotificationService() *NotificationService {
	return &NotificationService{}
}

// NotifyApprovalCreated sends a notification when an approval is created.
func (s *NotificationService) NotifyApprovalCreated(ctx context.Context, approval *models.Approval, steps []models.ApprovalStep) error {
	log.Printf("[notification] approval created: id=%s resource=%s/%s title=%s steps=%d",
		approval.ID, approval.ResourceType, approval.ResourceID,
		deref(approval.Title), len(steps))

	// Notify each approver with a pending step
	for _, step := range steps {
		if step.Status == models.StepPending && step.ApproverID != nil {
			log.Printf("[notification] -> approver %s: you have a pending approval for %s",
				*step.ApproverID, deref(approval.Title))
		}
	}
	return nil
}

// NotifyApprovalApproved sends a notification when an approval is fully approved.
func (s *NotificationService) NotifyApprovalApproved(ctx context.Context, approval *models.Approval) error {
	log.Printf("[notification] approval approved: id=%s resource=%s/%s",
		approval.ID, approval.ResourceType, approval.ResourceID)
	return nil
}

// NotifyApprovalRejected sends a notification when an approval is rejected.
func (s *NotificationService) NotifyApprovalRejected(ctx context.Context, approval *models.Approval, rejectedBy string, comment string) error {
	log.Printf("[notification] approval rejected: id=%s by=%s comment=%s",
		approval.ID, rejectedBy, comment)
	return nil
}

// NotifyStepApproved sends a notification when a single step is approved.
func (s *NotificationService) NotifyStepApproved(ctx context.Context, approval *models.Approval, step *models.ApprovalStep) error {
	log.Printf("[notification] step approved: approval=%s step=%d approver=%s",
		approval.ID, step.StepIndex, deref(step.ApproverID))
	return nil
}

// ==================== Reporting ====================

// ApprovalReport provides aggregate reporting data.
type ApprovalReport struct {
	TenantID       string             `json:"tenant_id"`
	GeneratedAt    time.Time          `json:"generated_at"`
	TotalApprovals int                `json:"total_approvals"`
	Pending        int                `json:"pending"`
	Approved       int                `json:"approved"`
	Rejected       int                `json:"rejected"`
	Canceled       int                `json:"canceled"`
	AvgApprovalTimeMs int64           `json:"avg_approval_time_ms"`
	TopApprovers   []ApproverStat     `json:"top_approvers"`
	ResourceBreakdown []ResourceStat  `json:"resource_breakdown"`
}

type ApproverStat struct {
	ApproverID    string `json:"approver_id"`
	ApprovedCount int    `json:"approved_count"`
	RejectedCount int    `json:"rejected_count"`
}

type ResourceStat struct {
	ResourceType string `json:"resource_type"`
	Count        int    `json:"count"`
}

// ReportingService generates approval reports.
type ReportingService struct {
	repo interface {
		GetStats(ctx context.Context, tenantID string) (*models.ApprovalStats, error)
	}
}

func NewReportingService(statsGetter interface {
	GetStats(ctx context.Context, tenantID string) (*models.ApprovalStats, error)
}) *ReportingService {
	return &ReportingService{repo: statsGetter}
}

func (s *ReportingService) GenerateReport(ctx context.Context, tenantID string) (*ApprovalReport, error) {
	stats, err := s.repo.GetStats(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("get stats: %w", err)
	}

	return &ApprovalReport{
		TenantID:       tenantID,
		GeneratedAt:    time.Now().UTC(),
		TotalApprovals: stats.Total,
		Pending:        stats.Pending,
		Approved:       stats.Approved,
		Rejected:       stats.Rejected,
		Canceled:       stats.Canceled,
	}, nil
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
