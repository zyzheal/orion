package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/testutil"
)

// TestCheckBreachesMarksOverduePendingRecords pins the two facts that made
// CheckBreaches a no-op, and therefore GET /tickets/sla/breaches a constant
// {"breaches": [], "count": 0}:
//
//   - it read FindBreachedRecords, whose query already filters
//     "WHERE breached = true", so it could only re-stamp rows that were
//     already marked and could never surface a record whose deadline had just
//     passed;
//   - it compared deadlines against the zero time, for which now.After(x) is
//     always false.
//
// A zero breach count is a legitimate answer for a healthy tenant, so the
// assertions here are built on records that are provably overdue. The clock is
// time.Now(), so the fixture offsets are relative, not absolute timestamps.
func TestCheckBreachesMarksOverduePendingRecords(t *testing.T) {
	now := time.Now().UTC()
	past := func(d time.Duration) *time.Time { ts := now.Add(d); return &ts }

	repo := testutil.NewMockSLARepository()
	repo.Records = []models.SLARecord{
		// Overdue on resolution: the resolution branch comes first.
		{ID: 1, TicketID: "t-res", ResponseDeadlineAt: past(-time.Hour),
			ResolutionDeadlineAt: past(-2 * time.Hour)},
		// Overdue on response, never responded.
		{ID: 2, TicketID: "t-resp", ResponseDeadlineAt: past(-time.Hour),
			ResolutionDeadlineAt: past(2 * time.Hour)},
		// Inside both deadlines: must not be reported.
		{ID: 3, TicketID: "t-ok", ResponseDeadlineAt: past(2 * time.Hour),
			ResolutionDeadlineAt: past(3 * time.Hour)},
		// Response deadline passed, but the ticket did respond: the
		// RespondedAt == nil guard excludes it.
		{ID: 4, TicketID: "t-answered", RespondedAt: past(-time.Hour),
			ResponseDeadlineAt: past(-2 * time.Hour), ResolutionDeadlineAt: past(3 * time.Hour)},
	}

	svc := NewSLAService(repo, nil)
	breaches, err := svc.CheckBreaches(context.Background())
	if err != nil {
		t.Fatalf("CheckBreaches returned an error: %v", err)
	}
	if len(breaches) != 2 {
		t.Fatalf("CheckBreaches returned %d breaches, want 2: %+v", len(breaches), breaches)
	}

	byType := map[string]models.SLARecord{}
	for _, b := range breaches {
		byType[b.BreachType] = b
	}
	if got, ok := byType["resolution"]; !ok || got.TicketID != "t-res" || !got.Breached {
		t.Errorf("resolution breach = %+v (present=%v), want ticket t-res with Breached=true", got, ok)
	}
	if got, ok := byType["response"]; !ok || got.TicketID != "t-resp" || !got.Breached {
		t.Errorf("response breach = %+v (present=%v), want ticket t-resp with Breached=true", got, ok)
	}
	for _, b := range breaches {
		switch b.TicketID {
		case "t-ok":
			t.Errorf("record still inside both deadlines was reported as a breach: %+v", b)
		case "t-answered":
			t.Errorf("a record that already responded was reported as a response breach: %+v", b)
		}
		if b.BreachType == "" {
			t.Errorf("breach came back with an empty breach type: %+v", b)
		}
	}
}

// TestCheckBreachesPropagatesAQueryFailure pins the error path: the handler
// answers 500 from it, so returning an empty slice with a nil error would
// report a healthy tenant when the query failed.
func TestCheckBreachesPropagatesAQueryFailure(t *testing.T) {
	repo := testutil.NewMockSLARepository()
	repo.FindErr = errors.New("the sla_records query failed")
	svc := NewSLAService(repo, nil)

	breaches, err := svc.CheckBreaches(context.Background())
	if err == nil {
		t.Fatal("CheckBreaches returned no error when FindPendingRecords failed")
	}
	if !strings.Contains(err.Error(), "the sla_records query failed") {
		t.Fatalf("CheckBreaches err = %q, want the repository error", err)
	}
	if breaches != nil {
		t.Errorf("breaches = %v, want nil on a query failure", breaches)
	}
}

