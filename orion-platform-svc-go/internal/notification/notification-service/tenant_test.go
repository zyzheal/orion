package service

import (
	"context"
	"testing"

	"orion/platform-svc-go/internal/notification/models"

	"github.com/DATA-DOG/go-sqlmock"
)

// The assertion pins $2 of the INSERT with WithArgs. Asserting on the returned
// *Notification would prove nothing: MarkAsSent takes only the row id, so the
// tenant of the row it returns is set by this test's own mock fixture, not by
// what SendNotification wrote.
func TestSendNotification_UsesCallerTenantNotRequestBody(t *testing.T) {
	svc, mock := newMockService(t)

	mock.ExpectExec("INSERT INTO notifications").
		WithArgs(sqlmock.AnyArg(), "t1", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectQuery("UPDATE notifications SET status").
		WillReturnRows(notificationRows("n-1"))

	req := &models.CreateNotificationRequest{
		UserID:    "u1",
		Recipient: "u@e.com",
		Subject:   "Hi",
		Body:      "Hello",
		Type:      "test",
		Channel:   models.ChannelEmail,
		TenantID:  "attacker-supplied-tenant", // body spoof
	}

	got, err := svc.SendNotification(context.Background(), "t1", req)
	if err != nil {
		t.Fatalf("SendNotification failed: %v", err)
	}
	// The mismatch shows up here: sqlmock compares every WithArg against the
	// bound parameter, so a wrong tenant makes expectations fail rather than
	// the test silently passing.
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations (INSERT tenant_id must be the caller's): %v", err)
	}
	if got == nil {
		t.Fatalf("SendNotification returned nil notification")
	}
}

// TestSendNotification_EmptyCallerTenantStaysEmpty pins the other half: an
// empty caller tenant must not be backfilled from the body. Filling it would
// reintroduce the override for the anonymous-request case.
func TestSendNotification_EmptyCallerTenantStaysEmpty(t *testing.T) {
	svc, mock := newMockService(t)
	mock.ExpectExec("INSERT INTO notifications").
		WithArgs(sqlmock.AnyArg(), "", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectQuery("UPDATE notifications SET status").
		WillReturnRows(notificationRows("n-1"))

	req := &models.CreateNotificationRequest{
		UserID:    "u1",
		Recipient: "u@e.com",
		Subject:   "Hi",
		Body:      "Hello",
		Type:      "test",
		Channel:   models.ChannelEmail,
		TenantID:  "attacker-supplied-tenant",
	}

	if _, err := svc.SendNotification(context.Background(), "", req); err != nil {
		t.Fatalf("SendNotification failed: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations (empty caller tenant must not be backfilled): %v", err)
	}
}

// TestSendNotification_RequiresUserID keeps the existing validation in place.
func TestSendNotification_RequiresUserID(t *testing.T) {
	svc, _ := newMockService(t)

	_, err := svc.SendNotification(context.Background(), "t1", &models.CreateNotificationRequest{
		Recipient: "u@e.com",
		Subject:   "Hi",
		Body:      "Hello",
		Channel:   models.ChannelEmail,
	})
	if err == nil {
		t.Fatalf("expected an error for an empty user_id")
	}
}
