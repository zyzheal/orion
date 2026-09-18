package handler

import (
	"bytes"
	"io"
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
)

// The other four write handlers in handler_workflow.go answer 400 on a
// malformed body. CloseTicket discarded the ShouldBindJSON error, so
// POST /tickets/:id/close with a broken payload closed the ticket with an
// empty comment and no diagnostic. The pre-fix behaviour was a 200, which is
// why the assertion here is on the exact status code rather than on >= 500.
func TestHandler_CloseTicketRejectsAMalformedBody(t *testing.T) {
	c, w := makeCtxWithParams(http.MethodPost, "/tickets/t1/close",
		map[string]string{"id": "t1"})
	c.Request.Body = io.NopCloser(bytes.NewReader([]byte(`{"comment":"done"`)))
	c.Request.Header.Set("Content-Type", "application/json")

	newHandler().CloseTicket(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("CloseTicket answered %d for a malformed body, want 400: a broken payload must not close the ticket", w.Code)
	}
}

func TestHandler_CloseTicketAcceptsAComment(t *testing.T) {
	c, w := makeCtxWithParams(http.MethodPost, "/tickets/t1/close",
		map[string]string{"id": "t1"})
	c.Request.Body = io.NopCloser(bytes.NewReader([]byte(`{"comment":"customer churned"}`)))
	c.Request.Header.Set("Content-Type", "application/json")

	newHandler().CloseTicket(c)

	if w.Code != http.StatusOK {
		t.Fatalf("CloseTicket answered %d for a valid body, want 200", w.Code)
	}
}

// A bind failure anywhere in this file would mutate a ticket from a request the
// caller never meant to send, so every write handler gets the same check. The
// shared broken payload is cut off mid-object, which makes the failure a
// decoder error rather than a missing-field error.
func TestHandler_WorkflowWriteEndpointsRejectMalformedBodies(t *testing.T) {
	broken := []byte(`{"status":"in-progress"`)
	cases := []struct {
		name   string
		path   string
		handle func(*Handler, *gin.Context)
	}{
		{"TransitionStatus", "/tickets/t1/transition",
			func(h *Handler, c *gin.Context) { h.TransitionStatus(c) }},
		{"AssignTicket", "/tickets/t1/assign",
			func(h *Handler, c *gin.Context) { h.AssignTicket(c) }},
		{"EscalateTicket", "/tickets/t1/escalate",
			func(h *Handler, c *gin.Context) { h.EscalateTicket(c) }},
		{"ResolveTicket", "/tickets/t1/resolve",
			func(h *Handler, c *gin.Context) { h.ResolveTicket(c) }},
		{"CloseTicket", "/tickets/t1/close",
			func(h *Handler, c *gin.Context) { h.CloseTicket(c) }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, w := makeCtxWithParams(http.MethodPost, tc.path, map[string]string{"id": "t1"})
			c.Request.Body = io.NopCloser(bytes.NewReader(broken))
			c.Request.Header.Set("Content-Type", "application/json")
			tc.handle(newHandler(), c)
			if w.Code != http.StatusBadRequest {
				t.Fatalf("%s answered %d for a malformed body, want 400", tc.name, w.Code)
			}
		})
	}
}
