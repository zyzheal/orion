package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"orion/platform-svc-go/internal/notification/models"
	"orion/platform-svc-go/internal/notification/notification-engine"
)

// ---------------------------------------------------------------------------
// fakes
// ---------------------------------------------------------------------------

var errFakeNotFound = errors.New("not found")

// fakeDeliveryStore is an in-memory delivery table implementing deliveryStore.
// It keeps pointers so UpdateStatus/IncrementAttempt are visible to callers that
// hold the record returned by CreateDelivery.
type fakeDeliveryStore struct {
	createErr    error
	updateErr    error
	incrementErr error
	records      []*models.NotificationDelivery
	updates      int
	increments   int
	exhausted    int
}

func (f *fakeDeliveryStore) CreateDelivery(_ context.Context, d *models.NotificationDelivery) error {
	if f.createErr != nil {
		return f.createErr
	}
	if d.ID == "" {
		d.ID = "dlv-fake-" + d.NotificationID
	}
	f.records = append(f.records, d)
	return nil
}

func (f *fakeDeliveryStore) UpdateStatus(_ context.Context, d *models.NotificationDelivery) error {
	f.updates++
	if f.updateErr != nil {
		return f.updateErr
	}
	if prev := f.lookup(d.ID); prev != nil {
		*prev = *d
	}
	return nil
}

func (f *fakeDeliveryStore) FindByID(_ context.Context, tenantID, id string) (*models.NotificationDelivery, error) {
	d := f.lookupByIDAndTenant(id, tenantID)
	if d == nil {
		return nil, errFakeNotFound
	}
	c := *d
	return &c, nil
}

func (f *fakeDeliveryStore) FindByNotificationID(_ context.Context, tenantID, notificationID string) ([]models.NotificationDelivery, error) {
	var out []models.NotificationDelivery
	for _, d := range f.records {
		if d.TenantID == tenantID && d.NotificationID == notificationID {
			out = append(out, *d)
		}
	}
	return out, nil
}

func (f *fakeDeliveryStore) FindPendingForRetry(_ context.Context, tenantID string, limit int) ([]models.NotificationDelivery, error) {
	var out []models.NotificationDelivery
	for _, d := range f.records {
		if d.TenantID == tenantID && d.Status == models.DeliveryStatusFailed && d.NextRetryAt != nil {
			out = append(out, *d)
			if limit > 0 && len(out) >= limit {
				break
			}
		}
	}
	return out, nil
}

func (f *fakeDeliveryStore) IncrementAttempt(_ context.Context, tenantID, id string) (*models.NotificationDelivery, error) {
	f.increments++
	if f.incrementErr != nil {
		return nil, f.incrementErr
	}
	d := f.lookupByIDAndTenant(id, tenantID)
	if d == nil {
		return nil, errFakeNotFound
	}
	d.AttemptNumber++
	d.Status = models.DeliveryStatusRetrying
	c := *d
	return &c, nil
}

func (f *fakeDeliveryStore) MarkExhausted(_ context.Context, tenantID, id, lastError string) (*models.NotificationDelivery, error) {
	f.exhausted++
	d := f.lookupByIDAndTenant(id, tenantID)
	if d == nil {
		return nil, errFakeNotFound
	}
	d.Status = models.DeliveryStatusExhausted
	msg := lastError
	d.ErrorMessage = &msg
	c := *d
	return &c, nil
}

func (f *fakeDeliveryStore) Count(_ context.Context, tenantID, notificationID string, status models.DeliveryStatus) (int, error) {
	n := 0
	for _, d := range f.records {
		if d.TenantID == tenantID && d.NotificationID == notificationID && d.Status == status {
			n++
		}
	}
	return n, nil
}

func (f *fakeDeliveryStore) lookup(id string) *models.NotificationDelivery {
	for _, d := range f.records {
		if d.ID == id {
			return d
		}
	}
	return nil
}

func (f *fakeDeliveryStore) lookupByIDAndTenant(id, tenantID string) *models.NotificationDelivery {
	for _, d := range f.records {
		if d.ID == id && d.TenantID == tenantID {
			return d
		}
	}
	return nil
}

type fakeNotificationStore struct {
	n     *models.Notification
	err   error
	calls int
}

func (f *fakeNotificationStore) GetNotification(_ context.Context, _, _ string) (*models.Notification, error) {
	f.calls++
	return f.n, f.err
}

