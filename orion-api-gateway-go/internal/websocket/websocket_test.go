package websocket

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

func init() { gin.SetMode(gin.TestMode) }

// ---------- Proxy ----------

func TestNewProxy(t *testing.T) {
	p := NewProxy(nil)
	if p == nil { t.Fatal("expected non-nil proxy") }
	if p.dialer == nil { t.Error("expected non-nil dialer") }
}

func TestProxyAddRoute(t *testing.T) {
	p := NewProxy(nil)
	p.AddRoute(ProxyRoute{PathPrefix: "/ws/test", ServiceURL: "http://backend:8080"})
	if len(p.routes) != 1 { t.Errorf("expected 1 route, got %d", len(p.routes)) }
}

func TestProxyAddRouteUpdate(t *testing.T) {
	p := NewProxy(nil)
	p.AddRoute(ProxyRoute{PathPrefix: "/ws/test", ServiceURL: "http://backend1:8080"})
	p.AddRoute(ProxyRoute{PathPrefix: "/ws/test", ServiceURL: "http://backend2:8080"})
	if len(p.routes) != 1 { t.Fatalf("expected 1 route, got %d", len(p.routes)) }
	if p.routes[0].ServiceURL != "http://backend2:8080" { t.Errorf("expected updated URL, got %s", p.routes[0].ServiceURL) }
}

func TestProxyResolveTarget(t *testing.T) {
	p := NewProxy([]ProxyRoute{{PathPrefix: "/ws/api", ServiceURL: "http://backend:8080"}})
	target := p.ResolveTarget("/ws/api/users")
	if target != "ws://backend:8080/ws/api/users" { t.Errorf("unexpected target: %s", target) }
}

func TestProxyResolveTargetHttps(t *testing.T) {
	p := NewProxy([]ProxyRoute{{PathPrefix: "/ws/secure", ServiceURL: "https://backend:8443"}})
	target := p.ResolveTarget("/ws/secure/test")
	if target != "wss://backend:8443/ws/secure/test" { t.Errorf("unexpected target: %s", target) }
}

func TestProxyResolveTargetWithOverride(t *testing.T) {
	p := NewProxy([]ProxyRoute{{PathPrefix: "/gateway", ServiceURL: "http://backend:8080", TargetPath: "/internal"}})
	target := p.ResolveTarget("/gateway/test")
	if target != "ws://backend:8080/internal/test" { t.Errorf("unexpected target: %s", target) }
}

func TestProxyResolveTargetNotFound(t *testing.T) {
	p := NewProxy([]ProxyRoute{{PathPrefix: "/ws/test", ServiceURL: "http://backend:8080"}})
	target := p.ResolveTarget("/unknown/path")
	if target != "" { t.Errorf("expected empty string, got %s", target) }
}

func TestProxyGetStats(t *testing.T) {
	p := NewProxy(nil)
	stats := p.GetStats()
	if stats.TotalConnections != 0 || stats.ActiveConnections != 0 { t.Errorf("expected zero stats, got %+v", stats) }
}

// ---------- extractWSToken ----------

func TestExtractWSTokenFromQuery(t *testing.T) {
	req, _ := http.NewRequest("GET", "/ws?token=mytoken123", nil)
	token := extractWSToken(req)
	if token != "mytoken123" { t.Errorf("expected mytoken123, got %s", token) }
}

func TestExtractWSTokenFromProtocolBearer(t *testing.T) {
	req, _ := http.NewRequest("GET", "/ws", nil)
	req.Header.Set("Sec-WebSocket-Protocol", "Bearer mytoken456")
	token := extractWSToken(req)
	if token != "mytoken456" { t.Errorf("expected mytoken456, got %s", token) }
}

func TestExtractWSTokenFromProtocolJWT(t *testing.T) {
	req, _ := http.NewRequest("GET", "/ws", nil)
	req.Header.Set("Sec-WebSocket-Protocol", "jwt-header.jwt-payload.jwt-signature")
	token := extractWSToken(req)
	if token != "jwt-header.jwt-payload.jwt-signature" { t.Errorf("expected JWT, got %s", token) }
}

func TestExtractWSTokenEmpty(t *testing.T) {
	req, _ := http.NewRequest("GET", "/ws", nil)
	token := extractWSToken(req)
	if token != "" { t.Errorf("expected empty, got %s", token) }
}

// ---------- generateID ----------

func TestGenerateID(t *testing.T) {
	id1 := generateID()
	id2 := generateID()
	if id1 == id2 { t.Error("expected unique IDs") }
	if len(id1) != 32 { t.Errorf("expected 32 hex chars, got %d", len(id1)) }
}

