package service

import (
	"context"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"net/url"
	"os"
	"strings"
	"sync"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// RouteTarget defines a gray-release routing rule.
type RouteTarget struct {
	Path   string `json:"path"`
	Target string `json:"target"` // "ts" or "go"
	Weight int    `json:"weight"` // 0-100
}

// GrayConfig holds the gray release configuration loaded from Redis.
type GrayConfig struct {
	RouteTargets  []RouteTarget `json:"routeTargets"`
	DefaultTarget string        `json:"defaultTarget"` // "ts" or "go"
	Version       int           `json:"version"`
}

// GrayRoutingResult describes where a request should be routed.
type GrayRoutingResult struct {
	Target     string // full URL
	TargetID   string // "ts" or "go"
	Source     string // "redis", "fallback", "static"
	MatchedRule *RouteTarget
}

// GrayReleaseService provides dynamic gray-release routing based on Redis config.
type GrayReleaseService struct {
	mu            sync.RWMutex
	enabled       bool
	redis         *redis.Client
	subscriber    *redis.Client
	currentConfig *GrayConfig
	redisKey      string
	redisChannel  string
	tsServiceURL  string
	goServiceURL  string
	defaultTarget string
	logger        *zap.Logger
}

// NewGrayReleaseService creates a gray release service.
func NewGrayReleaseService(rdb *redis.Client, tsURL, goURL string, logger *zap.Logger) *GrayReleaseService {
	enabled := os.Getenv("GRAY_RELEASE_ENABLED") == "true"
	defaultTarget := os.Getenv("GRAY_RELEASE_DEFAULT_TARGET")
	if defaultTarget != "go" {
		defaultTarget = "ts"
	}
	return &GrayReleaseService{
		enabled:       enabled,
		redis:         rdb,
		redisKey:      "gray-release:config",
		redisChannel:  "gray-release:config",
		tsServiceURL:  tsURL,
		goServiceURL:  goURL,
		defaultTarget: defaultTarget,
		logger:        logger,
	}
}

// Connect connects to Redis and loads the current configuration.
func (s *GrayReleaseService) Connect(ctx context.Context) error {
	if !s.enabled || s.redis == nil {
		s.logger.Info("[GrayRelease] disabled, skipping Redis connection")
		return nil
	}

	if err := s.loadConfigFromRedis(ctx); err != nil {
		s.logger.Warn("[GrayRelease] failed to load config, using defaults", zap.Error(err))
	}

	go s.subscribeToChanges(context.Background())

	s.logger.Info("[GrayRelease] initialized",
		zap.Int("targets", len(s.currentConfig.RouteTargets)),
		zap.Int("version", s.currentConfig.Version))
	return nil
}

func (s *GrayReleaseService) loadConfigFromRedis(ctx context.Context) error {
	raw, err := s.redis.Get(ctx, s.redisKey).Result()
	if err != nil {
		s.currentConfig = &GrayConfig{DefaultTarget: s.defaultTarget, Version: 0}
		return err
	}

	cfg, err := s.parseConfig(raw)
	if err != nil {
		s.currentConfig = &GrayConfig{DefaultTarget: s.defaultTarget, Version: 0}
		return err
	}
	s.mu.Lock()
	s.currentConfig = cfg
	s.mu.Unlock()
	return nil
}

func (s *GrayReleaseService) parseConfig(raw string) (*GrayConfig, error) {
	var cfg GrayConfig
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	if cfg.DefaultTarget != "ts" && cfg.DefaultTarget != "go" {
		cfg.DefaultTarget = s.defaultTarget
	}
	valided := make([]RouteTarget, 0, len(cfg.RouteTargets))
	for _, rule := range cfg.RouteTargets {
		if rule.Path == "" || rule.Target == "" {
			continue
		}
		if rule.Target != "go" {
			rule.Target = "ts"
		}
		if rule.Weight < 0 {
			rule.Weight = 0
		}
		if rule.Weight > 100 {
			rule.Weight = 100
		}
		valided = append(valided, rule)
	}
	cfg.RouteTargets = valided
	return &cfg, nil
}

func (s *GrayReleaseService) subscribeToChanges(ctx context.Context) {
	if s.redis == nil {
		return
	}
	sub := s.redis.Subscribe(ctx, s.redisChannel)
	defer sub.Close()
	ch := sub.Channel()
	for msg := range ch {
		s.handleConfigMessage(msg.Payload)
	}
}

func (s *GrayReleaseService) handleConfigMessage(message string) {
	cfg, err := s.parseConfig(message)
	if err != nil {
		s.logger.Warn("[GrayRelease] invalid config message", zap.Error(err))
		return
	}
	s.mu.Lock()
	if s.currentConfig != nil && s.currentConfig.Version == cfg.Version {
		s.mu.Unlock()
		return
	}
	s.currentConfig = cfg
	s.mu.Unlock()
	s.logger.Info("[GrayRelease] config updated",
		zap.Int("version", cfg.Version),
		zap.Int("targets", len(cfg.RouteTargets)))
}

// GetTarget resolves where a request should be routed.
func (s *GrayReleaseService) GetTarget(requestPath, tenantID, overrideHeader string) GrayRoutingResult {
	if !s.enabled {
		return GrayRoutingResult{
			Target:   s.tsServiceURL,
			TargetID: "ts",
			Source:   "static",
		}
	}

	s.mu.RLock()
	cfg := s.currentConfig
	s.mu.RUnlock()

	if cfg != nil && len(cfg.RouteTargets) > 0 {
		matched := s.matchRule(cfg, requestPath)
		if matched != nil {
			if s.applyWeight(matched, tenantID, overrideHeader) {
				return GrayRoutingResult{
					Target: s.goServiceURL, TargetID: "go",
					Source: "redis", MatchedRule: matched,
				}
			}
			return GrayRoutingResult{
				Target: s.tsServiceURL, TargetID: "ts",
				Source: "redis", MatchedRule: matched,
			}
		}
		defaultURL := s.tsServiceURL
		defaultID := "ts"
		if cfg.DefaultTarget == "go" {
			defaultURL = s.goServiceURL
			defaultID = "go"
		}
		return GrayRoutingResult{Target: defaultURL, TargetID: defaultID, Source: "redis"}
	}

	return GrayRoutingResult{
		Target:   s.tsServiceURL,
		TargetID: "ts",
		Source:   "fallback",
	}
}

func (s *GrayReleaseService) matchRule(cfg *GrayConfig, requestPath string) *RouteTarget {
	var matched *RouteTarget
	longestLen := 0
	for i := range cfg.RouteTargets {
		rule := &cfg.RouteTargets[i]
		if requestPath == rule.Path {
			return rule
		}
		if strings.HasPrefix(requestPath, rule.Path) && len(rule.Path) > longestLen {
			nextChar := ""
			if len(requestPath) > len(rule.Path) {
				nextChar = string(requestPath[len(rule.Path)])
			}
			if nextChar == "" || nextChar == "/" || strings.HasSuffix(rule.Path, "/") {
				longestLen = len(rule.Path)
				matched = rule
			}
		}
	}
	return matched
}

func (s *GrayReleaseService) applyWeight(rule *RouteTarget, tenantID, overrideHeader string) bool {
	if overrideHeader == "go" {
		return true
	}
	if overrideHeader == "ts" {
		return false
	}
	if rule.Weight == 0 {
		return false
	}
	if rule.Weight == 100 {
		return rule.Target == "go"
	}
	hash := consistentHash(tenantID)
	return hash < rule.Weight
}

func consistentHash(tenantID string) int {
	if tenantID == "" || tenantID == "unknown" {
		return 101
	}
	h := fnv.New32a()
	h.Write([]byte(tenantID))
	return int(h.Sum32() % 100)
}

// IsEnabled returns whether gray release is enabled.
func (s *GrayReleaseService) IsEnabled() bool {
	return s.enabled
}

// GetConfig returns the current configuration (for debugging).
func (s *GrayReleaseService) GetConfig() *GrayConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.currentConfig
}

// LoadConfig manually loads a configuration (for testing).
func (s *GrayReleaseService) LoadConfig(cfg *GrayConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.currentConfig = cfg
}

// Close shuts down the gray release service.
func (s *GrayReleaseService) Close() {
	s.logger.Info("[GrayRelease] closed")
}

// ParseRedisURL extracts host and port from a Redis URL.
func ParseRedisURL(redisURL string) (host string, port string) {
	u, err := url.Parse(redisURL)
	if err != nil {
		return "localhost", "6379"
	}
	host = u.Hostname()
	port = u.Port()
	if host == "" {
		host = "localhost"
	}
	if port == "" {
		port = "6379"
	}
	return host, port
}
