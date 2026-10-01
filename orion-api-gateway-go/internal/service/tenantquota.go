package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// TenantTier defines the service tier for a tenant.
type TenantTier string

const (
	TierFree      TenantTier = "free"
	TierStandard  TenantTier = "standard"
	TierPremium   TenantTier = "premium"
	TierEnterprise TenantTier = "enterprise"
)

// TenantQuota defines resource limits per tier.
type TenantQuota struct {
	MaxCPU           int `json:"maxCpu"`           // millicores
	MaxMemory        int `json:"maxMemory"`        // Mi
	MaxRunners       int `json:"maxRunners"`
	MaxQueueDepth    int `json:"maxQueueDepth"`
	MaxTokens        int `json:"maxTokens"`
	MaxAPICallsPerMin int `json:"maxApiCallsPerMin"`
	MaxHoursPerMonth int `json:"maxHoursPerMonth"`
}

// DefaultQuotas maps tenant tiers to their default quotas.
var DefaultQuotas = map[TenantTier]*TenantQuota{
	TierFree:       {MaxCPU: 500, MaxMemory: 512, MaxRunners: 2, MaxQueueDepth: 10, MaxTokens: 10000, MaxAPICallsPerMin: 60, MaxHoursPerMonth: 50},
	TierStandard:   {MaxCPU: 2000, MaxMemory: 2048, MaxRunners: 10, MaxQueueDepth: 50, MaxTokens: 100000, MaxAPICallsPerMin: 300, MaxHoursPerMonth: 200},
	TierPremium:    {MaxCPU: 8000, MaxMemory: 8192, MaxRunners: 50, MaxQueueDepth: 200, MaxTokens: 1000000, MaxAPICallsPerMin: 1000, MaxHoursPerMonth: 1000},
	TierEnterprise: {MaxCPU: 32000, MaxMemory: 32768, MaxRunners: 200, MaxQueueDepth: 1000, MaxTokens: 10000000, MaxAPICallsPerMin: 5000, MaxHoursPerMonth: 10000},
}

// QuotaUsage tracks current resource usage.
type QuotaUsage struct {
	TenantID      string    `json:"tenantId"`
	CPUUsed       int       `json:"cpuUsed"`
	MemoryUsed    int       `json:"memoryUsed"`
	RunnersActive int       `json:"runnersActive"`
	QueueDepth    int       `json:"queueDepth"`
	TokenUsed     int       `json:"tokenUsed"`
	APICalls      int       `json:"apiCalls"`
	HoursUsed     float64   `json:"hoursUsed"`
	LastUpdated   time.Time `json:"lastUpdated"`
}

// QuotaCheckResult holds the result of a quota check.
type QuotaCheckResult struct {
	Allowed   bool   `json:"allowed"`
	Reason    string `json:"reason,omitempty"`
	QuotaType string `json:"quotaType,omitempty"`
	Current   int    `json:"current,omitempty"`
	Limit     int    `json:"limit,omitempty"`
	Remaining int    `json:"remaining,omitempty"`
}

// TenantQuotaService manages tenant resource quotas via Redis.
type TenantQuotaService struct {
	redis       *redis.Client
	mu          sync.RWMutex
	localUsage  map[string]*QuotaUsage // fallback when Redis unavailable
}

// NewTenantQuotaService creates a quota service.
func NewTenantQuotaService(rdb *redis.Client) *TenantQuotaService {
	return &TenantQuotaService{
		redis:      rdb,
		localUsage: make(map[string]*QuotaUsage),
	}
}

// InitQuota initialises a tenant's quota tracking.
func (s *TenantQuotaService) InitQuota(ctx context.Context, tenantID string, tier TenantTier) error {
	if s.redis == nil {
		s.mu.Lock()
		s.localUsage[tenantID] = &QuotaUsage{TenantID: tenantID, LastUpdated: time.Now()}
		s.mu.Unlock()
		return nil
	}
	usage := &QuotaUsage{TenantID: tenantID, LastUpdated: time.Now()}
	data, _ := jsonMarshal(usage)
	return s.redis.Set(ctx, fmt.Sprintf("tenant:quota:%s:usage", tenantID), data, 0).Err()
}

