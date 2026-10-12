package script

import (
	"strings"
	"sync"
)

// Whitelist enforces per-tenant ScriptType allow-lists. Empty whitelist
// == closed (no types allowed) unless AllowEmpty is set — this follows
// the "deny by default" principle for a release gate.
type Whitelist struct {
	mu   sync.RWMutex
	// tenants[tenantID] = set of ScriptType strings.
	tenants map[string]map[string]struct{}
	// AllowEmpty, when true, treats an unknown/empty tenant as "allow
	// everything". Intended only for tests or single-tenant dev mode.
	AllowEmpty bool
}

// NewWhitelist returns an empty Whitelist (deny by default).
func NewWhitelist() *Whitelist {
	return &Whitelist{tenants: make(map[string]map[string]struct{})}
}

// NewWhitelistPermissive is the test/dev variant that allows everything
// when a tenant is unknown. Never use in production.
func NewWhitelistPermissive() *Whitelist {
	return &Whitelist{
		tenants:    make(map[string]map[string]struct{}),
		AllowEmpty: true,
	}
}

// Add allows one ScriptType for a tenant. Idempotent.
func (w *Whitelist) Add(tenantID, scriptType string) {
	t := strings.ToLower(strings.TrimSpace(scriptType))
	if t == "" {
		return
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.tenants[tenantID] == nil {
		w.tenants[tenantID] = make(map[string]struct{})
	}
	w.tenants[tenantID][t] = struct{}{}
}

// AddAll registers multiple ScriptTypes for a tenant.
func (w *Whitelist) AddAll(tenantID string, types ...string) {
	for _, t := range types {
		w.Add(tenantID, t)
	}
}

// Allow returns true if scriptType is whitelisted for the tenant.
func (w *Whitelist) Allow(tenantID, scriptType string) bool {
	t := strings.ToLower(strings.TrimSpace(scriptType))
	if t == "" {
		return false
	}
	w.mu.RLock()
	defer w.mu.RUnlock()
	tenantSet, ok := w.tenants[tenantID]
	if !ok {
		return w.AllowEmpty
	}
	if len(tenantSet) == 0 {
		return w.AllowEmpty
	}
	_, found := tenantSet[t]
	return found
}

// ClearAll removes all tenant entries. Test helper.
func (w *Whitelist) ClearAll() {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.tenants = make(map[string]map[string]struct{})
}