// MarkResponded, MarkResolved, PauseSLA and UnpauseSLA used to write
// response_ok / resolution_ok / paused / paused_reason through
// UpdateSLATracking into ticket_sla_tracking, a table that has none of those
// columns, so every one of them was a Postgres error and all four methods were
// no-ops. responded_at, resolved_at, paused and paused_reason all live in
// sla_records, which is what they write now.
func TestMarkRespondedPersistsRespondedAt(t *testing.T) {
	repo := testutil.NewMockSLARepository()
	repo.Records = []models.SLARecord{{ID: 1, TicketID: "t-1"}}
	svc := NewSLAService(repo, nil)

	if err := svc.MarkResponded(context.Background(), "t-1"); err != nil {
		t.Fatalf("MarkResponded returned an error: %v", err)
	}
	got, err := repo.GetRecordByTicket(context.Background(), "t-1")
	if err != nil {
		t.Fatalf("the mock lost the record: %v", err)
	}
	if got.RespondedAt == nil {
		t.Fatalf("MarkResponded did not set responded_at on the sla_records row: %+v", got)
	}
	if got.ResolvedAt != nil {
		t.Errorf("MarkResponded also resolved the ticket: %+v", got)
	}
}

func TestMarkResolvedPersistsResolvedAt(t *testing.T) {
	repo := testutil.NewMockSLARepository()
	ts := time.Now()
	repo.Records = []models.SLARecord{{ID: 7, TicketID: "t-7", RespondedAt: &ts}}
	svc := NewSLAService(repo, nil)

	if err := svc.MarkResolved(context.Background(), "t-7"); err != nil {
		t.Fatalf("MarkResolved returned an error: %v", err)
	}
	got, err := repo.GetRecordByTicket(context.Background(), "t-7")
	if err != nil {
		t.Fatalf("the mock lost the record: %v", err)
	}
	if got.ResolvedAt == nil {
		t.Fatalf("MarkResolved did not set resolved_at on the sla_records row: %+v", got)
	}
	if got.RespondedAt == nil {
		t.Errorf("MarkResolved clobbered responded_at: %+v", got)
	}
}

// A ticket whose priority has no SLA target has no sla_records row at all. The
// workflow calls MarkResponded unconditionally, so that is the normal case and
// has to stay a nil error rather than a failure.
func TestMarkRespondedIsANoOpWhenThereIsNoSLARecord(t *testing.T) {
	repo := testutil.NewMockSLARepository()
	svc := NewSLAService(repo, nil)

	if err := svc.MarkResponded(context.Background(), "t-none"); err != nil {
		t.Fatalf("MarkResponded = %v, want nil for a ticket with no SLA record", err)
	}
	if err := svc.MarkResolved(context.Background(), "t-none"); err != nil {
		t.Fatalf("MarkResolved = %v, want nil for a ticket with no SLA record", err)
	}
}

func TestMarkRespondedPropagatesAnUpdateFailure(t *testing.T) {
	repo := testutil.NewMockSLARepository()
	repo.Records = []models.SLARecord{{ID: 1, TicketID: "t-1"}}
	repo.UpdateErr = errors.New("the sla_records update failed")
	svc := NewSLAService(repo, nil)

	// GetErr stays nil so the update is the only thing that can fail.
	if err := svc.MarkResponded(context.Background(), "t-1"); err == nil {
		t.Fatal("MarkResponded returned no error when the update failed")
	} else if !strings.Contains(err.Error(), "the sla_records update failed") {
		t.Fatalf("MarkResponded err = %q, want the repository error", err)
	}
}

func TestPauseAndUnpauseSLAMutateTheRecord(t *testing.T) {
	repo := testutil.NewMockSLARepository()
	repo.Records = []models.SLARecord{{ID: 3, TicketID: "t-3"}}
	svc := NewSLAService(repo, nil)

	if err := svc.PauseSLA(context.Background(), "t-3", "awaiting vendor"); err != nil {
		t.Fatalf("PauseSLA returned an error: %v", err)
	}
	got, err := repo.GetRecordByTicket(context.Background(), "t-3")
	if err != nil {
		t.Fatalf("the mock lost the record: %v", err)
	}
	if !got.Paused || got.PausedAt == nil || got.PausedReason != "awaiting vendor" {
		t.Errorf("after PauseSLA the row is %+v, want paused with the reason preserved", got)
	}

	if err := svc.UnpauseSLA(context.Background(), "t-3"); err != nil {
		t.Fatalf("UnpauseSLA returned an error: %v", err)
	}
	got, err = repo.GetRecordByTicket(context.Background(), "t-3")
	if err != nil {
		t.Fatalf("the mock lost the record: %v", err)
	}
	if got.Paused || got.PausedAt != nil || got.PausedReason != "" {
		t.Errorf("after UnpauseSLA the row is %+v, want all three cleared", got)
	}
}