// fakeChannel records the messages it was asked to send.
type fakeChannel struct {
	typ     models.ChannelType
	healthy bool
	sent    []*engine.NotifyMessage
	err     error
	result  *engine.SendResult
	// nilResult makes Execute return (nil, nil), exercising the service's
	// guard against a channel that reports neither a result nor an error.
	nilResult bool
}

func (c *fakeChannel) Type() models.ChannelType { return c.typ }
func (c *fakeChannel) Healthy() bool            { return c.healthy }
func (c *fakeChannel) Execute(_ context.Context, msg *engine.NotifyMessage) (*engine.SendResult, error) {
	c.sent = append(c.sent, msg)
	if c.err != nil {
		return nil, c.err
	}
	if c.nilResult {
		return nil, nil
	}
	if c.result != nil {
		return c.result, nil
	}
	return &engine.SendResult{Success: true, MessageID: "msg-1"}, nil
}

func testNotification() *models.Notification {
	return &models.Notification{
		ID: "n-1", TenantID: "t1", UserID: "u1", Type: "ALERT_CREATED",
		Title: "Disk full", Channel: models.ChannelEmail, Recipient: "a@b.com",
		Subject: "Disk full", Body: "usage 98%",
	}
}

func noChannelsFactory() func(models.ChannelType) (engine.NotifyChannel, bool) {
	return func(models.ChannelType) (engine.NotifyChannel, bool) { return nil, false }
}

// ---------------------------------------------------------------------------
// DeliverNotification
// ---------------------------------------------------------------------------

func TestDeliverNotification_NilSourceReturnsEmpty(t *testing.T) {
	svc := NewDeliveryService(nil, nil)
	got, err := svc.DeliverNotification(context.Background(), "t1", "missing")
	if err != nil {
		t.Fatalf("DeliverNotification: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected no deliveries with an unwired notification source, got %d", len(got))
	}
}

func TestDeliverNotification_SendsAndPersists(t *testing.T) {
	email := &fakeChannel{typ: models.ChannelEmail, healthy: true}
	store := &fakeDeliveryStore{}
	svc := NewDeliveryService(nil, nil).
		WithNotificationSource(&fakeNotificationStore{n: testNotification()}).
		WithDeliveryStore(store).
		WithChannelFactory(func(ch models.ChannelType) (engine.NotifyChannel, bool) {
			if ch == models.ChannelEmail {
				return email, true
			}
			return nil, false
		})

	got, err := svc.DeliverNotification(context.Background(), "t1", "n-1")
	if err != nil {
		t.Fatalf("DeliverNotification: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 delivery record, got %d", len(got))
	}
	d := got[0]
	if d.NotificationID != "n-1" || d.Channel != models.DeliveryChannelEmail || d.Status != models.DeliveryStatusSent {
		t.Errorf("unexpected delivery: id=%s channel=%s status=%s", d.NotificationID, d.Channel, d.Status)
	}
	if d.Recipient != "a@b.com" || d.Subject != "Disk full" || d.Body != "usage 98%" {
		t.Errorf("payload not carried over: %+v", d)
	}
	if d.SentAt == nil {
		t.Error("sent delivery must carry SentAt")
	}
	if d.ErrorMessage != nil {
		t.Errorf("successful delivery must not carry an error: %s", *d.ErrorMessage)
	}
	if d.NextRetryAt != nil {
		t.Errorf("successful delivery must not schedule a retry: %v", d.NextRetryAt)
	}
	if d.AttemptNumber != 1 || d.MaxAttempts != defaultMaxAttempts {
		t.Errorf("attempt %d/%d, want 1/%d", d.AttemptNumber, d.MaxAttempts, defaultMaxAttempts)
	}
	if len(email.sent) != 1 || email.sent[0].Recipient != "a@b.com" || email.sent[0].Content != "usage 98%" {
		t.Errorf("channel did not receive the message: %+v", email.sent)
	}
	if store.updates != 1 {
		t.Errorf("expected 1 status update, got %d", store.updates)
	}
}

