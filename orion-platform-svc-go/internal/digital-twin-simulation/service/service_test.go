package service

import (
	"context"
	"database/sql"
	"strings"
	"math/rand"
	"testing"
	"time"

	"orion/platform-svc-go/internal/digital-twin-simulation/models"
)

type mockSimRepo struct {
	twins  map[string]*models.DigitalTwin
	dbErr  error
}

func newMockSimRepo() *mockSimRepo {
	return &mockSimRepo{twins: map[string]*models.DigitalTwin{}}
}

func (m *mockSimRepo) CreateTwin(_ context.Context, tenantID string, req models.CreateTwinRequest) (*models.DigitalTwin, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	twinID := "tw-" + req.Name
	t := &models.DigitalTwin{ID: twinID, TenantID: tenantID, Name: req.Name}
	m.twins[tenantID+":"+twinID] = t
	return t, nil
}

func (m *mockSimRepo) FindTwinByID(_ context.Context, tenantID, id string) (*models.DigitalTwin, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	t, ok := m.twins[tenantID+":"+id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return t, nil
}

func (m *mockSimRepo) ListTwins(_ context.Context, tenantID string, q models.ListQuery) ([]models.DigitalTwin, int64, error) {
	var out []models.DigitalTwin
	for _, t := range m.twins {
		if t.TenantID == tenantID {
			out = append(out, *t)
		}
	}
	return out, int64(len(out)), nil
}

func (m *mockSimRepo) UpdateTwin(_ context.Context, tenantID, id string, req models.UpdateTwinRequest) (*models.DigitalTwin, error) {
	t, ok := m.twins[tenantID+":"+id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	if len(req.Name) > 0 {
		t.Name = req.Name
	}
	return t, nil
}

func (m *mockSimRepo) DeleteTwin(_ context.Context, tenantID, id string) error {
	_, ok := m.twins[tenantID+":"+id]
	if !ok {
		return sql.ErrNoRows
	}
	_, ok = m.twins[tenantID+":"+id]
	if !ok {
		return sql.ErrNoRows
	}
	delete(m.twins, tenantID+":"+id)
	return nil
}

func (m *mockSimRepo) UpdateTwinStatusAndSync(_ context.Context, tenantID, id string, status string, lastSync *int64, updatedAt int64) (*models.DigitalTwin, error) {
	return m.twins[tenantID+":"+id], nil
}

func (m *mockSimRepo) CreateState(_ context.Context, state models.TwinState) (*models.TwinState, error) {
	return &state, nil
}

func (m *mockSimRepo) GetLatestState(_ context.Context, twinID string) (*models.TwinState, error) {
	return nil, nil
}

func (m *mockSimRepo) CreateSimulation(_ context.Context, tenantID string, sim models.Simulation) (*models.Simulation, error) {
	return &sim, nil
}

func (m *mockSimRepo) ListSimulations(_ context.Context, twinID string, q models.ListQuery) ([]models.Simulation, int64, error) {
	return nil, 0, nil
}

func (m *mockSimRepo) UpdateSimulation(_ context.Context, id string, status string, endTime *int64, duration *int64, results models.JSON) (*models.Simulation, error) {
	return nil, nil
}

func makeSvc(repo *mockSimRepo) *Service {
	return &Service{
		repo:    repo,
		clock:   func() int64 { return time.Now().UnixMilli() },
		randSrc: rand.New(rand.NewSource(42)),
	}
}

func TestCreateTwin_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockSimRepo()
	svc := makeSvc(repo)

	name := "twin1"
	twin, err := svc.CreateTwin(ctx, "t1", models.CreateTwinRequest{Name: name})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if twin.Name != name {
		t.Errorf("expected name %q, got %q", name, twin.Name)
	}
	if twin.ID != "tw-twin1" {
		t.Errorf("expected ID 'tw-twin1', got %q", twin.ID)
	}
}

func TestListTwins_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockSimRepo()
	svc := makeSvc(repo)

	_, _ = svc.CreateTwin(ctx, "t1", models.CreateTwinRequest{Name: "t1"})
	_, _ = svc.CreateTwin(ctx, "t1", models.CreateTwinRequest{Name: "t2"})

	list, count, err := svc.ListTwins(ctx, "t1", models.ListQuery{})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(list) != 2 {
		t.Errorf("expected 2 twins, got %d", len(list))
	}
	if count != 2 {
		t.Errorf("expected count 2, got %d", count)
	}
}

func TestGetTwin_NotFound(t *testing.T) {
	ctx := context.Background()
	repo := newMockSimRepo()
	svc := makeSvc(repo)

	_, err := svc.GetTwin(ctx, "t1", "nonexist")
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("expected sql.ErrNoRows, got %v", err)
	}
}

func TestUpdateTwin_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockSimRepo()
	svc := makeSvc(repo)

	created, _ := svc.CreateTwin(ctx, "t1", models.CreateTwinRequest{Name: "t1"})
	newName := "updated"

	_, err := svc.UpdateTwin(ctx, "t1", created.ID, models.UpdateTwinRequest{Name: newName})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	twin, _ := repo.FindTwinByID(ctx, "t1", created.ID)
	if twin.Name != "updated" {
		t.Errorf("expected 'updated', got %q", twin.Name)
	}
}

func TestDeleteTwin_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockSimRepo()
	svc := makeSvc(repo)

	created, _ := svc.CreateTwin(ctx, "t1", models.CreateTwinRequest{Name: "t1"})

	err := svc.DeleteTwin(ctx, "t1", created.ID)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	_, err = repo.FindTwinByID(ctx, "t1", created.ID)
	if err == nil {
		t.Error("expected twin deleted")
	}
}
