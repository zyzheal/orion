package websocket

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

// ProxyRoute maps a URL prefix to a backend service URL.
type ProxyRoute struct {
	PathPrefix string
	ServiceURL string // base URL of backend service
	TargetPath string // optional: override path on target
}

// Proxy routes WebSocket connections to backend services.
type Proxy struct {
	routes    []ProxyRoute
	mu        sync.RWMutex
	stats     ProxyStats
	logger    *zap.Logger
	dialer    *websocket.Dialer
}

// ProxyStats tracks proxy metrics.
type ProxyStats struct {
	TotalConnections   int
	ActiveConnections  int
	FailedConnections  int
	MessagesForwarded  int
}

// NewProxy creates a WebSocket proxy.
func NewProxy(routes []ProxyRoute) *Proxy {
	return &Proxy{
		routes: routes,
		dialer: &websocket.Dialer{
			HandshakeTimeout: 10 * time.Second,
		},
	}
}

// AddRoute adds or updates a proxy route.
func (p *Proxy) AddRoute(route ProxyRoute) {
	p.mu.Lock()
	defer p.mu.Unlock()
	for i, r := range p.routes {
		if r.PathPrefix == route.PathPrefix {
			p.routes[i] = route
			return
		}
	}
	p.routes = append(p.routes, route)
}

// ResolveTarget returns the target WebSocket URL for a request path.
func (p *Proxy) ResolveTarget(requestPath string) string {
	p.mu.RLock()
	defer p.mu.RUnlock()
	for _, route := range p.routes {
		if strings.HasPrefix(requestPath, route.PathPrefix) {
			wsURL := strings.Replace(route.ServiceURL, "http://", "ws://", 1)
			wsURL = strings.Replace(wsURL, "https://", "wss://", 1)
			subPath := requestPath[len(route.PathPrefix):]
			targetPath := route.PathPrefix + subPath
			if route.TargetPath != "" {
				targetPath = route.TargetPath + subPath
			}
			return wsURL + targetPath
		}
	}
	return ""
}

// Proxy forwards a client WebSocket connection to a backend service.
func (p *Proxy) Proxy(clientWS *websocket.Conn, targetURL string, headers http.Header) error {
	p.mu.Lock()
	p.stats.TotalConnections++
	p.stats.ActiveConnections++
	p.mu.Unlock()

	defer func() {
		p.mu.Lock()
		p.stats.ActiveConnections--
		p.mu.Unlock()
	}()

	// Connect to backend
	backend, _, err := p.dialer.Dial(targetURL, headers)
	if err != nil {
		p.mu.Lock()
		p.stats.FailedConnections++
		p.mu.Unlock()
		return fmt.Errorf("failed to connect to backend: %w", err)
	}
	defer backend.Close()

	// Bidirectional message forwarding
	done := make(chan struct{})

	// client -> backend
	go func() {
		defer close(done)
		for {
			msgType, data, err := clientWS.ReadMessage()
			if err != nil {
				return
			}
			if err := backend.WriteMessage(msgType, data); err != nil {
				return
			}
			p.mu.Lock()
			p.stats.MessagesForwarded++
			p.mu.Unlock()
		}
	}()

	// backend -> client
	for {
		msgType, data, err := backend.ReadMessage()
		if err != nil {
			break
		}
		if err := clientWS.WriteMessage(msgType, data); err != nil {
			break
		}
		p.mu.Lock()
		p.stats.MessagesForwarded++
		p.mu.Unlock()
	}

	<-done
	return nil
}

// GetStats returns current proxy statistics.
func (p *Proxy) GetStats() ProxyStats {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.stats
}

// CloseAll closes all active connections (for shutdown).
func (p *Proxy) CloseAll() {
	// Connection tracking and closing is handled by the connection manager
}
