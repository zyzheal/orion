package service_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"database/sql"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"

	"orion/platform-svc-go/internal/alert-adapter-v2/repository"
	"orion/platform-svc-go/internal/alert-adapter-v2/service"
)

// probeHandler records every config it is initialised with and every send it
// performs, so a test can observe exactly what the factory handed it.
type probeHandler struct {
	ch    string
	probe *probe
	cfg   map[string]string
}

type probe struct {
	mu        sync.Mutex
	ctorCount int
	inits     []map[string]string
	sendCalls []probeSend
}

type probeSend struct {
	template  string
	variables map[string]string
	config    map[string]string // the config the instance held at send time
}

func (p *probe) copy() []map[string]string {
	p.mu.Lock()
	defer p.mu.Unlock()
	out := make([]map[string]string, 0, len(p.inits))
	for _, m := range p.inits {
		c := make(map[string]string, len(m))
		for k, v := range m {
			c[k] = v
		}
		out = append(out, c)
	}
	return out
}

func (p *probe) ctorCalls() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.ctorCount
}

func (p *probe) sends() []probeSend {
	p.mu.Lock()
	defer p.mu.Unlock()
	out := make([]probeSend, len(p.sendCalls))
	copy(out, p.sendCalls)
	return out
}

func (p *probe) newCtor() service.HandlerConstructor {
	return func() service.INotificationHandler {
		p.mu.Lock()
		p.ctorCount++
		p.mu.Unlock()
		return &probeHandler{ch: "email", probe: p}
	}
}

func (h *probeHandler) Channel() string { return h.ch }
func (h *probeHandler) ValidateConfig(_ context.Context, _ map[string]string) error {
	return nil
}
func (h *probeHandler) Initialize(_ context.Context, cfg map[string]string) error {
	h.probe.mu.Lock()
	cp := make(map[string]string, len(cfg))
	for k, v := range cfg {
		cp[k] = v
	}
	h.probe.inits = append(h.probe.inits, cp)
	h.probe.mu.Unlock()
	h.cfg = cp
	return nil
}
func (h *probeHandler) Send(_ context.Context, tpl string, vars map[string]string) error {
	h.probe.mu.Lock()
	cfg := make(map[string]string, len(h.cfg))
	for k, v := range h.cfg {
		cfg[k] = v
	}
	h.probe.sendCalls = append(h.probe.sendCalls, probeSend{template: tpl, variables: vars, config: cfg})
	h.probe.mu.Unlock()
	return nil
}

func newMockFactory(t *testing.T, db *sql.DB) *service.NotificationFactory {
	t.Helper()
	return service.NewFactory(repository.NewRepository(sqlx.NewDb(db, "sqlmock")), zap.NewNop())
}

func expectAdapter(mock sqlmock.Sqlmock, id, channel, config, status string) {
	mock.ExpectQuery("SELECT \\* FROM alert_notification_adapters WHERE id").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "channel", "config", "status", "error", "enabled", "created_at", "updated_at",
		}).AddRow(id, "tenant-1", "adapter-"+id, channel, config, status, "", true, time.Now(), time.Now()))
}

func expectTemplate(mock sqlmock.Sqlmock, id, template string) {
	mock.ExpectQuery("SELECT \\* FROM alert_notification_templates WHERE id").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "channel", "template", "variables", "created_at",
		}).AddRow(id, "tenant-1", "tpl", "email", template, "{}", time.Now()))
}

func expectEventCreate(mock sqlmock.Sqlmock) {
	mock.ExpectExec("INSERT INTO alert_notification_events").WillReturnResult(sqlmock.NewResult(1, 1))
}

func expectEventDelivered(mock sqlmock.Sqlmock) {
	mock.ExpectExec("UPDATE alert_notification_events SET status='delivered'").WillReturnResult(sqlmock.NewResult(1, 1))
}

