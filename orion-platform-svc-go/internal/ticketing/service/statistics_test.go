package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/ticketing/models"
)

// statsRepo overrides only the four counters GetStatistics calls. The embedded
// RepositoryInterface is deliberately left nil, so a call into anything else
// panics instead of returning nil: the test cannot drift onto a code path it is
// not asserting on, and a surviving mutant here means the assertion is missing.
type statsRepo struct {
	RepositoryInterface
	count        int
	countErr     error
	status       map[string]int
	statusErr    error
	priority     map[string]int
	priorityErr  error
	category     map[string]int
	categoryErr  error
	tickets      []models.Ticket
	ticketsErr   error
	engineers    []models.DispatchEngineer
	engineersErr error
	engineer     *models.DispatchEngineer
	engineerErr  error
	breaches     []models.SLABreach
	breachesErr  error
	stats        *models.TransferStats
	statsErr     error
}

func (r *statsRepo) CountTickets(ctx context.Context, tenantID string) (int, error) {
	return r.count, r.countErr
}

func (r *statsRepo) CountTicketsByStatus(ctx context.Context, tenantID string) (map[string]int, error) {
	return r.status, r.statusErr
}

func (r *statsRepo) CountTicketsByPriority(ctx context.Context, tenantID string) (map[string]int, error) {
	return r.priority, r.priorityErr
}

func (r *statsRepo) CountTicketsByCategory(ctx context.Context, tenantID string) (map[string]int, error) {
	return r.category, r.categoryErr
}

// The five overrides below are for the BI dashboard and transfer-stats methods.
// They fail on purpose: ticket_bi_analytics.go used to discard all of these
// errors with _ , so without the hooks there would be no way to prove they are
// now checked.

func (r *statsRepo) ListTickets(ctx context.Context, tenantID string, q models.TicketListQuery) ([]models.Ticket, error) {
	return r.tickets, r.ticketsErr
}

func (r *statsRepo) ListEngineers(ctx context.Context, tenantID string) ([]models.DispatchEngineer, error) {
	return r.engineers, r.engineersErr
}

func (r *statsRepo) GetEngineer(ctx context.Context, tenantID, id string) (*models.DispatchEngineer, error) {
	return r.engineer, r.engineerErr
}

func (r *statsRepo) GetSLABreaches(ctx context.Context, tenantID string) ([]models.SLABreach, error) {
	return r.breaches, r.breachesErr
}

func (r *statsRepo) GetTransferStats(ctx context.Context, tenantID string) (*models.TransferStats, error) {
	return r.stats, r.statsErr
}

func TestGetStatisticsReturnsEveryCount(t *testing.T) {
	repo := &statsRepo{
		count:    10,
		status:   map[string]int{"open": 3, "in-progress": 2, "resolved": 4, "closed": 1},
		priority: map[string]int{"high": 2, "low": 8},
		category: map[string]int{"bug": 6},
	}
	svc := NewService(repo)

	got, err := svc.GetStatistics(context.Background(), "t1")
	if err != nil {
		t.Fatalf("GetStatistics returned an error: %v", err)
	}
	if got.Total != 10 || got.Open != 3 || got.InProgress != 2 || got.Resolved != 4 || got.Closed != 1 {
		t.Errorf("GetStatistics = total %d open %d in-progress %d resolved %d closed %d, want 10/3/2/4/1",
			got.Total, got.Open, got.InProgress, got.Resolved, got.Closed)
	}
	if got.ByPriority["high"] != 2 || got.ByPriority["low"] != 8 {
		t.Errorf("ByPriority = %+v, want the counts from the repository", got.ByPriority)
	}
	if got.ByCategory["bug"] != 6 {
		t.Errorf("ByCategory = %+v, want the counts from the repository", got.ByCategory)
	}
}

