// Package websocket provides WebSocket server, auth, heartbeat, and proxy
// functionality for the Orion API Gateway.
package websocket

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

// Config holds WebSocket server configuration.
type Config struct {
	Path              string
	HeartbeatInterval time.Duration
	HeartbeatTimeout  time.Duration
}

// DefaultConfig provides sensible defaults.
var DefaultConfig = Config{
	Path:              "/ws",
	HeartbeatInterval: 30 * time.Second,
	HeartbeatTimeout:  15 * time.Second,
}

// upgrader is the WebSocket upgrader.
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

// ServerManager manages WebSocket connections.
type ServerManager struct {
	config            Config
	logger            *zap.Logger
	jwtSecret         string
	connectionManager *ConnectionManager
	proxy            *Proxy
}

// NewServerManager creates a WebSocket server manager.
func NewServerManager(cfg Config, jwtSecret string, logger *zap.Logger) *ServerManager {
	return &ServerManager{
		config:            cfg,
		logger:            logger,
		jwtSecret:         jwtSecret,
		connectionManager: NewConnectionManager(),
		proxy:            NewProxy(nil),
	}
}

// RegisterRoutes registers the WebSocket upgrade handler on the Gin engine.
func (m *ServerManager) RegisterRoutes(r *gin.Engine) {
	r.GET(m.config.Path, m.handleWebSocket)
	r.GET(m.config.Path+"/*path", m.handleWebSocket)
}

func (m *ServerManager) handleWebSocket(c *gin.Context) {
	// Extract token for auth
	token := extractWSToken(c.Request)
	if token == "" {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
			"error":   "UNAUTHORIZED",
			"message": "Token is required",
		})
		return
	}

	// Verify JWT
	claims := jwt.MapClaims{}
	parsedToken, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(m.jwtSecret), nil
	})
	if err != nil || !parsedToken.Valid {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
			"error":   "UNAUTHORIZED",
			"message": "Invalid or expired token",
		})
		return
	}

	userID, _ := claims["sub"].(string)

	// Upgrade to WebSocket
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		m.logger.Error("WebSocket upgrade failed", zap.Error(err))
		return
	}
	defer ws.Close()

	clientID := generateID()
	requestPath := c.Request.URL.Path

	// Check if path matches a proxy route
	proxyTarget := m.proxy.ResolveTarget(requestPath)
	if proxyTarget != "" {
		m.handleProxyConnection(ws, proxyTarget, clientID, userID, c.Request.Header)
	} else {
		m.handleLocalConnection(ws, clientID, userID)
	}
}

func (m *ServerManager) handleLocalConnection(ws *websocket.Conn, clientID, userID string) {
	m.connectionManager.AddConnection(clientID, ws, m.config.HeartbeatInterval, m.config.HeartbeatTimeout)
	defer m.connectionManager.RemoveConnection(clientID)

	// Send welcome message
	m.connectionManager.SendToClient(clientID, map[string]interface{}{
		"type":      "connected",
		"clientId":  clientID,
		"userId":    userID,
		"timestamp": time.Now().UnixMilli(),
	})

	for {
		msgType, data, err := ws.ReadMessage()
		if err != nil {
			break
		}
		if msgType == websocket.TextMessage {
			var msg map[string]interface{}
			if err := json.Unmarshal(data, &msg); err == nil {
				if msg["type"] == "ping" {
					m.connectionManager.SendToClient(clientID, map[string]interface{}{
						"type":      "pong",
						"timestamp": time.Now().UnixMilli(),
					})
				} else {
					m.connectionManager.Broadcast(map[string]interface{}{
						"type":      "message",
						"from":      userID,
						"data":      msg,
						"timestamp": time.Now().UnixMilli(),
					})
				}
			}
		}
	}
}

