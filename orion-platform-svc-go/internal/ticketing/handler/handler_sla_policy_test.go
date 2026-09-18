package handler

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/service"
)

// GET /ticketing/sla/tickets/:ticketId/status answered 200 with a body holding
// only ticket_id: the repository body was a connectivity check, so every window
// and deadline on the route read as zero and a queue full of breaches looked
// identical to an empty one. This is the route-level proof that the registered
// endpoint reports the window it computes. The service-level test exercises the
// method; this one exercises the wire, which is what the endpoint contract is.
func TestHandler_GET_TicketingSLATicketStatusReturnsTheComputedWindow(t *testing.T) {
	repo := &fakeTicketingRepo{tickets: []models.Ticket{{
		ID: "tk-route", TenantID: "tenant-1", Status: "open",
		Priority: "high", CreatedAt: time.Now().UTC().Add(-time.Hour),
	}}}
	c, w := makeCtxWithParams(http.MethodGet, "/", map[string]string{"ticketId": "tk-route"})
	NewHandler(service.NewService(repo)).GetTicketSLAStatus(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetTicketSLAStatus: got %d, want 200 (body %s)", w.Code, w.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("response is not JSON: %v (body %s)", err, w.Body.String())
	}
	data, ok := resp["data"].(map[string]any)
	if !ok {
		t.Fatalf("response has no data object: %s", w.Body.String())
	}
	if got, want := data["ticket_id"], "tk-route"; got != want {
		t.Errorf("ticket_id is %v, want %v", got, want)
	}
	if got, want := data["priority"], "high"; got != want {
		t.Errorf("priority is %v, want %v", got, want)
	}
	if got, want := data["status"], "open"; got != want {
		t.Errorf("status is %v, want %v", got, want)
	}
	if got, want := data["target_response_time_ms"], float64(3600*1000); got != want {
		t.Errorf("target_response_time_ms is %v, want %v", got, want)
	}
	if got, want := data["target_resolution_time_ms"], float64(8*3600*1000); got != want {
		t.Errorf("target_resolution_time_ms is %v, want %v", got, want)
	}
	if due, ok := data["response_due"].(string); !ok || due == "" {
		t.Errorf("response_due is %v, want a timestamp", data["response_due"])
	}
	if due, ok := data["resolution_due"].(string); !ok || due == "" {
		t.Errorf("resolution_due is %v, want a timestamp", data["resolution_due"])
	}
}