// Each of the three breakdown counts used to be discarded with _ , so a failed
// COUNT query produced a 200 with every number zero -- which is what a tenant
// with no open tickets looks like. The loop sets exactly one error per case, so
// the repository failure is the only thing that can cause the error and each
// iteration proves that one specific call is checked.
func TestGetStatisticsPropagatesEachCountFailure(t *testing.T) {
	cases := []struct {
		name string
		repo *statsRepo
		msg  string
	}{
		{"status", &statsRepo{statusErr: errors.New("the status count failed")}, "the status count failed"},
		{"priority", &statsRepo{priorityErr: errors.New("the priority count failed")}, "the priority count failed"},
		{"category", &statsRepo{categoryErr: errors.New("the category count failed")}, "the category count failed"},
		{"total", &statsRepo{countErr: errors.New("the total count failed")}, "the total count failed"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			svc := NewService(tc.repo)
			got, err := svc.GetStatistics(context.Background(), "t1")
			if err == nil {
				t.Fatalf("GetStatistics returned no error when the %s count failed; got %+v", tc.name, got)
			}
			if got != nil {
				t.Errorf("GetStatistics = %+v, want nil alongside the error", got)
			}
			if !strings.Contains(err.Error(), tc.msg) {
				t.Fatalf("GetStatistics err = %q, want the repository error", err)
			}
		})
	}
}

// --- BI dashboards ---
//
// Each of these methods discarded every repository error with _ .
// GetExecutiveDashboard was the worst: GetSLACompliance returns a nil report
// alongside its error, so "compliance, _ := ..." dereferenced nil and a failed
// query panicked the request instead of answering 500. The positive test pins
// every field the method computes, and the propagation loop sets exactly one
// failure per case so each iteration proves that one specific call is checked.
// The one exception is the tickets case, which is explained at the case itself.

func TestGetExecutiveDashboardReturnsEveryKPI(t *testing.T) {
	repo := &statsRepo{
		count: 12,
		status: map[string]int{
			"open": 3, "assigned": 1, "in-progress": 2, "escalated": 2,
		},
		engineers: []models.DispatchEngineer{{ID: "e1"}, {ID: "e2"}},
		// All three are resolved or closed, so GetSLACompliance answers 100.
		// Only t1 counts as resolved today: t2 resolved three days ago and t3
		// is closed, not resolved.
		tickets: []models.Ticket{
			{ID: "t1", Status: "resolved", UpdatedAt: time.Now().UTC()},
			{ID: "t2", Status: "resolved", UpdatedAt: time.Now().UTC().AddDate(0, 0, -3)},
			{ID: "t3", Status: "closed", UpdatedAt: time.Now().UTC()},
		},
	}
	svc := NewService(repo)

	got, err := svc.GetExecutiveDashboard(context.Background(), "t1")
	if err != nil {
		t.Fatalf("GetExecutiveDashboard returned an error: %v", err)
	}
	if got.TotalTickets != 12 {
		t.Errorf("TotalTickets = %d, want 12", got.TotalTickets)
	}
	if got.OpenTickets != 6 {
		t.Errorf("OpenTickets = %d, want open+assigned+in-progress = 6", got.OpenTickets)
	}
	if got.ResolvedToday != 1 {
		t.Errorf("ResolvedToday = %d, want 1", got.ResolvedToday)
	}
	if got.ActiveEngineers != 2 {
		t.Errorf("ActiveEngineers = %d, want 2", got.ActiveEngineers)
	}
	if got.SLACompliance != 100.0 {
		t.Errorf("SLACompliance = %v, want the compliance rate from GetSLACompliance", got.SLACompliance)
	}
	if got.Escalations != 2 {
		t.Errorf("Escalations = %d, want the escalated count from the repository", got.Escalations)
	}
}

