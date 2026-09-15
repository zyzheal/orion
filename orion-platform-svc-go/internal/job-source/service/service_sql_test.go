package service

import (
	"context"
	"errors"
	"testing"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/job-source/models"

	"go.uber.org/zap/zaptest"
)

// fakeRepo is the service's only collaborator in these tests, so a call it
// records is proof the service reached SQL rather than short-circuiting.
type fakeRepo struct {
	byID         map[string]*models.JobSource
	updated      []map[string]interface{}
	updatedID    string
	updatedTenan string
	events       []models.JobSourceEvent
	updateErr    error
	getErr       error
	createErr    error
}

func (f *fakeRepo) Create(ctx context.Context, m *models.JobSource) error {
	if f.createErr != nil {
		return f.createErr
	}
	f.byID[m.ID] = m
	return nil
}
func (f *fakeRepo) Delete(ctx context.Context, tenantID, id string) error { return nil }
func (f *fakeRepo) List(ctx context.Context, tenantID string, l, o int) ([]models.JobSource, error) {
	return nil, nil
}
func (f *fakeRepo) ListEvents(ctx context.Context, tenantID, sourceID string, l, o int) ([]models.JobSourceEvent, error) {
	return f.events, nil
}
func (f *fakeRepo) UpdateEventStatus(ctx context.Context, tenantID, id, status, jobID, err string) error {
	return nil
}
func (f *fakeRepo) GetByID(ctx context.Context, tenantID, id string) (*models.JobSource, error) {
	if f.getErr != nil {
		return nil, f.getErr
	}
	if m, ok := f.byID[id]; ok {
		return m, nil
	}
	// The repository wraps sql.ErrNoRows into this sentinel, so the fake has to
	// answer the same thing: the handler's 404 branch is selected by identity.
	return nil, sentinel.NotFound
}
func (f *fakeRepo) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if f.updateErr != nil {
		return f.updateErr
	}
	f.updatedID = id
	f.updatedTenan = tenantID
	f.updated = append(f.updated, updates)
	return nil
}
func (f *fakeRepo) CreateEvent(ctx context.Context, e *models.JobSourceEvent) error {
	if f.createErr != nil {
		return f.createErr
	}
	f.events = append(f.events, *e)
	return nil
}

func (f *fakeRepo) withSource(id string, enabled bool) *fakeRepo {
	f.byID = map[string]*models.JobSource{id: {ID: id, Enabled: enabled, Status: "active"}}
	return f
}

func svc(t *testing.T, f *fakeRepo) *Service {
	t.Helper()
	return NewService(f, zaptest.NewLogger(t))
}

// An empty body is a client mistake, not a fault. The repository must not be
// touched at all: there is nothing to write and no row to read back.
func TestService_UpdateSource_EmptyRequestReturnsSentinelWithoutTouchingRepo(t *testing.T) {
	f := &fakeRepo{}
	got, err := svc(t, f).UpdateSource(context.Background(), "t1", "id-1", models.UpdateJobSourceRequest{})
	if !errors.Is(err, ErrNoFieldsToUpdate) {
		t.Fatalf("want ErrNoFieldsToUpdate, got %v", err)
	}
	if err == nil || got != nil {
		t.Fatalf("want nil result with an error, got %+v / %v", got, err)
	}
	if len(f.updated) != 0 {
		t.Errorf("empty request still wrote to the repository: %v", f.updated)
	}
	if len(f.events) != 0 {
		t.Errorf("empty update still created events: %v", f.events)
	}
}