func (m *ServerManager) handleProxyConnection(clientWS *websocket.Conn, targetURL, clientID, userID string, headers http.Header) {
	m.logger.Info("proxying WebSocket",
		zap.String("clientId", clientID),
		zap.String("userId", userID),
		zap.String("targetURL", targetURL),
	)

	if err := m.proxy.Proxy(clientWS, targetURL, headers); err != nil {
		m.logger.Error("WebSocket proxy failed",
			zap.Error(err),
			zap.String("clientId", clientID),
			zap.String("targetURL", targetURL),
		)
		errMsg, _ := json.Marshal(map[string]interface{}{
			"type":    "error",
			"code":    502,
			"message": "Failed to connect to backend service",
		})
		clientWS.WriteMessage(websocket.TextMessage, errMsg)
		clientWS.Close()
	}
}

// GetConnectionCount returns the number of active connections.
func (m *ServerManager) GetConnectionCount() int {
	return m.connectionManager.GetConnectionCount()
}

// Shutdown closes all connections.
func (m *ServerManager) Shutdown() {
	m.connectionManager.CloseAll()
}

func extractWSToken(r *http.Request) string {
	// 1. Query parameter ?token=xxx
	q := r.URL.Query()
	if token := q.Get("token"); token != "" {
		return token
	}
	// 2. Sec-WebSocket-Protocol header
	proto := r.Header.Get("Sec-WebSocket-Protocol")
	if proto != "" {
		if strings.HasPrefix(proto, "Bearer ") {
			return strings.TrimPrefix(proto, "Bearer ")
		}
		if strings.Contains(proto, ".") {
			return strings.TrimSpace(proto)
		}
	}
	return ""
}

func generateID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// --- ConnectionManager ---

// ConnectionManager tracks all WebSocket connections.
type ConnectionManager struct {
	mu         sync.RWMutex
	connections map[string]*websocket.Conn
}

// NewConnectionManager creates a connection manager.
func NewConnectionManager() *ConnectionManager {
	return &ConnectionManager{
		connections: make(map[string]*websocket.Conn),
	}
}

// AddConnection registers a connection and starts heartbeat.
func (cm *ConnectionManager) AddConnection(id string, ws *websocket.Conn, interval, timeout time.Duration) {
	cm.mu.Lock()
	cm.connections[id] = ws
	cm.mu.Unlock()

	// Start heartbeat in background
	go cm.heartbeat(id, ws, interval, timeout)
}

// RemoveConnection removes a connection.
func (cm *ConnectionManager) RemoveConnection(id string) {
	cm.mu.Lock()
	delete(cm.connections, id)
	cm.mu.Unlock()
}

// SendToClient sends a JSON message to a specific client.
func (cm *ConnectionManager) SendToClient(id string, data interface{}) bool {
	cm.mu.RLock()
	ws, ok := cm.connections[id]
	cm.mu.RUnlock()
	if !ok {
		return false
	}
	msg, err := json.Marshal(data)
	if err != nil {
		return false
	}
	return ws.WriteMessage(websocket.TextMessage, msg) == nil
}

// Broadcast sends a JSON message to all clients.
func (cm *ConnectionManager) Broadcast(data interface{}) {
	msg, err := json.Marshal(data)
	if err != nil {
		return
	}
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	for _, ws := range cm.connections {
		ws.WriteMessage(websocket.TextMessage, msg)
	}
}

// GetConnectionCount returns active connection count.
func (cm *ConnectionManager) GetConnectionCount() int {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return len(cm.connections)
}

// CloseAll closes all connections.
func (cm *ConnectionManager) CloseAll() {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	for _, ws := range cm.connections {
		ws.Close()
	}
	cm.connections = make(map[string]*websocket.Conn)
}

func (cm *ConnectionManager) heartbeat(id string, ws *websocket.Conn, interval, timeout time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	missedPongs := 0
	maxMissed := 2

	for range ticker.C {
		cm.mu.RLock()
		_, ok := cm.connections[id]
		cm.mu.RUnlock()
		if !ok {
			return
		}

		missedPongs++
		if missedPongs > maxMissed {
			cm.RemoveConnection(id)
			ws.Close()
			return
		}

		deadline := time.Now().Add(timeout)
		if err := ws.WriteControl(websocket.PingMessage, nil, deadline); err != nil {
			cm.RemoveConnection(id)
			return
		}
	}
}