func TestGetExecutiveDashboardPropagatesEachFailure(t *testing.T) {
	cases := []struct {
		name string
		repo *statsRepo
		msg  string
	}{
		{"count", &statsRepo{countErr: errors.New("the ticket count failed")}, "the ticket count failed"},
		{"status", &statsRepo{statusErr: errors.New("the status count failed")}, "the status count failed"},
		// breachesErr is set alongside on purpose. GetExecutiveDashboard reads the
		// ticket list twice: once here and again inside GetSLACompliance. With
		// only ticketsErr set, a mutant that discarded this call would still be
		// caught by the compliance read and surface this very error, so the case
		// passed for the wrong reason. With breaches failing too, the discard lets
		// the breach error win and the message assertion below rejects it.
		{"tickets", &statsRepo{ticketsErr: errors.New("the ticket list failed"),
			breachesErr: errors.New("the breach list failed")}, "the ticket list failed"},
		{"engineers", &statsRepo{engineersErr: errors.New("the engineer list failed")}, "the engineer list failed"},
		{"sla", &statsRepo{breachesErr: errors.New("the breach list failed")}, "the breach list failed"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			svc := NewService(tc.repo)
			got, err := svc.GetExecutiveDashboard(context.Background(), "t1")
			if err == nil {
				t.Fatalf("GetExecutiveDashboard returned no error when the %s query failed; got %+v", tc.name, got)
			}
			if got != nil {
				t.Errorf("GetExecutiveDashboard = %+v, want nil alongside the error", got)
			}
			if !strings.Contains(err.Error(), tc.msg) {
				t.Fatalf("GetExecutiveDashboard err = %q, want the repository error", err)
			}
		})
	}
}

func TestGetManagerDashboardReturnsTeamLoadOverdueAndNewThisWeek(t *testing.T) {
	now := time.Now().UTC()
	repo := &statsRepo{
		engineers: []models.DispatchEngineer{
			{ID: "e1", Name: "alice", CurrentLoad: 5},
			{ID: "e2", Name: "bob", CurrentLoad: 2},
		},
		tickets: []models.Ticket{
			// high = 8h target, 30 days old: overdue, not new this week.
			{ID: "tA", Status: "open", Priority: "high", CreatedAt: now.AddDate(0, 0, -30)},
			// critical = 4h target, 1 day old: overdue and new this week.
			{ID: "tB", Status: "open", Priority: "critical", CreatedAt: now.AddDate(0, 0, -1)},
			// low = 72h target, 2 days old: still inside its target, new this week.
			{ID: "tC", Status: "open", Priority: "low", CreatedAt: now.AddDate(0, 0, -2)},
			// closed tickets never count as overdue.
			{ID: "tD", Status: "closed", Priority: "critical", CreatedAt: now.AddDate(0, 0, -30)},
		},
	}
	svc := NewService(repo)

	got, err := svc.GetManagerDashboard(context.Background(), "t1")
	if err != nil {
		t.Fatalf("GetManagerDashboard returned an error: %v", err)
	}
	if got.TeamLoad["alice"] != 5 || got.TeamLoad["bob"] != 2 {
		t.Errorf("TeamLoad = %+v, want alice 5 and bob 2", got.TeamLoad)
	}
	if got.OverdueTickets != 2 {
		t.Errorf("OverdueTickets = %d, want 2", got.OverdueTickets)
	}
	if got.NewThisWeek != 2 {
		t.Errorf("NewThisWeek = %d, want 2", got.NewThisWeek)
	}
}

func TestGetManagerDashboardPropagatesEachFailure(t *testing.T) {
	cases := []struct {
		name string
		repo *statsRepo
		msg  string
	}{
		{"engineers", &statsRepo{engineersErr: errors.New("the engineer list failed")}, "the engineer list failed"},
		{"tickets", &statsRepo{ticketsErr: errors.New("the ticket list failed")}, "the ticket list failed"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			svc := NewService(tc.repo)
			got, err := svc.GetManagerDashboard(context.Background(), "t1")
			if err == nil {
				t.Fatalf("GetManagerDashboard returned no error when the %s query failed; got %+v", tc.name, got)
			}
			if got != nil {
				t.Errorf("GetManagerDashboard = %+v, want nil alongside the error", got)
			}
			if !strings.Contains(err.Error(), tc.msg) {
				t.Fatalf("GetManagerDashboard err = %q, want the repository error", err)
			}
		})
	}
}

