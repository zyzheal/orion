package resolver

import (
	"context"
	"fmt"
	"sort"
	"sync"

	"orion/platform-svc-go/internal/recipient/models"
)

// Resolver 把 RecipientSpec 解析为具体用户列表。
type Resolver interface {
	// Kind 返回该 Resolver 支持的 Kind。
	Kind() models.Kind

	// Resolve 执行解析，10s 硬超时由 service 层控制。
	Resolve(ctx context.Context, spec models.RecipientSpec) ([]models.ResolvedUser, error)
}

// Registry 是 Resolver 注册表（ADR-012 模式）。
type Registry struct {
	mu       sync.RWMutex
	resolvers map[models.Kind]Resolver
}

// NewRegistry 创建空的 Registry。
func NewRegistry() *Registry {
	return &Registry{
		resolvers: make(map[models.Kind]Resolver),
	}
}

// Register 注册一个 Resolver。若 Kind 重复则覆盖。
func (r *Registry) Register(res Resolver) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.resolvers[res.Kind()] = res
}

// Get 根据 Kind 获取 Resolver。
func (r *Registry) Get(kind models.Kind) (Resolver, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	res, ok := r.resolvers[kind]
	return res, ok
}

// Kinds 返回所有已注册 Kind（有序）。
func (r *Registry) Kinds() []models.Kind {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]models.Kind, 0, len(r.resolvers))
	for k := range r.resolvers {
		out = append(out, k)
	}
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })
	return out
}

// Resolve 是 Registry 的便捷方法：根据 spec.Kind 分发到对应 Resolver。
func (r *Registry) Resolve(ctx context.Context, spec models.RecipientSpec) ([]models.ResolvedUser, error) {
	res, ok := r.Get(spec.Kind)
	if !ok {
		return nil, fmt.Errorf("E_RECIP_KIND_UNKNOWN: no resolver for kind %q", spec.Kind)
	}
	if spec.TenantID == "" {
		return nil, fmt.Errorf("E_RECIP_PARAM_MISSING: tenant_id is required")
	}
	return res.Resolve(ctx, spec)
}