func TestDeliverNotification_FallsBackOnChannelFailure(t *testing.T) {
	email := &fakeChannel{typ: models.ChannelEmail, err: errors.New("smtp down")}
	inApp := &fakeChannel{typ: models.ChannelInApp}
	store := &fakeDeliveryStore{}
	svc := NewDeliveryService(nil, nil).
		WithNotificationSource(&fakeNotificationStore{n: testNotification()}).
		WithDeliveryStore(store).
		WithChannelFactory(func(ch models.ChannelType) (engine.NotifyChannel, bool) {
			switch ch {
			case models.ChannelEmail:
				return email, true
			case models.ChannelInApp:
				return inApp, true
			}
			return nil, false
		})

	got, err := svc.DeliverNotification(context.Background(), "t1", "n-1")
	if err != nil {
		t.Fatalf("DeliverNotification: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 delivery record, got %d", len(got))
	}
	if got[0].Status != models.DeliveryStatusSent {
		t.Errorf("status = %s, want sent via fallback", got[0].Status)
	}
	if len(email.sent) != 1 {
		t.Errorf("primary channel should still have been attempted, sent=%d", len(email.sent))
	}
	if len(inApp.sent) != 1 {
		t.Error("fallback channel was not used")
	}
}

func TestDeliverNotification_RecordsFailureWhenNoHandler(t *testing.T) {
	store := &fakeDeliveryStore{}
	svc := NewDeliveryService(nil, nil).
		WithNotificationSource(&fakeNotificationStore{n: testNotification()}).
		WithDeliveryStore(store).
		WithChannelFactory(noChannelsFactory())

	got, err := svc.DeliverNotification(context.Background(), "t1", "n-1")
	if err != nil {
		t.Fatalf("DeliverNotification: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected a failed delivery record, got %d", len(got))
	}
	if got[0].Status != models.DeliveryStatusFailed {
		t.Errorf("status = %s, want failed", got[0].Status)
	}
	if got[0].ErrorMessage == nil {
		t.Error("failed delivery must record its error")
	}
	if got[0].NextRetryAt == nil {
		t.Error("failed delivery must schedule a retry")
	}
	if got[0].SentAt != nil {
		t.Error("failed delivery must not claim SentAt")
	}
	if got[0].FallbackChannel == nil || *got[0].FallbackChannel != models.ChannelInApp {
		t.Errorf("fallback_channel = %v, want in_app", got[0].FallbackChannel)
	}
	if got[0].MaxAttempts != defaultMaxAttempts {
		t.Errorf("max_attempts = %d, want %d", got[0].MaxAttempts, defaultMaxAttempts)
	}
}

func TestDeliverNotification_PreservesErrorWhenNoFallbackMapped(t *testing.T) {
	// "slack" has no fallback mapping, so the channel's own failure detail is
	// what ends up on the delivery record.
	slack := &fakeChannel{typ: models.ChannelSlack, result: &engine.SendResult{Success: false, Error: "http 502"}}
	store := &fakeDeliveryStore{}
	svc := NewDeliveryService(nil, nil).
		WithNotificationSource(&fakeNotificationStore{
			n: &models.Notification{ID: "n-2", TenantID: "t1", Channel: models.ChannelSlack, Recipient: "https://x"},
		}).
		WithDeliveryStore(store).
		WithChannelFactory(func(ch models.ChannelType) (engine.NotifyChannel, bool) {
			if ch == models.ChannelSlack {
				return slack, true
			}
			return nil, false
		})

	got, err := svc.DeliverNotification(context.Background(), "t1", "n-2")
	if err != nil {
		t.Fatalf("DeliverNotification: %v", err)
	}
	if len(got) != 1 || got[0].Status != models.DeliveryStatusFailed {
		t.Fatalf("expected a failed record, got %+v", got)
	}
	if got[0].ErrorMessage == nil || *got[0].ErrorMessage != "http 502" {
		t.Errorf("error = %v, want the channel's failure detail", got[0].ErrorMessage)
	}
	if got[0].FallbackChannel != nil {
		t.Errorf("fallback_channel = %v, want nil for an unmapped channel", got[0].FallbackChannel)
	}
}

func TestDeliverNotification_NilResultCountsAsFailure(t *testing.T) {
	store := &fakeDeliveryStore{}
	svc := NewDeliveryService(nil, nil).
		WithNotificationSource(&fakeNotificationStore{n: testNotification()}).
		WithDeliveryStore(store).
		WithChannelFactory(func(ch models.ChannelType) (engine.NotifyChannel, bool) {
			if ch == models.ChannelEmail {
				return &fakeChannel{typ: models.ChannelEmail, nilResult: true}, true
			}
			return nil, false
		})

	got, err := svc.DeliverNotification(context.Background(), "t1", "n-1")
	if err != nil {
		t.Fatalf("DeliverNotification: %v", err)
	}
	if got[0].Status != models.DeliveryStatusFailed {
		t.Errorf("status = %s, want failed for a nil SendResult", got[0].Status)
	}
}