func TestGetEngineerDashboardReturnsAssignedWork(t *testing.T) {
	aid := "e1"
	other := "e2"
	repo := &statsRepo{
		tickets: []models.Ticket{
			{ID: "t1", AssigneeID: &aid, Status: "open", Priority: "high", CreatedAt: time.Now().UTC()},
			// Assigned and resolved: counts toward MyTickets, has no open deadline.
			{ID: "t2", AssigneeID: &aid, Status: "resolved", CreatedAt: time.Now().UTC()},
			// Someone else's ticket: excluded.
			{ID: "t3", AssigneeID: &other, Status: "open", CreatedAt: time.Now().UTC()},
			// Unassigned: excluded.
			{ID: "t4", Status: "open", CreatedAt: time.Now().UTC()},
		},
	}
	svc := NewService(repo)

	got, err := svc.GetEngineerDashboard(context.Background(), "t1", "e1")
	if err != nil {
		t.Fatalf("GetEngineerDashboard returned an error: %v", err)
	}
	if got.EngineerID != "e1" || got.MyTickets != 2 || got.OpenTickets != 1 {
		t.Errorf("GetEngineerDashboard = %+v, want engineer e1 with 2 assigned and 1 open", got)
	}
	if len(got.UpcomingDeadlines) != 1 || !strings.Contains(got.UpcomingDeadlines[0], "t1") {
		t.Errorf("UpcomingDeadlines = %v, want exactly t1's deadline", got.UpcomingDeadlines)
	}
}

func TestGetEngineerDashboardPropagatesAListFailure(t *testing.T) {
	svc := NewService(&statsRepo{ticketsErr: errors.New("the ticket list failed")})

	got, err := svc.GetEngineerDashboard(context.Background(), "t1", "e1")
	if err == nil {
		t.Fatalf("GetEngineerDashboard returned no error when ListTickets failed; got %+v", got)
	}
	if got != nil {
		t.Errorf("GetEngineerDashboard = %+v, want nil alongside the error", got)
	}
	if !strings.Contains(err.Error(), "the ticket list failed") {
		t.Fatalf("GetEngineerDashboard err = %q, want the repository error", err)
	}
}

func TestGetEngineerEfficiencyAveragesResolutionHours(t *testing.T) {
	aid := "e1"
	other := "e2"
	now := time.Now().UTC()
	repo := &statsRepo{
		tickets: []models.Ticket{
			{ID: "t1", AssigneeID: &aid, Status: "resolved", CreatedAt: now.Add(-2 * time.Hour), UpdatedAt: now},
			{ID: "t2", AssigneeID: &aid, Status: "closed", CreatedAt: now.Add(-6 * time.Hour), UpdatedAt: now},
			// Someone else's ticket: excluded from e1's average.
			{ID: "t3", AssigneeID: &other, Status: "resolved", CreatedAt: now.Add(-100 * time.Hour), UpdatedAt: now},
		},
	}
	svc := NewService(repo)

	got, err := svc.GetEngineerEfficiency(context.Background(), "t1", "e1")
	if err != nil {
		t.Fatalf("GetEngineerEfficiency returned an error: %v", err)
	}
	if got.EngineerID != "e1" || got.TicketsResolved != 2 || got.AvgResolveH != 4 {
		t.Errorf("GetEngineerEfficiency = %+v, want engineer e1 with 2 resolved and an average of 4 hours", got)
	}
}

func TestGetEngineerEfficiencyPropagatesAListFailure(t *testing.T) {
	svc := NewService(&statsRepo{ticketsErr: errors.New("the ticket list failed")})

	got, err := svc.GetEngineerEfficiency(context.Background(), "t1", "e1")
	if err == nil {
		t.Fatalf("GetEngineerEfficiency returned no error when ListTickets failed; got %+v", got)
	}
	if got != nil {
		t.Errorf("GetEngineerEfficiency = %+v, want nil alongside the error", got)
	}
	if !strings.Contains(err.Error(), "the ticket list failed") {
		t.Fatalf("GetEngineerEfficiency err = %q, want the repository error", err)
	}
}