// ---------- ServerManager ----------

func TestNewServerManager(t *testing.T) {
	m := NewServerManager(DefaultConfig, "secret", zap.NewNop())
	if m == nil { t.Fatal("expected non-nil manager") }
	if m.config.Path != "/ws" { t.Errorf("expected path /ws, got %s", m.config.Path) }
	if m.connectionManager == nil { t.Error("expected non-nil connection manager") }
	if m.proxy == nil { t.Error("expected non-nil proxy") }
}

func TestServerManagerRegisterRoutes(t *testing.T) {
	m := NewServerManager(DefaultConfig, "secret", zap.NewNop())
	r := gin.New()
	m.RegisterRoutes(r)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/ws", nil)
	r.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized { t.Errorf("expected 401 for no token, got %d", rr.Code) }
}

func TestServerManagerNoToken(t *testing.T) {
	m := NewServerManager(DefaultConfig, "secret", zap.NewNop())
	r := gin.New()
	m.RegisterRoutes(r)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/ws", nil)
	r.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized { t.Errorf("expected 401, got %d", rr.Code) }
	var resp map[string]string
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["error"] != "UNAUTHORIZED" { t.Errorf("expected UNAUTHORIZED error, got %s", resp["error"]) }
}

func TestServerManagerInvalidToken(t *testing.T) {
	m := NewServerManager(DefaultConfig, "secret", zap.NewNop())
	r := gin.New()
	m.RegisterRoutes(r)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/ws?token=invalid", nil)
	r.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized { t.Errorf("expected 401, got %d", rr.Code) }
}

func TestServerManagerValidTokenUpgrade(t *testing.T) {
	m := NewServerManager(DefaultConfig, "test-secret", zap.NewNop())
	r := gin.New()
	m.RegisterRoutes(r)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"sub": "user-123"})
	tokenString, _ := token.SignedString([]byte("test-secret"))
	upstream := httptest.NewServer(r)
	defer upstream.Close()
	wsURL := strings.Replace(upstream.URL, "http://", "ws://", 1) + "/ws?token=" + tokenString
	dialer := websocket.Dialer{HandshakeTimeout: 5 * time.Second}
	conn, _, err := dialer.Dial(wsURL, nil)
	if err != nil { t.Fatalf("websocket dial failed: %v", err) }
	defer conn.Close()
	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, msg, err := conn.ReadMessage()
	if err != nil { t.Fatalf("read welcome failed: %v", err) }
	var welcome map[string]interface{}
	json.Unmarshal(msg, &welcome)
	if welcome["type"] != "connected" { t.Errorf("expected type=connected, got %v", welcome["type"]) }
	if welcome["userId"] != "user-123" { t.Errorf("expected userId=user-123, got %v", welcome["userId"]) }
}

func TestServerManagerPingPong(t *testing.T) {
	m := NewServerManager(DefaultConfig, "test-secret", zap.NewNop())
	r := gin.New()
	m.RegisterRoutes(r)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"sub": "user-1"})
	tokenString, _ := token.SignedString([]byte("test-secret"))
	upstream := httptest.NewServer(r)
	defer upstream.Close()
	wsURL := strings.Replace(upstream.URL, "http://", "ws://", 1) + "/ws?token=" + tokenString
	dialer := websocket.Dialer{HandshakeTimeout: 5 * time.Second}
	conn, _, err := dialer.Dial(wsURL, nil)
	if err != nil { t.Fatalf("dial failed: %v", err) }
	defer conn.Close()
	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	conn.ReadMessage()
	pingMsg, _ := json.Marshal(map[string]string{"type": "ping"})
	conn.WriteMessage(websocket.TextMessage, pingMsg)
	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, resp, err := conn.ReadMessage()
	if err != nil { t.Fatalf("read pong failed: %v", err) }
	var pong map[string]interface{}
	json.Unmarshal(resp, &pong)
	if pong["type"] != "pong" { t.Errorf("expected pong, got %v", pong["type"]) }
}