// CheckQuota verifies if a tenant can perform an action.
func (s *TenantQuotaService) CheckQuota(ctx context.Context, tenantID string, quotaType string, amount int) QuotaCheckResult {
	tier := TierStandard
	q := DefaultQuotas[tier]

	usage := s.getUsage(ctx, tenantID)

	switch quotaType {
	case "cpu":
		if usage.CPUUsed+amount > q.MaxCPU {
			return QuotaCheckResult{Allowed: false, Reason: "CPU quota exceeded", QuotaType: "cpu", Current: usage.CPUUsed, Limit: q.MaxCPU, Remaining: q.MaxCPU - usage.CPUUsed}
		}
	case "memory":
		if usage.MemoryUsed+amount > q.MaxMemory {
			return QuotaCheckResult{Allowed: false, Reason: "Memory quota exceeded", QuotaType: "memory", Current: usage.MemoryUsed, Limit: q.MaxMemory}
		}
	case "runners":
		if usage.RunnersActive+amount > q.MaxRunners {
			return QuotaCheckResult{Allowed: false, Reason: "Runner quota exceeded", QuotaType: "runners", Current: usage.RunnersActive, Limit: q.MaxRunners}
		}
	case "queue":
		if usage.QueueDepth+amount > q.MaxQueueDepth {
			return QuotaCheckResult{Allowed: false, Reason: "Queue depth exceeded", QuotaType: "queue", Current: usage.QueueDepth, Limit: q.MaxQueueDepth}
		}
	case "tokens":
		if usage.TokenUsed+amount > q.MaxTokens {
			return QuotaCheckResult{Allowed: false, Reason: "Token quota exceeded", QuotaType: "tokens", Current: usage.TokenUsed, Limit: q.MaxTokens}
		}
	}

	return QuotaCheckResult{Allowed: true}
}

// IncrementUsage increases the usage for a quota type.
func (s *TenantQuotaService) IncrementUsage(ctx context.Context, tenantID string, quotaType string, amount int) error {
	if s.redis == nil {
		s.mu.Lock()
		if usage, ok := s.localUsage[tenantID]; ok {
			switch quotaType {
			case "cpu":
				usage.CPUUsed += amount
			case "memory":
				usage.MemoryUsed += amount
			case "runners":
				usage.RunnersActive += amount
			case "queue":
				usage.QueueDepth += amount
			case "tokens":
				usage.TokenUsed += amount
			}
			usage.LastUpdated = time.Now()
		}
		s.mu.Unlock()
		return nil
	}
	key := fmt.Sprintf("tenant:quota:%s:%s", tenantID, quotaType)
	return s.redis.IncrBy(ctx, key, int64(amount)).Err()
}

// GetUsage retrieves the current usage for a tenant.
func (s *TenantQuotaService) GetUsage(ctx context.Context, tenantID string) *QuotaUsage {
	return s.getUsage(ctx, tenantID)
}

func (s *TenantQuotaService) getUsage(ctx context.Context, tenantID string) *QuotaUsage {
	if s.redis == nil {
		s.mu.RLock()
		defer s.mu.RUnlock()
		if usage, ok := s.localUsage[tenantID]; ok {
			cp := *usage
			return &cp
		}
		return &QuotaUsage{TenantID: tenantID}
	}

	usage := &QuotaUsage{TenantID: tenantID, LastUpdated: time.Now()}
	key := "tenant:quota:%s:usage"
	data, err := s.redis.Get(ctx, fmt.Sprintf(key, tenantID)).Result()
	if err == nil {
		jsonUnmarshal(data, usage)
	}
	return usage
}

func jsonMarshal(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}

func jsonUnmarshal(data string, v interface{}) {
	json.Unmarshal([]byte(data), v)
}
