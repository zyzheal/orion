package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/repository"
	"orion/platform-svc-go/internal/ticketing/service"
)

// alertDispatchFake answers Dequeue from a fixed slice and defers every other
// method to the embedded interface, which GetSLAQueueEntries never calls.
type alertDispatchFake struct {
	repository.DispatchRepositoryInterface
	entries []models.DispatchQueueEntry
}

func (f *alertDispatchFake) Dequeue(ctx context.Context, limit int) ([]models.DispatchQueueEntry, error) {
	return f.entries, nil
}

// slaAlertQueue returns n queued tickets. Unlike ticket's, ticketing's
// GetSLAAlerts builds one alert per entry with no deadline filter, so the
// fixture only needs to be non-empty.
func slaAlertQueue(n int) []models.DispatchQueueEntry {
	now := time.Now()
	entries := make([]models.DispatchQueueEntry, n)
	for i := range entries {
		entries[i] = models.DispatchQueueEntry{
			TicketID:   fmt.Sprintf("t-%d", i),
			Priority:   "critical",
			EnqueuedAt: now.Add(-time.Hour),
		}
	}
	return entries
}

func slaAlertsCtx(query string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	// Joined with "?" so an empty query still yields a valid request URL.
	c.Request = httptest.NewRequest(http.MethodGet, "/x?"+query, nil)
	return c, w
}

// The handler used to read limit with a bare Atoi and only rescue `== 0`, while
// the service truncates its loop with `if limit > 0`. So any negative limit
// meant "no cap" and the whole queue came back: ?limit=-1 on a 55-entry queue
// answered with 55 alerts instead of 50. No error, no 500 - just a response
// longer than the caller asked for. The queue is kept above the fallback so the
// floor is visible rather than masked by a short slice.
func TestQueueHandler_GetSLAAlertsFloorsANonPositiveLimit(t *testing.T) {
	cases := []struct {
		name    string
		query   string
		entries int
		want    int
	}{
		// Above the fallback: the floor engages. The limit=-1 row is the one
		// that distinguishes the fix from the old `== 0` guard.
		{"absentDefaultsToFifty", "", 55, 50},
		{"negativeLimitIsFloored", "limit=-1", 55, 50},
		{"largeNegativeLimitIsFloored", "limit=-100", 55, 50},
		{"zeroLimitIsFloored", "limit=0", 55, 50},
		{"unparsableLimitIsFloored", "limit=abc", 55, 50},
		// A limit the queue can satisfy is honoured, not reset to the default.
		{"smallLimitIsHonoured", "limit=2", 55, 2},
		{"exactLimitIsHonoured", "limit=55", 55, 55},
		// A short queue is not padded up to the fallback.
		{"shortQueueIsNotPadded", "limit=-1", 3, 3},
		// The floor sets a minimum only; it never caps a request above what
		// exists. Deliberately unpinned against a platform cap of 100 - the
		// decision to leave these limits uncapped is recorded, not hidden.
		{"largeLimitReturnsEverything", "limit=1000", 55, 55},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := NewQueueHandler(service.NewQueueManager(
				&alertDispatchFake{entries: slaAlertQueue(tc.entries)},
				nil,
			))
			c, w := slaAlertsCtx(tc.query)
			h.GetSLAAlerts(c)
			if w.Code != http.StatusOK {
				t.Fatalf("status %d, want 200: %s", w.Code, w.Body.String())
			}
			var out struct {
				Data struct {
					Count int `json:"count"`
				} `json:"data"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
				t.Fatalf("response %q: %v", w.Body.String(), err)
			}
			if out.Data.Count != tc.want {
				t.Errorf("count = %d, want %d", out.Data.Count, tc.want)
			}
		})
	}
}
