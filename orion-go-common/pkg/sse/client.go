package sse

// Client represents a single SSE connection from a browser or HTTP client.
type Client struct {
	ID       string
	events   chan *SSEEvent // events pushed from the hub to this client
	done     chan struct{}  // closed when the connection is terminated
}

// Close signals the client to stop. Safe to call multiple times.
func (c *Client) Close() {
	select {
	case <-c.done:
	default:
		close(c.done)
	}
}

// IsClosed reports whether the client has been closed.
func (c *Client) IsClosed() bool {
	select {
	case <-c.done:
		return true
	default:
		return false
	}
}
