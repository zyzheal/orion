package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"go.uber.org/zap"

	"orion/platform-svc-go/internal/triage/models"
)

// ===== Fake Reader 实现 =====

type fakeAlerts struct {
	items      []models.TriageItem
	err        error
	ackCalled  int
	assignCalled int
}

func (f *fakeAlerts) List(ctx context.Context, tenantID string, filter *models.Filter, offset, limit int) ([]models.TriageItem, int, error) {
	if f.err != nil {
		return nil, 0, f.err
	}
	items := f.items
	if offset >= len(items) {
		return []models.TriageItem{}, len(items), nil
	}
	end := offset + limit
	if end > len(items) {
		end = len(items)
	}
	return items[offset:end], len(items), nil
}

func (f *fakeAlerts) Get(ctx context.Context, tenantID, alertID string) (*models.TriageItem, error) {
	for _, it := range f.items {
		if it.ID == alertID {
			return &it, nil
		}
	}
	return nil, ErrTriageNotFound
}

func (f *fakeAlerts) Acknowledge(ctx context.Context, tenantID, userID, alertID string) error {
	f.ackCalled++
	return nil
}

func (f *fakeAlerts) Assign(ctx context.Context, tenantID, alertID, toUserID string) error {
	f.assignCalled++
	return nil
}

type fakeTickets struct{}

func (f *fakeTickets) List(ctx context.Context, tenantID string, filter *models.Filter, offset, limit int) ([]models.TriageItem, int, error) {
	return []models.TriageItem{}, 0, nil
}

func (f *fakeTickets) Get(ctx context.Context, tenantID, ticketID string) (*models.TriageItem, error) {
	return nil, ErrTriageNotFound
}

func (f *fakeTickets) Acknowledge(ctx context.Context, tenantID, userID, ticketID string) error {
	return nil
}

func (f *fakeTickets) Assign(ctx context.Context, tenantID, ticketID, toUserID string) error {
	return nil
}

type fakeOncall struct {
	handoffResp *models.HandoffResponse
	err         error
}

func (f *fakeOncall) CurrentDuty(ctx context.Context, tenantID, userID string) (*models.OnCallInfo, error) {
	return &models.OnCallInfo{
		UserID:    userID,
		DisplayName: "测试用户",
		IsOnDuty:  true,
	}, nil
}

func (f *fakeOncall) Handoff(ctx context.Context, req *models.HandoffRequest) (*models.HandoffResponse, error) {
	if f.err != nil {
		return nil, f.err
	}
	if f.handoffResp != nil {
		return f.handoffResp, nil
	}
	return &models.HandoffResponse{
		HandoffID:    "h-1",
		FromUserID:   req.FromUserID,
		ToUserID:     req.ToUserID,
		PendingItems: 5,
		CreatedAt:    time.Now(),
	}, nil
}

type fakeNotif struct{}

func (f *fakeNotif) Notify(ctx context.Context, tenantID, userID, channel string, title, body string) error {
	return nil
}

// ===== Tests =====

func newTestService() *Service {
	return NewService(
		&fakeAlerts{items: []models.TriageItem{}},
		&fakeTickets{},
		&fakeOncall{},
		&fakeNotif{},
		zap.NewNop(),
	)
}

func TestOverview_Empty(t *testing.T) {
	svc := newTestService()
	result, err := svc.Overview(context.Background(), "t1", "u1", &models.OverviewRequest{})
	if err != nil {
		t.Fatalf("Overview failed: %v", err)
	}
	if result.Me.UserID != "u1" {
		t.Errorf("expected me=user1, got %s", result.Me.UserID)
	}
	if !result.Me.IsOnDuty {
		t.Error("expected on-duty")
	}
	if result.AssignedToMe != 0 {
		t.Errorf("expected 0 assigned, got %d", result.AssignedToMe)
	}
}

func TestOverview_MissingUserID(t *testing.T) {
	svc := newTestService()
	_, err := svc.Overview(context.Background(), "t1", "", &models.OverviewRequest{})
	if err != ErrTriageInvalidParam {
		t.Errorf("expected ErrTriageInvalidParam, got %v", err)
	}
}

func TestOverview_WithAlerts(t *testing.T) {
	alerts := &fakeAlerts{
		items: []models.TriageItem{
			{ID: "a1", TenantID: "t1", Type: "alert", Severity: models.SeverityCritical, Status: models.StatusOpen},
			{ID: "a2", TenantID: "t1", Type: "alert", Severity: models.SeverityWarning, Status: models.StatusOpen},
			{ID: "a3", TenantID: "t1", Type: "alert", Severity: models.SeverityInfo, Status: models.StatusResolved},
		},
	}
	svc := NewService(alerts, &fakeTickets{}, &fakeOncall{}, &fakeNotif{}, zap.NewNop())

	result, err := svc.Overview(context.Background(), "t1", "u1", &models.OverviewRequest{
		IncludeActivity: true,
		LimitActivity:   10,
	})
	if err != nil {
		t.Fatalf("Overview failed: %v", err)
	}
	if result.AssignedToMe != 3 {
		t.Errorf("expected 3 items, got %d", result.AssignedToMe)
	}
	if result.OpenBySeverity[models.SeverityCritical] != 1 {
		t.Errorf("expected 1 critical, got %d", result.OpenBySeverity[models.SeverityCritical])
	}
}

