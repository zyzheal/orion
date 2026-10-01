package service

import (
	"encoding/json"
	"hash/fnv"
	"os"
	"strings"
	"sync"
)

// ModuleRoutingEntry defines routing for a single module.
type ModuleRoutingEntry struct {
	GoURL    string `json:"goUrl"`
	TSURL    string `json:"tsUrl"`
	GoWeight int    `json:"goWeight"`
	Enabled  bool   `json:"enabled"`
}

// ModuleRouting maps path prefixes to routing entries.
type ModuleRouting map[string]*ModuleRoutingEntry

// RoutingResolution describes the resolved target for a request.
type RoutingResolution struct {
	Target string
	Source string // "static", "go", "ts", "disabled"
}

// ModuleRoutingService provides module-level TS→Go traffic routing.
type ModuleRoutingService struct {
	mu     sync.RWMutex
	config ModuleRouting
}

// NewModuleRoutingService creates a service from the MODULE_ROUTING env var.
func NewModuleRoutingService() *ModuleRoutingService {
	s := &ModuleRoutingService{
		config: make(ModuleRouting),
	}
	s.loadConfig()
	return s
}

func (s *ModuleRoutingService) loadConfig() {
	raw := os.Getenv("MODULE_ROUTING")
	if raw == "" {
		return
	}
	var cfg ModuleRouting
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		return
	}
	s.mu.Lock()
	s.config = cfg
	s.mu.Unlock()
}

// Reload re-reads the MODULE_ROUTING env var.
func (s *ModuleRoutingService) Reload() {
	s.loadConfig()
}

// ResolveTarget determines where to route a request.
func (s *ModuleRoutingService) ResolveTarget(currentTarget, requestPath, tenantID, overrideHeader string) RoutingResolution {
	if overrideHeader != "" {
		return RoutingResolution{Target: overrideHeader, Source: "static"}
	}

	s.mu.RLock()
	rule := s.matchRule(requestPath)
	s.mu.RUnlock()

	if rule == nil {
		return RoutingResolution{Target: currentTarget, Source: "static"}
	}

	if !rule.Enabled {
		return RoutingResolution{Target: rule.TSURL, Source: "disabled"}
	}

	hash := consistentHashModule(tenantID)
	if hash < rule.GoWeight {
		return RoutingResolution{Target: rule.GoURL, Source: "go"}
	}
	return RoutingResolution{Target: rule.TSURL, Source: "ts"}
}

func (s *ModuleRoutingService) matchRule(requestPath string) *ModuleRoutingEntry {
	var matched *ModuleRoutingEntry
	longestLen := 0
	for prefix, rule := range s.config {
		if requestPath == prefix {
			return rule
		}
		if strings.HasPrefix(requestPath, prefix) && len(prefix) > longestLen {
			nextChar := ""
			if len(requestPath) > len(prefix) {
				nextChar = string(requestPath[len(prefix)])
			}
			if nextChar == "" || nextChar == "/" || strings.HasSuffix(prefix, "/") {
				longestLen = len(prefix)
				matched = rule
			}
		}
	}
	return matched
}

// GetConfig returns the current routing configuration.
func (s *ModuleRoutingService) GetConfig() ModuleRouting {
	s.mu.RLock()
	defer s.mu.RUnlock()
	cp := make(ModuleRouting, len(s.config))
	for k, v := range s.config {
		cp[k] = v
	}
	return cp
}

// GetEnabledCount returns the number of enabled rules.
func (s *ModuleRoutingService) GetEnabledCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	count := 0
	for _, r := range s.config {
		if r.Enabled {
			count++
		}
	}
	return count
}

// GetRuleCount returns the total number of rules.
func (s *ModuleRoutingService) GetRuleCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.config)
}

// HashTenant exposes the hash function for testing.
func HashTenant(tenantID string) int {
	return consistentHashModule(tenantID)
}

func consistentHashModule(tenantID string) int {
	if tenantID == "" || tenantID == "unknown" {
		return 101
	}
	h := fnv.New32a()
	h.Write([]byte(tenantID))
	return int(h.Sum32() % 100)
}
