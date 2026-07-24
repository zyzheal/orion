package sse

import "time"

// Option configures an SSE Hub.
type Option func(*Hub)

// WithTimeout sets the client inactivity timeout. Clients that have not
// received any event within this duration are considered stale and removed.
// Default: 5 * time.Minute.
func WithTimeout(d time.Duration) Option {
	return func(h *Hub) {
		h.timeout = d
	}
}

// WithBufferSize sets the size of each client's event buffer.
// Default: 256.
func WithBufferSize(size int) Option {
	return func(h *Hub) {
		if size > 0 {
			h.bufferSize = size
		}
	}
}

// WithHeartbeatInterval sets the interval at which the hub sends a keepalive
// comment (": keepalive\n\n") to all connected clients. This prevents upstream
// proxies (nginx, ELB, etc.) from timing out idle SSE connections.
// Default: 30 * time.Second. Pass 0 to disable.
func WithHeartbeatInterval(d time.Duration) Option {
	return func(h *Hub) {
		h.heartbeat = d
	}
}