func TestService_UpdateSource_BuildsOnlyTheFieldsTheCallerSent(t *testing.T) {
	f := (&fakeRepo{}).withSource("id-9", false)
	name := "renamed"
	cfg := map[string]string{"url": "https://x", "cron": "0 1 * * *"}
	enabled := false
	got, err := svc(t, f).UpdateSource(context.Background(), "t1", "id-9", models.UpdateJobSourceRequest{
		Name:    &name,
		Config:  &cfg,
		Enabled: &enabled,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got == nil || got.ID != "id-9" {
		t.Errorf("want the stored row read back after the update, got %+v", got)
	}
	if len(f.updated) != 1 {
		t.Fatalf("want exactly one Update call, got %d", len(f.updated))
	}
	u := f.updated[0]
	if f.updatedID != "id-9" || f.updatedTenan != "t1" {
		t.Errorf("Update scoped to %q / %q, want id-9 / t1", f.updatedTenan, f.updatedID)
	}
	if u["name"] != "renamed" {
		t.Errorf("name = %v", u["name"])
	}
	if u["type"] != nil {
		t.Errorf("type must not be set, the caller did not send it: %v", u["type"])
	}
	if u["enabled"] != false {
		t.Errorf("enabled = %v, want false", u["enabled"])
	}
	if u["status"] != "disabled" {
		t.Errorf("status = %v, want disabled", u["status"])
	}
	wantCfg := `{"cron":"0 1 * * *","url":"https://x"}`
	if u["config"] != wantCfg {
		t.Errorf("config = %q, want %q", u["config"], wantCfg)
	}
	if u["updated_at"] != nil {
		t.Errorf("the service must not set updated_at; the repository owns it: %v", u["updated_at"])
	}
	if u["id"] != nil || u["tenant_id"] != nil {
		t.Errorf("the row identity must not be settable: id=%v tenant_id=%v", u["id"], u["tenant_id"])
	}
}

func TestService_UpdateSource_ReEnablingRestoresActiveStatus(t *testing.T) {
	f := (&fakeRepo{}).withSource("id-1", false)
	enabled := true
	if _, err := svc(t, f).UpdateSource(context.Background(), "t1", "id-1",
		models.UpdateJobSourceRequest{Enabled: &enabled}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if f.updated[0]["status"] != "active" {
		t.Errorf("re-enable sets status=%v, want active", f.updated[0]["status"])
	}
}

func TestService_UpdateSource_RepositoryErrorIsNotSwallowed(t *testing.T) {
	want := errors.New("disk full")
	f := &fakeRepo{updateErr: want}
	name := "n"
	got, err := svc(t, f).UpdateSource(context.Background(), "t1", "id-1",
		models.UpdateJobSourceRequest{Name: &name})
	if !errors.Is(err, want) {
		t.Fatalf("want the repository error, got %v", err)
	}
	if err == nil || got != nil {
		t.Fatalf("want nil result with an error, got %+v / %v", got, err)
	}
}

func TestService_UpdateSource_ReturnsTheRowItJustChanged(t *testing.T) {
	f := (&fakeRepo{}).withSource("id-1", true)
	f.byID["id-1"].Name = "old"
	name := "new"
	got, err := svc(t, f).UpdateSource(context.Background(), "t1", "id-1",
		models.UpdateJobSourceRequest{Name: &name})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got == nil || got.ID != "id-1" {
		t.Fatalf("want the stored row back, got %+v", got)
	}
}

// A disabled source refuses a trigger without inserting an event. That matters
// because the event table is the audit trail: a phantom "received" row would
// look like a delivery that never happened.
func TestService_TriggerSource_DisabledSourceReturnsSentinelWithoutInserting(t *testing.T) {
	f := (&fakeRepo{}).withSource("id-1", false)
	got, err := svc(t, f).TriggerSource(context.Background(), "t1", "id-1", map[string]interface{}{"a": 1})
	if !errors.Is(err, ErrSourceDisabled) {
		t.Fatalf("want ErrSourceDisabled, got %v", err)
	}
	if err == nil || got != nil {
		t.Fatalf("want nil result with an error, got %+v / %v", got, err)
	}
	if len(f.events) != 0 {
		t.Errorf("a disabled source still wrote events: %v", f.events)
	}
}

func TestService_TriggerSource_NilPayloadIsStoredAsAnEmptyObject(t *testing.T) {
	f := (&fakeRepo{}).withSource("id-1", true)
	if _, err := svc(t, f).TriggerSource(context.Background(), "t1", "id-1", nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(f.events) != 1 {
		t.Fatalf("want one event, got %d", len(f.events))
	}
	e := f.events[0]
	if e.Payload != "{}" {
		t.Errorf("nil payload stored as %q, want {} (json.Marshal(nil) yields \"null\")", e.Payload)
	}
	if e.SourceID != "id-1" || e.TenantID != "t1" {
		t.Errorf("event scoped to %q / %q, want id-1 / t1", e.SourceID, e.TenantID)
	}
	if e.Status != "received" {
		t.Errorf("status = %q, want received", e.Status)
	}
	if e.ReceivedAt.IsZero() {
		t.Error("received_at left unset")
	}
}

func TestService_TriggerSource_AbsolutePayloadRoundTrips(t *testing.T) {
	f := (&fakeRepo{}).withSource("id-1", true)
	if _, err := svc(t, f).TriggerSource(context.Background(), "t1", "id-1",
		map[string]interface{}{"run": 7}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if f.events[0].Payload != `{"run":7}` {
		t.Errorf("payload = %q, want {\"run\":7}", f.events[0].Payload)
	}
}

func TestService_TriggerSource_NotFoundPropagatesToTheCaller(t *testing.T) {
	f := &fakeRepo{getErr: ErrNoFieldsToUpdate}
	// any non-nil error from the repository must surface unchanged: the handler
	// distinguishes ErrSourceDisabled from everything else, so a substituted
	// error would answer the wrong status code.
	got, err := svc(t, f).TriggerSource(context.Background(), "t1", "missing", nil)
	if err == nil || got != nil {
		t.Fatalf("want the repository error, got %+v / %v", got, err)
	}
	if errors.Is(err, ErrSourceDisabled) {
		t.Error("a repository error must not be reported as a disabled source")
	}
	if len(f.events) != 0 {
		t.Errorf("an absent source still wrote events: %v", f.events)
	}
}

func TestService_TriggerSource_CreateEventErrorPropagates(t *testing.T) {
	want := errors.New("no such column")
	f := (&fakeRepo{}).withSource("id-1", true)
	f.createErr = want
	got, err := svc(t, f).TriggerSource(context.Background(), "t1", "id-1", nil)
	if !errors.Is(err, want) {
		t.Fatalf("want the repository error, got %v", err)
	}
	if err == nil || got != nil {
		t.Fatalf("want nil result with an error, got %+v / %v", got, err)
	}
}

func TestService_GetSourceEvents_DelegatesToTheRepository(t *testing.T) {
	f := &fakeRepo{events: []models.JobSourceEvent{{ID: "e1"}}}
	items, err := svc(t, f).GetSourceEvents(context.Background(), "t1", "id-1", 20, 5)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 1 || items[0].ID != "e1" {
		t.Fatalf("events = %+v", items)
	}
}
