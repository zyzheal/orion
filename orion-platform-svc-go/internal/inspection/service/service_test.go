package service

import (
	"context"
	"errors"
	"sync"
	"testing"

	"orion/platform-svc-go/internal/inspection/models"
)

// memoryRepo is an in-memory RepositoryInterface fake for service tests.
type memoryRepo struct {
	mu      sync.Mutex
	records map[string]*models.Record
	nextID  int
}

func newMemoryRepo() *memoryRepo {
	return &memoryRepo{records: map[string]*models.Record{}}
}

func (r *memoryRepo) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextID++
	id := "id-" + string(rune('0'+r.nextID))
	status := req.Status
	if status == "" {
		status = models.StatusPending
	}
	rec := &models.Record{ID: id, TenantID: tenantID, Name: req.Name, Status: status, Metadata: req.Config}
	r.records[id] = rec
	return rec, nil
}

func (r *memoryRepo) GetByID(ctx context.Context, tenantID, id string) (*models.Record, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	rec, ok := r.records[id]
	if !ok || rec.TenantID != tenantID {
		return nil, errors.New("not found")
	}
	return rec, nil
}

func (r *memoryRepo) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	rec, ok := r.records[id]
	if !ok || rec.TenantID != tenantID {
		return nil, errors.New("not found")
	}
	if req.Name != "" {
		rec.Name = req.Name
	}
	if req.Status != "" {
		rec.Status = req.Status
	}
	if req.Config != nil {
		rec.Metadata = req.Config
	}
	return rec, nil
}

func (r *memoryRepo) Delete(ctx context.Context, tenantID, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.records[id]; !ok {
		return errors.New("not found")
	}
	delete(r.records, id)
	return nil
}

func (r *memoryRepo) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]models.Record, 0)
	for _, rec := range r.records {
		if rec.TenantID == tenantID {
			out = append(out, *rec)
		}
	}
	return out, nil
}

var _ RepositoryInterface = (*memoryRepo)(nil)

func TestService_RunInspection_RejectsNotFound(t *testing.T) {
	svc := NewService(newMemoryRepo())
	_, err := svc.RunInspection(context.Background(), "t1", "missing")
	if err == nil {
		t.Fatal("expected error for missing record")
	}
}

func TestService_RunInspection_ExecutesEngine(t *testing.T) {
	repo := newMemoryRepo()
	svc := NewService(repo).WithCollectors(&fakeCollector{id: "c1", ms: []Measurement{{Name: "cpu", Value: 50}}})
	rec, _ := svc.Create(context.Background(), "t1", models.CreateRequest{Name: "n1"})

	res, err := svc.RunInspection(context.Background(), "t1", rec.ID)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if res["status"] != "passed" {
		t.Errorf("expected status passed, got %v", res["status"])
	}
	if res["collected"] != 1 {
		t.Errorf("expected 1 collected, got %v", res["collected"])
	}
}

func TestService_RunInspection_PersistsProblems(t *testing.T) {
	repo := newMemoryRepo()
	svc := NewService(repo).
		WithRules([]ThresholdRule{{Name: "cpu", Max: 80, Enabled: true}}).
		WithCollectors(&fakeCollector{id: "c", ms: []Measurement{{Name: "cpu", Value: 95}}})
	rec, _ := svc.Create(context.Background(), "t1", models.CreateRequest{Name: "n1"})

	if _, err := svc.RunInspection(context.Background(), "t1", rec.ID); err != nil {
		t.Fatalf("run err: %v", err)
	}
	results, err := svc.GetResults(context.Background(), "t1", rec.ID)
	if err != nil {
		t.Fatalf("results err: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 problem result, got %d", len(results))
	}
	if results[0].Status != "fail" {
		t.Errorf("expected fail severity, got %s", results[0].Status)
	}
}

func TestService_UpdateStatus_RejectsIllegalTransition(t *testing.T) {
	svc := NewService(newMemoryRepo())
	rec, _ := svc.Create(context.Background(), "t1", models.CreateRequest{Name: "n1"})
	// pending → passed is illegal (must go through running).
	_, err := svc.UpdateStatus(context.Background(), "t1", rec.ID, StatusPassed)
	if err == nil {
		t.Fatal("expected illegal transition error")
	}
	if !errors.Is(err, ErrInvalidTransition) {
		t.Errorf("expected ErrInvalidTransition, got %v", err)
	}
}

func TestService_UpdateStatus_RejectsUnknown(t *testing.T) {
	svc := NewService(newMemoryRepo())
	rec, _ := svc.Create(context.Background(), "t1", models.CreateRequest{Name: "n1"})
	_, err := svc.UpdateStatus(context.Background(), "t1", rec.ID, "bogus")
	if err == nil {
		t.Fatal("expected unknown status error")
	}
	if !errors.Is(err, ErrUnknownStatus) {
		t.Errorf("expected ErrUnknownStatus, got %v", err)
	}
}

func TestService_UpdateStatus_AllowsLegalTransition(t *testing.T) {
	svc := NewService(newMemoryRepo())
	rec, _ := svc.Create(context.Background(), "t1", models.CreateRequest{Name: "n1"})
	res, err := svc.UpdateStatus(context.Background(), "t1", rec.ID, StatusRunning)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if res["newStatus"] != StatusRunning || res["previous"] != StatusPending {
		t.Errorf("expected running/prev pending, got %v", res)
	}
}

func TestService_ListTemplates_FiltersTemplateKind(t *testing.T) {
	repo := newMemoryRepo()
	svc := NewService(repo)
	_, _ = svc.Create(context.Background(), "t1", models.CreateRequest{Name: "regular"})
	_, _ = svc.Create(context.Background(), "t1", models.CreateRequest{
		Name:   "tpl",
		Config: map[string]interface{}{"kind": "template"},
	})
	tpls, err := svc.ListTemplates(context.Background(), "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(tpls) != 1 || tpls[0].Name != "tpl" {
		t.Errorf("expected 1 template named tpl, got %+v", tpls)
	}
}

func TestService_Create_RejectsBadStatus(t *testing.T) {
	svc := NewService(newMemoryRepo())
	_, err := svc.Create(context.Background(), "t1", models.CreateRequest{Name: "n1", Status: "bogus"})
	if err == nil {
		t.Fatal("expected unknown status error")
	}
}

func TestService_GetStats_CountsEveryState(t *testing.T) {
	repo := newMemoryRepo()
	svc := NewService(repo)
	for _, st := range []string{StatusPending, StatusRunning, StatusPassed, StatusFailed, StatusWarning, StatusCancelled} {
		_, _ = svc.Create(context.Background(), "t1", models.CreateRequest{Name: "n", Status: st})
	}
	stats, err := svc.GetStats(context.Background(), "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if stats["total"] != 6 {
		t.Errorf("expected total 6, got %v", stats["total"])
	}
	if stats["cancelled"] != 1 {
		t.Errorf("expected 1 cancelled, got %v", stats["cancelled"])
	}
}