func expectEventFailed(mock sqlmock.Sqlmock) {
	mock.ExpectExec("UPDATE alert_notification_events SET status='failed'").WillReturnResult(sqlmock.NewResult(1, 1))
}

// TestSendNotificationInitialisesFreshHandlerFromAdapterConfig is the
// regression test for the two defects fixed in SendNotification's dispatch
// step: the factory returned an unconfigured handler, and SendNotification
// never called Initialize. Without the Initialize call the handler's own
// Send would fail with ErrMissingRequiredConfig for every correctly
// configured adapter.
func TestSendNotificationInitialisesFreshHandlerFromAdapterConfig(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	config := `{"gateway":"https://gw.example/sms","api_key":"secret"}`
	expectAdapter(mock, "adapter-1", "email", config, "enabled")
	expectTemplate(mock, "tpl-1", "alert {{alert_name}} for {{service}}")
	expectEventCreate(mock)
	expectEventDelivered(mock)

	p := &probe{}
	f := newMockFactory(t, db)
	f.RegisterConstructor("email", p.newCtor())

	ev, err := f.SendNotification(context.Background(), "tenant-1", "adapter-1", "tpl-1", "alert-9",
		map[string]string{"alert_name": "cpu-high", "service": "checkout"})
	if err != nil {
		t.Fatalf("SendNotification: %v", err)
	}

	if p.ctorCalls() != 1 {
		t.Fatalf("constructor was called %d times, want 1 (one fresh handler per send)", p.ctorCalls())
	}
	inits := p.copy()
	if len(inits) != 1 {
		t.Fatalf("handler was initialised %d times, want exactly 1: %v", len(inits), inits)
	}
	if inits[0]["gateway"] != "https://gw.example/sms" {
		t.Errorf("handler config gateway = %q, want the value from the adapter's stored config", inits[0]["gateway"])
	}
	if inits[0]["api_key"] != "secret" {
		t.Errorf("handler config api_key = %q, want secret", inits[0]["api_key"])
	}

	sends := p.sends()
	if len(sends) != 1 {
		t.Fatalf("handler was asked to send %d times, want 1", len(sends))
	}
	if sends[0].template != "alert cpu-high for checkout" {
		t.Errorf("template was not rendered with the caller's variables: %q", sends[0].template)
	}
	if sends[0].variables["alert_name"] != "cpu-high" {
		t.Errorf("variables were not passed to Send: %v", sends[0].variables)
	}

	if ev == nil || ev.Status != "delivered" {
		t.Fatalf("event status = %v, want delivered", ev)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet repository expectations: %v", err)
	}
}

// TestConstructorRegistryKeepsAdapterConfigsSeparate proves that two adapters
// on the same channel do not share a handler instance, which is why the
// factory registers constructors instead of singletons.
func TestConstructorRegistryKeepsAdapterConfigsSeparate(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	configs := map[string]string{
		"adapter-a": `{"gateway":"https://gw-a.example"}`,
		"adapter-b": `{"gateway":"https://gw-b.example"}`,
	}
	for _, id := range []string{"adapter-a", "adapter-b"} {
		expectAdapter(mock, id, "email", configs[id], "enabled")
		expectTemplate(mock, "tpl-1", "hello")
		expectEventCreate(mock)
		expectEventDelivered(mock)
	}

	p := &probe{}
	f := newMockFactory(t, db)
	f.RegisterConstructor("email", p.newCtor())

	for _, id := range []string{"adapter-a", "adapter-b"} {
		if _, err := f.SendNotification(context.Background(), "tenant-1", id, "tpl-1", "alert-1", nil); err != nil {
			t.Fatalf("SendNotification(%s): %v", id, err)
		}
	}

	if p.ctorCalls() != 2 {
		t.Fatalf("constructor was called %d times for 2 sends, want 2 (fresh instance each time)", p.ctorCalls())
	}
	inits := p.copy()
	if len(inits) != 2 {
		t.Fatalf("got %d initialisations, want 2: %v", len(inits), inits)
	}
	if inits[0]["gateway"] != "https://gw-a.example" || inits[1]["gateway"] != "https://gw-b.example" {
		t.Errorf("adapter configs were mixed up: %v", inits)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet repository expectations: %v", err)
	}
}

