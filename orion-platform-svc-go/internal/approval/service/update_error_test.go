package service

import (
	"context"
	"errors"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/approval/models"
)

var (
	ctxTest = context.Background()
	errBoom = errors.New("write failed")
)

// fakeUpdateRepo drives the real Service. The embedded interface keeps the
// unused methods compiling.
type fakeUpdateRepo struct {
	RepositoryInterface

	existingStatus string
	totalLevels    int
	updateErr      error
	updates        map[string]interface{}
}

func (f *fakeUpdateRepo) GetApprovalRequest(ctx context.Context, tenantID, id string) (*models.ApprovalRequest, error) {
	st := f.existingStatus
	if st == "" {
		st = "pending"
	}
	req := &models.ApprovalRequest{
		ID: id, TenantID: tenantID, Status: st,
		ReqByID: "u-1", CurrentLevel: 1, TotalLevels: 2,
	}
	if f.totalLevels != 0 {
		req.TotalLevels = f.totalLevels
	}
	return req, nil
}

func (f *fakeUpdateRepo) UpdateApprovalRequest(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	f.updates = updates
	return f.updateErr
}

func (f *fakeUpdateRepo) CreateApprovalHistory(ctx context.Context, m *models.ApprovalHistory) error {
	return nil
}

// Every workflow transition used to discard the UpdateApprovalRequest error
// with "_ =", so all six of them answered success while approval_requests kept
// status='pending' forever.
func TestTransitionWriteErrorsPropagate(t *testing.T) {
	for _, tt := range []struct {
		name    string
		call    func(s *Service) error
		wantMsg string
		wantSet map[string]interface{}
	}{
		{
			name: "review approve",
			call: func(s *Service) error {
				return s.ReviewApproval(ctxTest, "t-1", "a-1", "u-9", "approver", models.ReviewApprovalRequest{Decision: "approve"})
			},
			wantMsg: "record decision",
			wantSet: map[string]interface{}{"status": "approved"},
		},
		{
			name: "review reject",
			call: func(s *Service) error {
				return s.ReviewApproval(ctxTest, "t-1", "a-1", "u-9", "approver", models.ReviewApprovalRequest{Decision: "reject"})
			},
			wantMsg: "record decision",
			wantSet: map[string]interface{}{"status": "rejected"},
		},
		{
			name:    "approve",
			call:    func(s *Service) error { return s.ApproveRequest(ctxTest, "t-1", "a-1", "u-9", "approver", "ok") },
			wantMsg: "record level progression",
			// level 1 of 2: the chain is not finished, so the status stays pending
			wantSet: map[string]interface{}{"current_level": 2, "status": "pending"},
		},
		{
			name:    "reject",
			call:    func(s *Service) error { return s.RejectRequest(ctxTest, "t-1", "a-1", "u-9", "approver", "no") },
			wantMsg: "record rejection",
			wantSet: map[string]interface{}{"status": "rejected"},
		},
		{
			name: "withdraw",
			call: func(s *Service) error {
				return s.WithdrawApproval(ctxTest, "t-1", "a-1", "u-1", "requester", "back off")
			},
			wantMsg: "record withdrawal",
			wantSet: map[string]interface{}{"status": "withdrawn"},
		},
		{
			name:    "cancel",
			call:    func(s *Service) error { return s.CancelApproval(ctxTest, "t-1", "a-1", "u-9", "approver", "obsolete") },
			wantMsg: "record cancellation",
			wantSet: map[string]interface{}{"status": "cancelled"},
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeUpdateRepo{updateErr: errBoom}
			s := NewService(repo)
			err := tt.call(s)
			if err == nil {
				t.Fatal("expected the write error, got nil")
			}
			if !strings.Contains(err.Error(), tt.wantMsg) {
				t.Fatalf("err = %v, want it to mention %q", err, tt.wantMsg)
			}
			if !errors.Is(err, errBoom) {
				t.Fatalf("the underlying error was not wrapped: %v", err)
			}
			if len(repo.updates) == 0 {
				t.Fatal("the update was never issued")
			}
			for k, v := range tt.wantSet {
				if repo.updates[k] != v {
					t.Fatalf("updates[%q] = %v, want %v", k, repo.updates[k], v)
				}
			}
		})
	}
}

func TestTransitionSucceedsWhenTheWriteSucceeds(t *testing.T) {
	repo := &fakeUpdateRepo{totalLevels: 1}
	s := NewService(repo)
	if err := s.ApproveRequest(ctxTest, "t-1", "a-1", "u-9", "approver", "ok"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.updates["status"] != "approved" || repo.updates["current_level"] != 2 {
		t.Fatalf("updates = %v", repo.updates)
	}
}

// Clearing a level that is not the last one leaves the request pending.
func TestApproveRequestKeepsPendingBeforeTheFinalLevel(t *testing.T) {
	repo := &fakeUpdateRepo{totalLevels: 3}
	s := NewService(repo)
	if err := s.ApproveRequest(ctxTest, "t-1", "a-1", "u-9", "approver", "ok"); err != nil {
		t.Fatal(err)
	}
	if repo.updates["current_level"] != 2 || repo.updates["status"] != "pending" {
		t.Fatalf("updates = %v, want current_level 2 status pending", repo.updates)
	}
}

// Clearing the single level of the chain completes it.
func TestApproveRequestCompletesTheChainOnTheFinalLevel(t *testing.T) {
	repo := &fakeUpdateRepo{totalLevels: 1}
	s := NewService(repo)
	if err := s.ApproveRequest(ctxTest, "t-1", "a-1", "u-9", "approver", "ok"); err != nil {
		t.Fatal(err)
	}
	if repo.updates["current_level"] != 2 || repo.updates["status"] != "approved" {
		t.Fatalf("updates = %v, want current_level 2 status approved", repo.updates)
	}
}

// Non-pending requests must not be transitioned at all.
func TestTransitionRejectsNonPendingRequests(t *testing.T) {
	repo := &fakeUpdateRepo{existingStatus: "approved"}
	s := NewService(repo)
	if err := s.ApproveRequest(ctxTest, "t-1", "a-1", "u-9", "approver", "ok"); err == nil {
		t.Fatal("expected an error for a non-pending request")
	}
	if repo.updates != nil {
		t.Fatalf("no update may be issued, got %v", repo.updates)
	}
}

func TestWithdrawRejectsNonRequester(t *testing.T) {
	repo := &fakeUpdateRepo{}
	s := NewService(repo)
	if err := s.WithdrawApproval(ctxTest, "t-1", "a-1", "someone-else", "other", "mine"); err == nil {
		t.Fatal("expected an error when the caller is not the requester")
	}
	if repo.updates != nil {
		t.Fatalf("no update may be issued, got %v", repo.updates)
	}
}

func TestReviewRejectsInvalidDecision(t *testing.T) {
	repo := &fakeUpdateRepo{}
	s := NewService(repo)
	if err := s.ReviewApproval(ctxTest, "t-1", "a-1", "u-9", "a", models.ReviewApprovalRequest{Decision: "maybe"}); err == nil {
		t.Fatal("expected an error for an unknown decision")
	}
	if repo.updates != nil {
		t.Fatalf("no update may be issued, got %v", repo.updates)
	}
}