// GetEfficiencyScore returned a literal Ranking: 1, so every engineer on
// GET /tickets/bi/score/:engineerId read as the top performer, and Grade and
// Components came back zero even though the method computed the three score
// components and threw them away.
func TestGetEfficiencyScoreReturnsGradeComponentsAndRankOne(t *testing.T) {
	self := "e1"
	a2 := "e2"
	now := time.Now().UTC()
	repo := &statsRepo{
		engineer: &models.DispatchEngineer{ID: "e1", MaxTickets: 10, CurrentLoad: 0},
		engineers: []models.DispatchEngineer{
			{ID: "e1", MaxTickets: 10, CurrentLoad: 0},
			{ID: "e2", MaxTickets: 10, CurrentLoad: 0},
			{ID: "e3", MaxTickets: 10, CurrentLoad: 9},
		},
		tickets: []models.Ticket{
			{ID: "r1", AssigneeID: &self, Status: "resolved", CreatedAt: now.Add(-2 * time.Hour), UpdatedAt: now},
			{ID: "r2", AssigneeID: &self, Status: "closed", CreatedAt: now.Add(-6 * time.Hour), UpdatedAt: now},
			{ID: "r3", AssigneeID: &a2, Status: "resolved", CreatedAt: now.Add(-2 * time.Hour), UpdatedAt: now},
		},
	}
	svc := NewService(repo)

	got, err := svc.GetEfficiencyScore(context.Background(), "t1", "e1")
	if err != nil {
		t.Fatalf("GetEfficiencyScore returned an error: %v", err)
	}
	// e1: 2 resolved (40) + 4h average <= 4 (30) + load 0.0 < 0.5 (30) = 100.
	// e2: 1 resolved (20) + 2h average (30) + low load (30) = 80.
	// e3: no tickets, load 0.9 (0) = 0.
	if got.EngineerID != "e1" || got.Score != 100 || got.Ranking != 1 || got.Grade != "A" {
		t.Errorf("GetEfficiencyScore = %+v, want engineer e1 score 100 rank 1 grade A", got)
	}
	if got.Components["resolution_volume"] != 40 || got.Components["resolution_speed"] != 30 || got.Components["load_balance"] != 30 {
		t.Errorf("Components = %+v, want volume 40, speed 30 and load_balance 30", got.Components)
	}
}

// Score 80 sits far below the >=90 threshold the A arm above exercises, so this
// is the band a weakened rubric would have survived. The rubric itself was not
// invented here: it is the A/B/C/D/F table internal/ticket's GetEfficiencyScore
// already applies, so the two modules grade the same score the same way.
func TestGetEfficiencyScoreGradesB(t *testing.T) {
	a2 := "e2"
	now := time.Now().UTC()
	repo := &statsRepo{
		engineer:  &models.DispatchEngineer{ID: "e2", MaxTickets: 10, CurrentLoad: 0},
		engineers: []models.DispatchEngineer{{ID: "e2", MaxTickets: 10, CurrentLoad: 0}},
		tickets: []models.Ticket{
			// One ticket resolved at 2h: volume 20 + speed 30 + load 30 = 80.
			{ID: "r1", AssigneeID: &a2, Status: "resolved", CreatedAt: now.Add(-2 * time.Hour), UpdatedAt: now},
		},
	}
	svc := NewService(repo)

	got, err := svc.GetEfficiencyScore(context.Background(), "t1", "e2")
	if err != nil {
		t.Fatalf("GetEfficiencyScore returned an error: %v", err)
	}
	if got.EngineerID != "e2" || got.Score != 80 || got.Ranking != 1 || got.Grade != "B" {
		t.Errorf("GetEfficiencyScore = %+v, want engineer e2 score 80 rank 1 grade B", got)
	}
}

// The inverse fixture: e1 has resolved nothing and carries the heaviest load,
// so the constant Ranking: 1 is impossible to keep.
func TestGetEfficiencyScoreRanksLastWhenNoOneScoresHigher(t *testing.T) {
	a2 := "e2"
	a3 := "e3"
	now := time.Now().UTC()
	repo := &statsRepo{
		engineer: &models.DispatchEngineer{ID: "e1", MaxTickets: 10, CurrentLoad: 9},
		engineers: []models.DispatchEngineer{
			{ID: "e1", MaxTickets: 10, CurrentLoad: 9},
			{ID: "e2", MaxTickets: 10, CurrentLoad: 0},
			{ID: "e3", MaxTickets: 10, CurrentLoad: 0},
		},
		tickets: []models.Ticket{
			{ID: "r1", AssigneeID: &a2, Status: "resolved", CreatedAt: now.Add(-2 * time.Hour), UpdatedAt: now},
			{ID: "r2", AssigneeID: &a2, Status: "closed", CreatedAt: now.Add(-6 * time.Hour), UpdatedAt: now},
			{ID: "r3", AssigneeID: &a3, Status: "resolved", CreatedAt: now.Add(-2 * time.Hour), UpdatedAt: now},
		},
	}
	svc := NewService(repo)

	got, err := svc.GetEfficiencyScore(context.Background(), "t1", "e1")
	if err != nil {
		t.Fatalf("GetEfficiencyScore returned an error: %v", err)
	}
	// e2 scores 100, e3 scores 80, e1 scores 0.
	if got.Score != 0 || got.Ranking != 3 || got.Grade != "F" {
		t.Errorf("GetEfficiencyScore = %+v, want score 0 rank 3 grade F", got)
	}
}