func TestDeliverNotification_FallsBackWhenPrimaryUnregistered(t *testing.T) {
	// The primary channel has no handler at all, but the fallback does.
	inApp := &fakeChannel{typ: models.ChannelInApp}
	svc := NewDeliveryService(nil, nil).
		WithNotificationSource(&fakeNotificationStore{n: testNotification()}).
		WithDeliveryStore(&fakeDeliveryStore{}).
		WithChannelFactory(func(ch models.ChannelType) (engine.NotifyChannel, bool) {
			if ch == models.ChannelInApp {
				return inApp, true
			}
			return nil, false
		})

	got, err := svc.DeliverNotification(context.Background(), "t1", "n-1")
	if err != nil {
		t.Fatalf("DeliverNotification: %v", err)
	}
	if got[0].Status != models.DeliveryStatusSent {
		t.Errorf("status = %s, want sent via fallback", got[0].Status)
	}
	if len(inApp.sent) != 1 {
		t.Error("fallback channel was not used")
	}
}

func TestDeliverNotification_LookupError(t *testing.T) {
	svc := NewDeliveryService(nil, nil).
		WithNotificationSource(&fakeNotificationStore{err: errors.New("db down")})
	if _, err := svc.DeliverNotification(context.Background(), "t1", "n-1"); err == nil {
		t.Fatal("expected lookup error to propagate")
	}
}

func TestDeliverNotification_PersistError(t *testing.T) {
	svc := NewDeliveryService(nil, nil).
		WithNotificationSource(&fakeNotificationStore{n: testNotification()}).
		WithDeliveryStore(&fakeDeliveryStore{createErr: errors.New("insert failed")}).
		WithChannelFactory(func(ch models.ChannelType) (engine.NotifyChannel, bool) {
			if ch == models.ChannelEmail {
				return &fakeChannel{typ: models.ChannelEmail}, true
			}
			return nil, false
		})
	if _, err := svc.DeliverNotification(context.Background(), "t1", "n-1"); err == nil {
		t.Fatal("expected persistence error to propagate")
	}
}

func TestDeliverNotification_StatusUpdateErrorPropagates(t *testing.T) {
	svc := NewDeliveryService(nil, nil).
		WithNotificationSource(&fakeNotificationStore{n: testNotification()}).
		WithDeliveryStore(&fakeDeliveryStore{updateErr: errors.New("update failed")}).
		WithChannelFactory(func(ch models.ChannelType) (engine.NotifyChannel, bool) {
			if ch == models.ChannelEmail {
				return &fakeChannel{typ: models.ChannelEmail}, true
			}
			return nil, false
		})
	if _, err := svc.DeliverNotification(context.Background(), "t1", "n-1"); err == nil {
		t.Fatal("expected the UpdateStatus error to propagate")
	}
}

func TestDeliverNotification_FallsBackOnExecuteError(t *testing.T) {
	// Execute returning an error (not just a failed SendResult) must also fall back.
	email := &fakeChannel{typ: models.ChannelEmail, err: errors.New("connection refused")}
	inApp := &fakeChannel{typ: models.ChannelInApp}
	svc := NewDeliveryService(nil, nil).
		WithNotificationSource(&fakeNotificationStore{n: testNotification()}).
		WithDeliveryStore(&fakeDeliveryStore{}).
		WithChannelFactory(func(ch models.ChannelType) (engine.NotifyChannel, bool) {
			if ch == models.ChannelEmail {
				return email, true
			}
			if ch == models.ChannelInApp {
				return inApp, true
			}
			return nil, false
		})
	got, err := svc.DeliverNotification(context.Background(), "t1", "n-1")
	if err != nil {
		t.Fatalf("DeliverNotification: %v", err)
	}
	if got[0].Status != models.DeliveryStatusSent {
		t.Errorf("status = %s, want sent via fallback after an Execute error", got[0].Status)
	}
	if len(inApp.sent) != 1 {
		t.Error("fallback channel was not used")
	}
}