func TestPauseAndUnpauseSLAPropagateAQueryFailure(t *testing.T) {
	repo := testutil.NewMockSLARepository()
	repo.PauseErr = errors.New("the pause query failed")
	repo.UnpauseErr = errors.New("the unpause query failed")
	svc := NewSLAService(repo, nil)

	if err := svc.PauseSLA(context.Background(), "t-1", "vendor"); err == nil {
		t.Fatal("PauseSLA returned no error when the query failed")
	} else if !strings.Contains(err.Error(), "the pause query failed") {
		t.Fatalf("PauseSLA err = %q, want the repository error", err)
	}
	if err := svc.UnpauseSLA(context.Background(), "t-1"); err == nil {
		t.Fatal("UnpauseSLA returned no error when the query failed")
	} else if !strings.Contains(err.Error(), "the unpause query failed") {
		t.Fatalf("UnpauseSLA err = %q, want the repository error", err)
	}
}

// GetTicketSLA used to read ticket_sla_tracking and hand back a synthetic
// models.SLARecord with SLATargetID: 0 and every deadline left zero, so a
// caller could never tell whether a ticket was inside its SLA.
func TestGetTicketSLAReturnsTheRealRecord(t *testing.T) {
	repo := testutil.NewMockSLARepository()
	resp := time.Now().Add(-time.Hour)
	res := time.Now().Add(time.Hour)
	repo.Records = []models.SLARecord{{
		ID: 42, TicketID: "t-real", SLATargetID: 5, Priority: "high",
		ResponseDeadlineAt: &resp, ResolutionDeadlineAt: &res,
	}}
	svc := NewSLAService(repo, nil)

	got, err := svc.GetTicketSLA(context.Background(), "t-real")
	if err != nil {
		t.Fatalf("GetTicketSLA returned an error: %v", err)
	}
	if got.ID != 42 || got.SLATargetID != 5 || got.Priority != "high" {
		t.Errorf("GetTicketSLA = %+v, want the stored row verbatim", got)
	}
	if got.ResponseDeadlineAt == nil || !got.ResponseDeadlineAt.Equal(resp) {
		t.Errorf("response deadline = %v, want %v", got.ResponseDeadlineAt, resp)
	}
	if got.ResolutionDeadlineAt == nil || !got.ResolutionDeadlineAt.Equal(res) {
		t.Errorf("resolution deadline = %v, want %v", got.ResolutionDeadlineAt, res)
	}
}

func TestGetTicketSLAMapsAMissingRecordToNotFound(t *testing.T) {
	repo := testutil.NewMockSLARepository()
	repo.Records = []models.SLARecord{{ID: 1, TicketID: "t-other"}}
	svc := NewSLAService(repo, nil)

	_, err := svc.GetTicketSLA(context.Background(), "t-absent")
	if err == nil {
		t.Fatal("GetTicketSLA returned no error for a ticket with no SLA record")
	}
	if !strings.Contains(err.Error(), "sla record not found") {
		t.Fatalf("GetTicketSLA err = %q, want the not-found text the handler answers 404 with", err)
	}
}

func TestGetTicketSLAPropagatesAQueryFailure(t *testing.T) {
	repo := testutil.NewMockSLARepository()
	repo.GetErr = errors.New("the sla_records query failed")
	svc := NewSLAService(repo, nil)

	_, err := svc.GetTicketSLA(context.Background(), "t-1")
	if err == nil {
		t.Fatal("GetTicketSLA returned no error when the query failed")
	}
	if strings.Contains(err.Error(), "sla record not found") {
		t.Fatalf("GetTicketSLA swallowed a query failure and reported %q", err)
	}
	if !strings.Contains(err.Error(), "the sla_records query failed") {
		t.Fatalf("GetTicketSLA err = %q, want the repository error", err)
	}
}