// TestSharedSingletonAccumulatesOtherAdaptersConfig demonstrates the defect
// the constructor registry exists to prevent. A handler registered with
// Register is one shared instance, so every adapter created on that channel
// initialises the same object: adapter A's config is overwritten by adapter B's
// before A has sent a single notification. The per-send Initialize in
// SendNotification masks the dispatch, but the shared state is still there,
// which is why production wiring uses RegisterConstructor.
func TestSharedSingletonAccumulatesOtherAdaptersConfig(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	shared := &probeHandler{ch: "email", probe: &probe{}}

	// CreateAdapter(a)
	mock.ExpectExec("INSERT INTO alert_notification_adapters").WillReturnResult(sqlmock.NewResult(1, 1))
	// CreateAdapter(b)
	mock.ExpectExec("INSERT INTO alert_notification_adapters").WillReturnResult(sqlmock.NewResult(1, 1))
	// SendNotification(a)
	expectAdapter(mock, "adapter-1", "email", `{"gateway":"https://gw-a.example"}`, "enabled")
	expectTemplate(mock, "tpl-1", "hello")
	expectEventCreate(mock)
	expectEventDelivered(mock)

	f := newMockFactory(t, db)
	f.Register(shared)

	if _, err := f.CreateAdapter(context.Background(), "tenant-1", "a", "email", `{"gateway":"https://gw-a.example"}`); err != nil {
		t.Fatalf("CreateAdapter(a): %v", err)
	}
	if _, err := f.CreateAdapter(context.Background(), "tenant-1", "b", "email", `{"gateway":"https://gw-b.example"}`); err != nil {
		t.Fatalf("CreateAdapter(b): %v", err)
	}
	if _, err := f.SendNotification(context.Background(), "tenant-1", "adapter-1", "tpl-1", "alert-1", nil); err != nil {
		t.Fatalf("SendNotification(a): %v", err)
	}

	inits := shared.probe.copy()
	if len(inits) != 3 {
		t.Fatalf("the shared handler was initialised %d times, want 3 (two creates plus one send): %v", len(inits), inits)
	}
	for _, got := range []string{"https://gw-a.example", "https://gw-b.example"} {
		if !containsGateway(inits, got) {
			t.Errorf("shared handler never carried %q; expected it to have been overwritten across adapters", got)
		}
	}
	if inits[1]["gateway"] == inits[0]["gateway"] {
		t.Errorf("adapter b's config did not overwrite adapter a's on the shared instance")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet repository expectations: %v", err)
	}
}

func containsGateway(inits []map[string]string, gateway string) bool {
	for _, m := range inits {
		if m["gateway"] == gateway {
			return true
		}
	}
	return false
}

// TestSendNotificationFailsLoudlyForUnregisteredChannel pins that a channel
// with no implementation (push, kafka, phone, rabbitmq) fails instead of
// recording a delivery nobody received.
func TestSendNotificationFailsLoudlyForUnregisteredChannel(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	expectAdapter(mock, "adapter-1", "push", `{}`, "enabled")
	expectTemplate(mock, "tpl-1", "hello")
	expectEventCreate(mock)
	expectEventFailed(mock)

	f := newMockFactory(t, db)

	_, err = f.SendNotification(context.Background(), "tenant-1", "adapter-1", "tpl-1", "alert-1", nil)
	if err == nil {
		t.Fatal("SendNotification succeeded for an unimplemented channel")
	}
	if !errors.Is(err, service.ErrInitFailed) || !errors.Is(err, service.ErrNoHandler) {
		t.Fatalf("err = %v, want ErrInitFailed wrapping ErrNoHandler", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet repository expectations: %v", err)
	}
}
