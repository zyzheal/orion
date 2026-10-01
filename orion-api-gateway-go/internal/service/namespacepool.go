package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// NamespacePool describes a namespace pool.
type NamespacePool struct {
	ID         string    `json:"id"`
	PoolIndex  int       `json:"poolIndex"`
	TenantStart int      `json:"tenantStart"`
	TenantEnd   int      `json:"tenantEnd"`
	TenantCount int      `json:"tenantCount"`
	MaxTenants int       `json:"maxTenants"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// TenantAllocation tracks a tenant's namespace pool assignment.
type TenantAllocation struct {
	TenantID   string    `json:"tenantId"`
	TenantSeq  int       `json:"tenantSeq"`
	PoolID     string    `json:"poolId"`
	PoolIndex  int       `json:"poolIndex"`
	AllocatedAt time.Time `json:"allocatedAt"`
}

const (
	maxPools          = 100
	maxTenantsPerPool = 10
)

// NamespacePoolManager manages tenant-to-namespace-pool allocation.
type NamespacePoolManager struct {
	redis       *redis.Client
	mu          sync.RWMutex
	localAlloc  map[string]*TenantAllocation
}

// NewNamespacePoolManager creates a pool manager.
func NewNamespacePoolManager(rdb *redis.Client) *NamespacePoolManager {
	return &NamespacePoolManager{
		redis:      rdb,
		localAlloc: make(map[string]*TenantAllocation),
	}
}

// CalculatePoolIndex returns the pool index for a tenant sequence number.
func (m *NamespacePoolManager) CalculatePoolIndex(tenantSeq int) int {
	return (tenantSeq + maxTenantsPerPool - 1) / maxTenantsPerPool
}

// Allocate assigns a tenant to a namespace pool.
func (m *NamespacePoolManager) Allocate(ctx context.Context, tenantID string, tenantSeq int) (*TenantAllocation, error) {
	poolIndex := m.CalculatePoolIndex(tenantSeq)
	poolID := fmt.Sprintf("orion-tenant-pool-%03d", poolIndex)

	alloc := &TenantAllocation{
		TenantID:    tenantID,
		TenantSeq:   tenantSeq,
		PoolID:      poolID,
		PoolIndex:   poolIndex,
		AllocatedAt: time.Now(),
	}

	if m.redis == nil {
		m.mu.Lock()
		m.localAlloc[tenantID] = alloc
		m.mu.Unlock()
		return alloc, nil
	}

	key := fmt.Sprintf("namespace:allocation:%s", tenantID)
	data, _ := jsonMarshalNS(alloc)
	if err := m.redis.Set(ctx, key, data, 0).Err(); err != nil {
		return nil, err
	}
	poolKey := fmt.Sprintf("namespace:pool:%03d:count", poolIndex)
	m.redis.Incr(ctx, poolKey)

	return alloc, nil
}

// GetAllocation retrieves a tenant's pool allocation.
func (m *NamespacePoolManager) GetAllocation(ctx context.Context, tenantID string) (*TenantAllocation, error) {
	if m.redis == nil {
		m.mu.RLock()
		defer m.mu.RUnlock()
		if alloc, ok := m.localAlloc[tenantID]; ok {
			cp := *alloc
			return &cp, nil
		}
		return nil, fmt.Errorf("no allocation for tenant %s", tenantID)
	}

	key := fmt.Sprintf("namespace:allocation:%s", tenantID)
	data, err := m.redis.Get(ctx, key).Result()
	if err != nil {
		return nil, err
	}
	var alloc TenantAllocation
	jsonUnmarshalNS(data, &alloc)
	return &alloc, nil
}

// Release removes a tenant's pool allocation.
func (m *NamespacePoolManager) Release(ctx context.Context, tenantID string) error {
	if m.redis == nil {
		m.mu.Lock()
		delete(m.localAlloc, tenantID)
		m.mu.Unlock()
		return nil
	}

	alloc, err := m.GetAllocation(ctx, tenantID)
	if err != nil {
		return nil // already released
	}

	key := fmt.Sprintf("namespace:allocation:%s", tenantID)
	m.redis.Del(ctx, key)

	poolKey := fmt.Sprintf("namespace:pool:%03d:count", alloc.PoolIndex)
	m.redis.Decr(ctx, poolKey)

	return nil
}

func jsonMarshalNS(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}

func jsonUnmarshalNS(data string, v interface{}) {
	json.Unmarshal([]byte(data), v)
}
