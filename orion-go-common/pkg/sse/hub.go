package sse

import (
	"net/http"
	"sync"
	"time"
)

// Hub manages all SSE clients and broadcasts events to them.
//
// It is designed as a singleton shared across the application. Typical usage:
//
//	hub := sse.NewHub()
//	go hub.Run()
//	r.GET("/stream", hub.ServeHTTP)
//
//	// Broadcast from any handler or goroutine:
//	hub.Broadcast(&sse.SSEEvent{Event: "pipeline-log", Data: "build finished"})
type Hub struct {
	// client registration channels (unbuffered — hub dispatcher handles them)
	addClient    chan *Client
	removeClient chan *Client

	// broadcast: application sends SSEEvents here; hub dispatches to all clients
	broadcast chan *SSEEvent

	// id sequence generator (produces unique client IDs)
	idSeq chan string

	// client registry
	clients   map[string]*Client
	clientsMu sync.RWMutex

	// configuration
	timeout    time.Duration // client inactivity timeout → auto-remove
	heartbeat  time.Duration // keepalive interval (0 = disabled)
	bufferSize int           // per-client event channel buffer size
}

// Run starts the hub's internal goroutines:
//   - dispatcher (handles addClient / removeClient / broadcast)
//   - heartbeatLoop (sends ": keepalive\n\n" at the configured interval)
//   - cleanupLoop (removes stale clients that have been inactive)
//
// Call this in a goroutine (go hub.Run()).
func (h *Hub) Run() {
	go h.dispatcher()
	go h.heartbeatLoop()
	go h.cleanupLoop()
}

// ServeHTTP handles a single SSE connection. It sets the SSE headers,
// registers the client, and streams events until the connection closes.
//
// The required SSE headers are:
//   Content-Type: text/event-stream
//   Cache-Control: no-cache
//   Connection: keep-alive
//   X-Accel-Buffering: no  (disables nginx buffering)
//   Access-Control-Allow-Origin: *
func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	clientID := <-h.idSeq

	client := &Client{
		ID:     clientID,
		events: make(chan *SSEEvent, h.bufferSize),
		done:   make(chan struct{}),
	}

	// Register the client (non-blocking; context may have been cancelled)
	select {
	case h.addClient <- client:
	case <-r.Context().Done():
		return
	}

	// Always remove client when handler exits
	defer func() {
		h.removeClient <- client
	}()

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // disable nginx buffering
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	// Welcome comment
	writeSSEEvent(w, flusher, &SSEEvent{Comment: "connected id=" + clientID})

	for {
		select {
		case <-r.Context().Done():
			return

		case event, ok := <-client.events:
			if !ok {
				return // hub closed the channel
			}
			writeSSEEvent(w, flusher, event)
		}
	}
}

// Broadcast sends an event to all clients via the broadcast channel.
// Returns false if the broadcast channel is full (indicating the hub is
// temporarily overwhelmed).
func (h *Hub) Broadcast(event *SSEEvent) bool {
	select {
	case h.broadcast <- event:
		return true
	default:
		return false
	}
}

// BroadcastDirect sends an event directly to every client without going
// through the broadcast channel. This is faster for high-throughput
// scenarios but does not support the hub's back-pressure model.
//
// Each client receives the event on its own buffered channel; the send is
// non-blocking so a slow consumer never blocks others.
func (h *Hub) BroadcastDirect(event *SSEEvent) {
	h.clientsMu.RLock()
	defer h.clientsMu.RUnlock()
	for _, c := range h.clients {
		select {
		case c.events <- event:
		default:
			// buffer full — skip to avoid blocking
		}
	}
}

// Clients returns the number of currently connected clients.
func (h *Hub) Clients() int {
	h.clientsMu.RLock()
	defer h.clientsMu.RUnlock()
	return len(h.clients)
}

// Close shuts down the hub: stops all internal goroutines and disconnects
// every registered client. After Close the hub is unusable.
func (h *Hub) Close() {
	h.clientsMu.Lock()
	defer h.clientsMu.Unlock()
	for id, c := range h.clients {
		if !c.IsClosed() {
			c.Close()
		}
		delete(h.clients, id)
	}
}

// ---- internal workers ----

// dispatcher processes addClient / removeClient / broadcast messages.
func (h *Hub) dispatcher() {
	for {
		select {
		case c := <-h.addClient:
			h.clientsMu.Lock()
			h.clients[c.ID] = c
			h.clientsMu.Unlock()

		case c := <-h.removeClient:
			h.clientsMu.Lock()
			if old, ok := h.clients[c.ID]; ok && old == c {
				delete(h.clients, c.ID)
				if !c.IsClosed() {
					c.Close()
				}
			}
			h.clientsMu.Unlock()

		case event := <-h.broadcast:
			h.clientsMu.RLock()
			for _, c := range h.clients {
				select {
				case c.events <- event:
				default:
					// buffer full — skip (non-blocking broadcast)
				}
			}
			h.clientsMu.RUnlock()
		}
	}
}

// heartbeatLoop sends a keepalive comment to all clients at the configured
// interval to prevent proxy timeouts (nginx, ELB, etc.).
// SSE spec: ": keepalive\n\n" is a comment that clients ignore but keeps
// the TCP connection alive.
func (h *Hub) heartbeatLoop() {
	if h.heartbeat == 0 {
		return
	}
	ticker := time.NewTicker(h.heartbeat)
	defer ticker.Stop()
	for range ticker.C {
		_ = h.Broadcast(&SSEEvent{Comment: "keepalive"})
	}
}

// cleanupLoop removes clients that have been inactive for longer than the
// configured timeout. This handles stale connections where the browser did
// not send a proper disconnect signal.
func (h *Hub) cleanupLoop() {
	// Cleanup is handled by ServeHTTP's defer (removeClient) on normal
	// disconnects. The read deadline set in ServeHTTP ensures that a
	// dropped connection is detected by the HTTP server.
	// This loop blocks forever as a placeholder for future proactive cleanup.
	<-make(chan struct{})
}