func TestGetEfficiencyScorePropagatesEachFailure(t *testing.T) {
	cases := []struct {
		name string
		repo *statsRepo
		msg  string
	}{
		{"engineer", &statsRepo{engineerErr: errors.New("the engineer lookup failed")}, "the engineer lookup failed"},
		{"tickets", &statsRepo{engineer: &models.DispatchEngineer{ID: "e1"}, ticketsErr: errors.New("the ticket list failed")}, "the ticket list failed"},
		{"engineers", &statsRepo{engineer: &models.DispatchEngineer{ID: "e1"}, engineersErr: errors.New("the engineer list failed")}, "the engineer list failed"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			svc := NewService(tc.repo)
			got, err := svc.GetEfficiencyScore(context.Background(), "t1", "e1")
			if err == nil {
				t.Fatalf("GetEfficiencyScore returned no error when the %s query failed; got %+v", tc.name, got)
			}
			if got != nil {
				t.Errorf("GetEfficiencyScore = %+v, want nil alongside the error", got)
			}
			if !strings.Contains(err.Error(), tc.msg) {
				t.Fatalf("GetEfficiencyScore err = %q, want the repository error", err)
			}
		})
	}
}

// GetTransferStats used to discard the COUNT behind AvgTransfers, so a failed
// query answered 200 with avg_transfers_per_ticket still at 0 -- exactly what a
// tenant that never transferred a ticket looks like.
func TestGetTransferStatsAveragesPerTicket(t *testing.T) {
	svc := NewService(&statsRepo{stats: &models.TransferStats{TotalTransfers: 6}, count: 3})

	got, err := svc.GetTransferStats(context.Background(), "t1")
	if err != nil {
		t.Fatalf("GetTransferStats returned an error: %v", err)
	}
	if got.AvgTransfers != 2 {
		t.Errorf("AvgTransfers = %v, want 6 transfers over 3 tickets", got.AvgTransfers)
	}

	// Zero tickets must not divide by zero and must leave the average unset.
	empty := NewService(&statsRepo{stats: &models.TransferStats{TotalTransfers: 6}, count: 0})
	gotEmpty, err := empty.GetTransferStats(context.Background(), "t1")
	if err != nil {
		t.Fatalf("GetTransferStats returned an error: %v", err)
	}
	if gotEmpty.AvgTransfers != 0 {
		t.Errorf("AvgTransfers = %v, want 0 when the tenant has no tickets", gotEmpty.AvgTransfers)
	}
}

func TestGetTransferStatsPropagatesEachFailure(t *testing.T) {
	cases := []struct {
		name string
		repo *statsRepo
		msg  string
	}{
		{"stats", &statsRepo{statsErr: errors.New("the transfer stats query failed")}, "the transfer stats query failed"},
		{"count", &statsRepo{stats: &models.TransferStats{}, countErr: errors.New("the ticket count failed")}, "the ticket count failed"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			svc := NewService(tc.repo)
			got, err := svc.GetTransferStats(context.Background(), "t1")
			if err == nil {
				t.Fatalf("GetTransferStats returned no error when the %s query failed; got %+v", tc.name, got)
			}
			if got != nil {
				t.Errorf("GetTransferStats = %+v, want nil alongside the error", got)
			}
			if !strings.Contains(err.Error(), tc.msg) {
				t.Fatalf("GetTransferStats err = %q, want the repository error", err)
			}
		})
	}
}