func TestDeliverNotification_RecordsFinalAttemptError(t *testing.T) {
	svc := NewDeliveryService(nil, nil).
		WithNotificationSource(&fakeNotificationStore{n: testNotification()}).
		WithDeliveryStore(&fakeDeliveryStore{}).
		WithChannelFactory(noChannelsFactory())

	got, err := svc.DeliverNotification(context.Background(), "t1", "n-1")
	if err != nil {
		t.Fatalf("DeliverNotification: %v", err)
	}
	if got[0].Status != models.DeliveryStatusFailed {
		t.Errorf("status = %s, want failed", got[0].Status)
	}
	if got[0].ErrorMessage == nil {
		t.Fatal("failed delivery must record an error")
	}
	if *got[0].ErrorMessage != "no channel handler registered for \"in_app\"" {
		t.Errorf("error = %q, want the final (fallback) attempt's failure", *got[0].ErrorMessage)
	}
}

func TestDeliverNotification_RecipientFallsBackToUserID(t *testing.T) {
	email := &fakeChannel{typ: models.ChannelEmail}
	svc := NewDeliveryService(nil, nil).
		WithNotificationSource(&fakeNotificationStore{
			n: &models.Notification{ID: "n-3", TenantID: "t1", UserID: "u9", Channel: models.ChannelEmail},
		}).
		WithDeliveryStore(&fakeDeliveryStore{}).
		WithChannelFactory(func(ch models.ChannelType) (engine.NotifyChannel, bool) {
			if ch == models.ChannelEmail {
				return email, true
			}
			return nil, false
		})

	got, err := svc.DeliverNotification(context.Background(), "t1", "n-3")
	if err != nil {
		t.Fatalf("DeliverNotification: %v", err)
	}
	if email.sent[0].Recipient != "u9" {
		t.Errorf("recipient = %q, want the notification's user id", email.sent[0].Recipient)
	}
	if email.sent[0].Subject != "" {
		t.Errorf("subject = %q, want empty when the notification has no title", email.sent[0].Subject)
	}
	if got[0].Recipient != "u9" {
		t.Errorf("delivery recipient = %q, want u9", got[0].Recipient)
	}
}

// ---------------------------------------------------------------------------
// retry + history endpoints
// ---------------------------------------------------------------------------

func TestGetDeliveryHistory_RecordsWhatDeliverWrote(t *testing.T) {
	store := &fakeDeliveryStore{}
	email := &fakeChannel{typ: models.ChannelEmail}
	svc := NewDeliveryService(nil, nil).
		WithNotificationSource(&fakeNotificationStore{n: testNotification()}).
		WithDeliveryStore(store).
		WithChannelFactory(func(ch models.ChannelType) (engine.NotifyChannel, bool) {
			if ch == models.ChannelEmail {
				return email, true
			}
			return nil, false
		})
	if _, err := svc.DeliverNotification(context.Background(), "t1", "n-1"); err != nil {
		t.Fatalf("DeliverNotification: %v", err)
	}

	history, err := svc.GetDeliveryHistory(context.Background(), "t1", "n-1")
	if err != nil {
		t.Fatalf("GetDeliveryHistory: %v", err)
	}
	if len(history) != 1 || history[0].Status != models.DeliveryStatusSent {
		t.Fatalf("history = %+v, want one sent record", history)
	}

	pending, err := svc.GetPendingDeliveries(context.Background(), "t1", 10)
	if err != nil {
		t.Fatalf("GetPendingDeliveries: %v", err)
	}
	if len(pending) != 0 {
		t.Errorf("pending = %d, want 0 for a sent record", len(pending))
	}

	byID, err := svc.GetDeliveryByID(context.Background(), "t1", history[0].ID)
	if err != nil {
		t.Fatalf("GetDeliveryByID: %v", err)
	}
	if byID.NotificationID != "n-1" {
		t.Errorf("notification_id = %q", byID.NotificationID)
	}
}

func TestRetryDelivery_IncrementsAttempt(t *testing.T) {
	store := &fakeDeliveryStore{}
	store.records = append(store.records, &models.NotificationDelivery{
		ID: "d-1", TenantID: "t1", NotificationID: "n-1", Status: models.DeliveryStatusFailed,
		AttemptNumber: 1, MaxAttempts: 3,
	})
	svc := NewDeliveryService(nil, nil).WithDeliveryStore(store)

	got, err := svc.RetryDelivery(context.Background(), "t1", "d-1")
	if err != nil {
		t.Fatalf("RetryDelivery: %v", err)
	}
	if got.AttemptNumber != 2 {
		t.Errorf("attempt = %d, want 2", got.AttemptNumber)
	}
	if store.records[0].AttemptNumber != 2 {
		t.Errorf("store attempt = %d, want 2", store.records[0].AttemptNumber)
	}
	if store.increments != 1 || store.exhausted != 0 {
		t.Errorf("increments=%d exhausted=%d, want 1/0", store.increments, store.exhausted)
	}
}

