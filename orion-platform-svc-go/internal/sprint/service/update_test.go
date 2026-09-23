package service

import (
	"context"
	"testing"

	"orion/platform-svc-go/internal/sprint/models"
)

// fakeSprintRepo drives the real Service. The embedded interface keeps the
// unused methods compiling.
type fakeSprintRepo struct {
	RepositoryInterface

	updates map[string]interface{}
}

func (f *fakeSprintRepo) GetByID(ctx context.Context, tenantID, id string) (*models.Sprint, error) {
	return &models.Sprint{ID: id, TenantID: tenantID, Name: "S0"}, nil
}

func (f *fakeSprintRepo) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	f.updates = updates
	return nil
}

// UpdateSprintRequest exposes goal, start_date, end_date, status and capacity,
// but the service used to copy only name into the update map. Combined with a
// repository that discarded the map entirely, PUT /sprints/:id could not change
// any sprint at all.
func TestUpdate_MapsEveryRequestField(t *testing.T) {
	repo := &fakeSprintRepo{}
	s := NewService(repo)

	got, err := s.Update(context.Background(), "t-1", "s-1", models.UpdateSprintRequest{
		Name:      strPtr("S9"),
		Goal:      strPtr("ship the gateway"),
		StartDate: strPtr("2026-09-01"),
		EndDate:   strPtr("2026-09-14"),
		Status:    strPtr("active"),
		Capacity:  intPtr(24),
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.ID != "s-1" {
		t.Fatalf("row = %+v", got)
	}

	want := map[string]interface{}{
		"name":       "S9",
		"goal":       "ship the gateway",
		"start_date": "2026-09-01",
		"end_date":   "2026-09-14",
		"status":     "active",
		"capacity":   24,
	}
	if len(repo.updates) != len(want) {
		t.Fatalf("updates = %v, want %v", repo.updates, want)
	}
	for k, v := range want {
		if repo.updates[k] != v {
			t.Fatalf("updates[%q] = %v, want %v", k, repo.updates[k], v)
		}
	}
}

// A partial request must only touch the fields the caller actually sent.
func TestUpdate_SendsOnlyTheFieldsThatWereProvided(t *testing.T) {
	repo := &fakeSprintRepo{}
	s := NewService(repo)

	if _, err := s.Update(context.Background(), "t-1", "s-1", models.UpdateSprintRequest{
		Status: strPtr("done"),
	}); err != nil {
		t.Fatal(err)
	}
	if len(repo.updates) != 1 || repo.updates["status"] != "done" {
		t.Fatalf("updates = %v, want only status", repo.updates)
	}
}

func strPtr(s string) *string { return &s }
func intPtr(i int) *int       { return &i }
