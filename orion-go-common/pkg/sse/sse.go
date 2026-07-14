package sse

import (
	"fmt"
	"io"
	"time"
)

// SSEEvent represents a single Server-Sent Event message.
//
// It maps to the SSE protocol fields:
//   - event  → event type ("pipeline-log", "notification", "workflow", …)
//   - data   → payload (usually JSON)
//   - id     → client-side lastEventId (for reconnect)
//   - retry  → reconnect interval in milliseconds
//   - Comment→ SSE comment line (used for heartbeat keepalive)
//
// At least one field must be set; if all are empty the event is skipped.
type SSEEvent struct {
	Event   string
	Data    string
	ID      string
	Retry   int
	Comment string // ": keepalive"
}

// flusher abstracts http.Flusher so we don't import net/http here.
type flusher interface {
	Flush()
}

// NewHub creates a new Hub. See the hub.go file for the Hub type and
// its Run/ServeHTTP/Broadcast/Close methods.
//
// Defaults:
//   - timeout:       5 * time.Minute   (client inactivity → auto-remove)
//   - heartbeat:     30 * time.Second  (keepalive interval)
//   - bufferSize:    256               (per-client event channel size)
func NewHub(opts ...Option) *Hub {
	h := &Hub{
		addClient:    make(chan *Client),
		removeClient: make(chan *Client),
		broadcast:    make(chan *SSEEvent, 1024),
		idSeq:        idGenerator(),
		clients:      make(map[string]*Client),

		timeout:    5 * time.Minute,
		heartbeat:  30 * time.Second,
		bufferSize: 256,
	}

	for _, opt := range opts {
		opt(h)
	}

	return h
}

// ---- SSE wire-format helpers ----

// writeSSEEvent serialises an SSEEvent to the SSE text/event-stream format
// and flushes the response writer.
//
// Format (https://html.spec.whatwg.org/multipage/server-sent-events.html):
//
//	event: pipeline-log
//	data: {"key":"value"}
//	id: 42
//	retry: 3000
//	(blank line)
func writeSSEEvent(w io.Writer, flusher flusher, event *SSEEvent) {
	if event == nil {
		return
	}
	if event.Event == "" && event.Data == "" && event.ID == "" && event.Retry == 0 && event.Comment == "" {
		return
	}

	// Comment has a special wire format: ": message\n\n"
	if event.Comment != "" {
		fmt.Fprintf(w, ": %s\n\n", event.Comment)
		if flusher != nil {
			flusher.Flush()
		}
		return
	}

	if event.Event != "" {
		fmt.Fprintf(w, "event: %s\n", event.Event)
	}
	if event.Data != "" {
		fmt.Fprintf(w, "data: %s\n", event.Data)
	}
	if event.ID != "" {
		fmt.Fprintf(w, "id: %s\n", event.ID)
	}
	if event.Retry > 0 {
		fmt.Fprintf(w, "retry: %d\n", event.Retry)
	}

	fmt.Fprint(w, "\n") // blank line terminates the event
	if flusher != nil {
		flusher.Flush()
	}
}

// idGenerator starts a goroutine that produces unique, monotonically
// increasing client IDs ("c-1", "c-2", …).
func idGenerator() chan string {
	ch := make(chan string)
	go func() {
		i := int64(1)
		for {
			ch <- fmt.Sprintf("c-%d", i)
			i++
		}
	}()
	return ch
}