func TestRetryDelivery_ExhaustedMarksAndRejects(t *testing.T) {
	store := &fakeDeliveryStore{}
	store.records = append(store.records, &models.NotificationDelivery{
		ID: "d-2", TenantID: "t1", NotificationID: "n-1", Status: models.DeliveryStatusRetrying,
		AttemptNumber: 3, MaxAttempts: 3,
	})
	svc := NewDeliveryService(nil, nil).WithDeliveryStore(store)

	_, err := svc.RetryDelivery(context.Background(), "t1", "d-2")
	if err == nil {
		t.Fatal("expected an exhaustion error")
	}
	if store.exhausted != 1 || store.increments != 0 {
		t.Errorf("exhausted=%d increments=%d, want 1/0", store.exhausted, store.increments)
	}
	if store.records[0].Status != models.DeliveryStatusExhausted {
		t.Errorf("status = %s, want exhausted", store.records[0].Status)
	}
	if store.records[0].ErrorMessage == nil {
		t.Error("exhausted delivery must keep its last error")
	}
}

func TestRetryDelivery_NotFound(t *testing.T) {
	svc := NewDeliveryService(nil, nil).WithDeliveryStore(&fakeDeliveryStore{})
	_, err := svc.RetryDelivery(context.Background(), "t1", "missing")
	if !errors.Is(err, ErrDeliveryNotFound) {
		t.Errorf("err = %v, want ErrDeliveryNotFound", err)
	}
}

func TestRetryDelivery_TenantIsolation(t *testing.T) {
	store := &fakeDeliveryStore{}
	store.records = append(store.records, &models.NotificationDelivery{
		ID: "d-3", TenantID: "t1", AttemptNumber: 1, MaxAttempts: 3, Status: models.DeliveryStatusFailed,
	})
	svc := NewDeliveryService(nil, nil).WithDeliveryStore(store)
	if _, err := svc.RetryDelivery(context.Background(), "other-tenant", "d-3"); !errors.Is(err, ErrDeliveryNotFound) {
		t.Errorf("cross-tenant retry leaked the record: %v", err)
	}
	if store.increments != 0 {
		t.Errorf("cross-tenant attempt must not mutate the record, increments=%d", store.increments)
	}
}

func TestGetDeliveryHistory_CrossTenantReturnsNothing(t *testing.T) {
	store := &fakeDeliveryStore{}
	store.records = append(store.records, &models.NotificationDelivery{
		ID: "d-4", TenantID: "t1", NotificationID: "n-1", Status: models.DeliveryStatusSent,
	})
	svc := NewDeliveryService(nil, nil).WithDeliveryStore(store)
	history, err := svc.GetDeliveryHistory(context.Background(), "t2", "n-1")
	if err != nil {
		t.Fatalf("GetDeliveryHistory: %v", err)
	}
	if len(history) != 0 {
		t.Errorf("leaked %d records across tenants", len(history))
	}
}

func TestGetDeliveryHistory_PendingRetryIsReturned(t *testing.T) {
	store := &fakeDeliveryStore{}
	when := time.Now().Add(30 * time.Second)
	store.records = append(store.records,
		&models.NotificationDelivery{ID: "d-5", TenantID: "t1", NotificationID: "n-1", Status: models.DeliveryStatusFailed, NextRetryAt: &when},
		&models.NotificationDelivery{ID: "d-6", TenantID: "t1", NotificationID: "n-1", Status: models.DeliveryStatusSent},
	)
	svc := NewDeliveryService(nil, nil).WithDeliveryStore(store)

	pending, err := svc.GetPendingDeliveries(context.Background(), "t1", 1)
	if err != nil {
		t.Fatalf("GetPendingDeliveries: %v", err)
	}
	if len(pending) != 1 || pending[0].ID != "d-5" {
		t.Errorf("pending = %+v, want only the retryable row", pending)
	}
}