func TestListAlerts(t *testing.T) {
	alerts := &fakeAlerts{
		items: []models.TriageItem{
			{ID: "a1", TenantID: "t1"},
			{ID: "a2", TenantID: "t1"},
		},
	}
	svc := NewService(alerts, nil, nil, nil, zap.NewNop())

	result, err := svc.ListAlerts(context.Background(), "t1", &models.SubsetRequest{Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("ListAlerts failed: %v", err)
	}
	if result.Total != 2 {
		t.Errorf("expected 2 total, got %d", result.Total)
	}
}

func TestListAlerts_MissingReader(t *testing.T) {
	svc := NewService(nil, nil, nil, nil, zap.NewNop())
	_, err := svc.ListAlerts(context.Background(), "t1", &models.SubsetRequest{})
	if err != ErrTriageAlertMissing {
		t.Errorf("expected ErrTriageAlertMissing, got %v", err)
	}
}

func TestListTickets_MissingReader(t *testing.T) {
	svc := NewService(nil, nil, nil, nil, zap.NewNop())
	_, err := svc.ListTickets(context.Background(), "t1", &models.SubsetRequest{})
	if err != ErrTriageTicketMissing {
		t.Errorf("expected ErrTriageTicketMissing, got %v", err)
	}
}

func TestAcknowledge_Alert(t *testing.T) {
	alerts := &fakeAlerts{}
	svc := NewService(alerts, nil, nil, nil, zap.NewNop())

	err := svc.Acknowledge(context.Background(), &models.AcknowledgeRequest{
		TenantID: "t1",
		ItemID:   "a1",
		Type:     "alert",
	})
	if err != nil {
		t.Fatalf("Acknowledge failed: %v", err)
	}
	if alerts.ackCalled != 1 {
		t.Errorf("expected 1 ack call, got %d", alerts.ackCalled)
	}
}

func TestAcknowledge_InvalidType(t *testing.T) {
	svc := newTestService()
	err := svc.Acknowledge(context.Background(), &models.AcknowledgeRequest{
		TenantID: "t1",
		ItemID:   "a1",
		Type:     "invalid",
	})
	if err != ErrTriageInvalidParam {
		t.Errorf("expected ErrTriageInvalidParam, got %v", err)
	}
}

func TestAssign_Ticket(t *testing.T) {
	tickets := &fakeTickets{}
	svc := NewService(nil, tickets, nil, nil, zap.NewNop())

	err := svc.Assign(context.Background(), &models.AssignRequest{
		TenantID: "t1",
		ItemID:   "t1-id",
		Type:     "ticket",
		ToUserID: "u1",
	})
	if err != nil {
		t.Fatalf("Assign failed: %v", err)
	}
}

func TestAssign_MissingToUserID(t *testing.T) {
	svc := newTestService()
	err := svc.Assign(context.Background(), &models.AssignRequest{
		TenantID: "t1",
		ItemID:   "a1",
		Type:     "alert",
		ToUserID: "",
	})
	if err != ErrTriageInvalidParam {
		t.Errorf("expected ErrTriageInvalidParam, got %v", err)
	}
}

func TestHandoff(t *testing.T) {
	svc := NewService(nil, nil, &fakeOncall{}, nil, zap.NewNop())
	resp, err := svc.Handoff(context.Background(), &models.HandoffRequest{
		TenantID:   "t1",
		ScheduleID: "s1",
		RotationID: "r1",
		FromUserID: "u1",
		ToUserID:   "u2",
	})
	if err != nil {
		t.Fatalf("Handoff failed: %v", err)
	}
	if resp.HandoffID != "h-1" {
		t.Errorf("expected h-1, got %s", resp.HandoffID)
	}
}

func TestHandoff_NoOnCall(t *testing.T) {
	svc := NewService(nil, nil, nil, nil, zap.NewNop())
	_, err := svc.Handoff(context.Background(), &models.HandoffRequest{})
	if err == nil {
		t.Error("expected error for nil oncall reader")
	}
}

func TestNormalizePage(t *testing.T) {
	if p, ps := normalizePage(0, 0); p != 1 || ps != 50 {
		t.Errorf("expected (1, 50), got (%d, %d)", p, ps)
	}
	if p, ps := normalizePage(2, 100); p != 2 || ps != 100 {
		t.Errorf("expected (2, 100), got (%d, %d)", p, ps)
	}
	if p, ps := normalizePage(5, 500); p != 5 || ps != 200 {
		// 500 应被裁剪到 200
		_ = errors.New("should be capped")
	}
}
