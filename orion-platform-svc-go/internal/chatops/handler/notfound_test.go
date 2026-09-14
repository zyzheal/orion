package handler

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"
	"testing"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/chatops/models"
)

// These are the two outcomes that used to be unreachable. The repository handed
// the driver's errors straight to the handlers, so the IsNotFound branches
// never ran: a delete of a row that did not exist answered 200, and a missing
// id answered 500 with "sql: no rows" instead of 404.

func TestHandler_DeleteRole_MissingRoleAnswers404(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		deleteRoleFn: func(ctx context.Context, tenantID, id string) error {
			if id != "role-gone" {
				t.Fatalf("got id %q", id)
			}
			return sentinel.NotFound
		},
	})

	w := performRequest(h, h.DeleteRole, "DELETE", nil, map[string]string{"id": "role-gone"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for a missing id, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandler_DeleteRole_ARealErrorStillAnswers500(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		deleteRoleFn: func(ctx context.Context, tenantID, id string) error {
			return errors.New("pq: deadlock")
		},
	})

	w := performRequest(h, h.DeleteRole, "DELETE", nil, map[string]string{"id": "role-1"}, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 for a database error, got %d", w.Code)
	}
}

// Before getOne existed this is what the repository returned, and it produced
// the 500 the admin UI saw. The handler has to keep answering 500 for a real
// driver error rather than a not-found.
func TestHandler_DeleteRole_ARawDriverErrorIs500(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		deleteRoleFn: func(ctx context.Context, tenantID, id string) error {
			return sql.ErrNoRows
		},
	})

	w := performRequest(h, h.DeleteRole, "DELETE", nil, map[string]string{"id": "role-1"}, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 for a raw driver error, got %d", w.Code)
	}
}

// A tenant that has never saved a notification preference gets its own zero
// value back instead of an error page. That is the very first request of a new
// tenant.
func TestHandler_GetNotificationPreference_FirstRequestIsAnEmptyObject(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getNotificationPrefFn: func(ctx context.Context, tenantID, userID string) (*models.NotificationPreference, error) {
			return nil, sentinel.NotFound
		},
	})

	w := performRequest(h, h.GetNotificationPreferences, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for a first request, got %d: %s", w.Code, w.Body.String())
	}
	if got := w.Body.String(); got != `{"code":"SUCCESS","data":{}}` && got != `{"code":"success","data":{}}` {
		// the shape only has to be an empty object under data
		if !strings.Contains(got, `"data":{}`) {
			t.Fatalf("expected an empty object payload, got %s", got)
		}
	}
}