func TestDeliveryStore_CountByStatus(t *testing.T) {
	store := &fakeDeliveryStore{}
	store.records = append(store.records,
		&models.NotificationDelivery{ID: "a", TenantID: "t1", NotificationID: "n-1", Status: models.DeliveryStatusSent},
		&models.NotificationDelivery{ID: "b", TenantID: "t1", NotificationID: "n-1", Status: models.DeliveryStatusFailed},
		&models.NotificationDelivery{ID: "c", TenantID: "t1", NotificationID: "other", Status: models.DeliveryStatusFailed},
	)
	n, err := store.Count(context.Background(), "t1", "n-1", models.DeliveryStatusFailed)
	if err != nil || n != 1 {
		t.Errorf("Count = %d, %v; want 1", n, err)
	}
}

func TestCalculateNextRetry_BackoffSteps(t *testing.T) {
	steps := []time.Duration{30 * time.Second, 5 * time.Minute, 30 * time.Minute}
	for i, want := range steps {
		got := CalculateNextRetry(i + 1)
		if diff := got.Sub(time.Now()); diff < want-time.Second || diff > want+time.Second {
			t.Errorf("attempt %d: delta %v, want ~%v", i+1, diff, want)
		}
	}
	// Out-of-range attempts clamp instead of panicking.
	if CalculateNextRetry(0).IsZero() || CalculateNextRetry(99).IsZero() {
		t.Error("out-of-range attempts must still produce a retry time")
	}
}

func TestResolveFallbackChannel(t *testing.T) {
	for _, ch := range []models.DeliveryChannel{
		models.DeliveryChannelEmail,
		models.DeliveryChannelSMS,
		models.DeliveryChannelWebhook,
		models.DeliveryChannelPush,
	} {
		got := ResolveFallbackChannel(ch)
		if got == nil || *got != models.DeliveryChannelInApp {
			t.Errorf("fallback for %s = %v, want in_app", ch, got)
		}
	}
	if ResolveFallbackChannel("unknown") != nil {
		t.Error("unknown channel must have no fallback")
	}
}

// ---------------------------------------------------------------------------
// Production wiring: the global channel factory must actually be populated
// ---------------------------------------------------------------------------

// TestGlobalChannelFactoryIsPopulated guards the blank import of
// notification-engine/channels in delivery_service.go. That package's init() is
// the ONLY place the channel handlers are registered; without the import it
// never runs, GlobalHandlerFactory stays empty, and every delivery fails with
// "no channel handler registered".
func TestGlobalChannelFactoryIsPopulated(t *testing.T) {
	registered := []models.ChannelType{
		models.ChannelEmail,
		models.ChannelSlack,
		models.ChannelWebhook,
		models.ChannelDingtalk,
		models.ChannelWechat,
		models.ChannelInApp,
	}
	var missing []models.ChannelType
	for _, ch := range registered {
		if _, ok := engine.GlobalHandlerFactory.Get(ch); !ok {
			missing = append(missing, ch)
		}
	}
	if len(missing) > 0 {
		t.Errorf("channel handlers not registered in engine.GlobalHandlerFactory: %v", missing)
	}
}

// TestDeliverNotification_EndToEndViaGlobalFactory delivers a real notification
// through the production default notifier (engine.GlobalHandlerFactory) with no
// test doubles, exercising the real InAppHandler. in_app is used because it is
// the one channel with no external dependency.
func TestDeliverNotification_EndToEndViaGlobalFactory(t *testing.T) {
	store := &fakeDeliveryStore{}
	n := &models.Notification{
		ID: "n-real-1", TenantID: "t1", UserID: "u1", Type: "ALERT_CREATED",
		Title: "Disk full", Channel: models.ChannelInApp, Recipient: "u1",
		Subject: "Disk full", Body: "usage 98%",
	}
	svc := NewDeliveryService(nil, nil).
		WithDeliveryStore(store).
		WithNotificationSource(&fakeNotificationStore{n: n})

	results, err := svc.DeliverNotification(context.Background(), "t1", "n-real-1")
	if err != nil {
		t.Fatalf("DeliverNotification: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 delivery record, got %d", len(results))
	}
	if results[0].Status != models.DeliveryStatusSent {
		t.Errorf("status = %q, want sent", results[0].Status)
	}
	if results[0].Channel != models.DeliveryChannelInApp {
		t.Errorf("channel = %q, want in_app", results[0].Channel)
	}
	if len(store.records) != 1 {
		t.Errorf("expected 1 persisted record, got %d", len(store.records))
	}
}