func TestServerManagerBroadcast(t *testing.T) {
	m := NewServerManager(DefaultConfig, "test-secret", zap.NewNop())
	r := gin.New()
	m.RegisterRoutes(r)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"sub": "user-1"})
	tokenString, _ := token.SignedString([]byte("test-secret"))
	upstream := httptest.NewServer(r)
	defer upstream.Close()
	wsURL := strings.Replace(upstream.URL, "http://", "ws://", 1) + "/ws?token=" + tokenString
	dialer := websocket.Dialer{HandshakeTimeout: 5 * time.Second}
	conn1, _, _ := dialer.Dial(wsURL, nil)
	defer conn1.Close()
	conn2, _, _ := dialer.Dial(wsURL, nil)
	defer conn2.Close()
	for i := 0; i < 2; i++ {
		conn1.SetReadDeadline(time.Now().Add(5 * time.Second))
		conn1.ReadMessage()
	}
	conn2.SetReadDeadline(time.Now().Add(5 * time.Second))
	conn2.ReadMessage()
	msg, _ := json.Marshal(map[string]string{"type": "hello", "text": "hi"})
	conn1.WriteMessage(websocket.TextMessage, msg)
	conn2.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, broadcast, err := conn2.ReadMessage()
	if err != nil { t.Fatalf("conn2 read broadcast failed: %v", err) }
	var bc map[string]interface{}
	json.Unmarshal(broadcast, &bc)
	if bc["type"] != "message" { t.Errorf("expected message broadcast, got %v", bc["type"]) }
}

func TestServerManagerConnectionCount(t *testing.T) {
	m := NewServerManager(DefaultConfig, "test-secret", zap.NewNop())
	r := gin.New()
	m.RegisterRoutes(r)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"sub": "user-1"})
	tokenString, _ := token.SignedString([]byte("test-secret"))
	upstream := httptest.NewServer(r)
	defer upstream.Close()
	wsURL := strings.Replace(upstream.URL, "http://", "ws://", 1) + "/ws?token=" + tokenString
	dialer := websocket.Dialer{HandshakeTimeout: 5 * time.Second}
	conn, _, err := dialer.Dial(wsURL, nil)
	if err != nil { t.Fatalf("dial failed: %v", err) }
	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	conn.ReadMessage()
	if m.GetConnectionCount() != 1 { t.Errorf("expected 1 connection, got %d", m.GetConnectionCount()) }
	conn.Close()
	time.Sleep(50 * time.Millisecond)
	if m.GetConnectionCount() != 0 { t.Errorf("expected 0 connections after close, got %d", m.GetConnectionCount()) }
}

func TestServerManagerShutdown(t *testing.T) {
	m := NewServerManager(DefaultConfig, "test-secret", zap.NewNop())
	r := gin.New()
	m.RegisterRoutes(r)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"sub": "user-1"})
	tokenString, _ := token.SignedString([]byte("test-secret"))
	upstream := httptest.NewServer(r)
	defer upstream.Close()
	wsURL := strings.Replace(upstream.URL, "http://", "ws://", 1) + "/ws?token=" + tokenString
	dialer := websocket.Dialer{HandshakeTimeout: 5 * time.Second}
	conn, _, _ := dialer.Dial(wsURL, nil)
	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	conn.ReadMessage()
	if m.GetConnectionCount() != 1 { t.Fatalf("expected 1 connection, got %d", m.GetConnectionCount()) }
	m.Shutdown()
	if m.GetConnectionCount() != 0 { t.Errorf("expected 0 connections after shutdown, got %d", m.GetConnectionCount()) }
}

// ---------- ConnectionManager ----------

func TestNewConnectionManager(t *testing.T) {
	cm := NewConnectionManager()
	if cm == nil { t.Fatal("expected non-nil manager") }
	if cm.GetConnectionCount() != 0 { t.Errorf("expected 0 connections, got %d", cm.GetConnectionCount()) }
}

func TestConnectionManagerSendToClientNotFound(t *testing.T) {
	cm := NewConnectionManager()
	ok := cm.SendToClient("nonexistent", map[string]string{"type": "test"})
	if ok { t.Error("expected false for nonexistent client") }
}

func TestConnectionManagerBroadcastEmpty(t *testing.T) {
	cm := NewConnectionManager()
	cm.Broadcast(map[string]string{"type": "test"})
}

func TestConnectionManagerRemoveConnection(t *testing.T) {
	cm := NewConnectionManager()
	cm.RemoveConnection("nonexistent")
}

// ---------- DefaultConfig ----------

func TestDefaultConfig(t *testing.T) {
	if DefaultConfig.Path != "/ws" { t.Errorf("expected path /ws, got %s", DefaultConfig.Path) }
	if DefaultConfig.HeartbeatInterval != 30*time.Second { t.Errorf("expected 30s heartbeat, got %v", DefaultConfig.HeartbeatInterval) }
	if DefaultConfig.HeartbeatTimeout != 15*time.Second { t.Errorf("expected 15s timeout, got %v", DefaultConfig.HeartbeatTimeout) }
}

// ---------- Proxy integration ----------

func TestProxyCloseAll(t *testing.T) {
	p := NewProxy(nil)
	p.CloseAll()
}
