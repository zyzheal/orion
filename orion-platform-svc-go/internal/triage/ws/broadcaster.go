// Package ws 提供 Triage WebSocket 事件广播能力。
//
// 3 种事件（参见 triage-api-contract-design §2.3）：
//   - triage.alert.new         新告警
//   - triage.alert.updated     告警状态更新
//   - triage.oncall.handoff    值班交接
//
// 特性：
//   - Feature Flag: triage.websocket.enabled (默认 true)
//   - 按 tenant_id + user_id 分房间
//   - 非阻塞发送（channel 满则丢，由客户端重连补偿）
package ws

import (
	"encoding/json"
	"sync"

	"orion/platform-svc-go/internal/triage/models"
)

// Client 是一个 WebSocket 客户端连接。
type Client struct {
	UserID    string
	TenantID  string
	Send      chan []byte
}

// Broadcaster 管理所有连接的 Triage WebSocket 客户端。
type Broadcaster struct {
	mu      sync.RWMutex
	clients map[string]map[string]*Client // tenantID -> userID -> Client
	enabled bool
}

// NewBroadcaster 创建新的广播器。
func NewBroadcaster(enabled bool) *Broadcaster {
	return &Broadcaster{
		clients: make(map[string]map[string]*Client),
		enabled: enabled,
	}
}

// Subscribe 注册一个客户端。
func (b *Broadcaster) Subscribe(userID, tenantID string) *Client {
	b.mu.Lock()
	defer b.mu.Unlock()

	cl := &Client{
		UserID:   userID,
		TenantID: tenantID,
		Send:     make(chan []byte, 100),
	}

	if b.clients[tenantID] == nil {
		b.clients[tenantID] = make(map[string]*Client)
	}
	b.clients[tenantID][userID] = cl
	return cl
}

// Unsubscribe 移除客户端。
func (b *Broadcaster) Unsubscribe(userID, tenantID string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if m := b.clients[tenantID]; m != nil {
		delete(m, userID)
	}
}

// Broadcast 向指定用户广播事件（非阻塞）。
func (b *Broadcaster) Broadcast(tenantID, userID string, evt *models.WSPayload) bool {
	if !b.enabled {
		return false
	}
	b.mu.RLock()
	defer b.mu.RUnlock()

	m := b.clients[tenantID]
	if m == nil {
		return false
	}
	cl := m[userID]
	if cl == nil {
		return false
	}

	data, err := json.Marshal(evt)
	if err != nil {
		return false
	}

	select {
	case cl.Send <- data:
		return true
	default:
		// channel 满则丢弃（客户端会重连重取）
		return false
	}
}

// BroadcastTriage 便捷方法：向该租户的某用户广播 Triage 事件。
func (b *Broadcaster) BroadcastTriage(tenantID, userID string, evtType models.WSEvent, payload any) bool {
	evt := &models.WSPayload{
		Type:     evtType,
		TenantID: tenantID,
		UserID:   userID,
		Payload:  payload,
	}
	return b.Broadcast(tenantID, userID, evt)
}
