package models

import "time"

// CacheMetrics holds collected cache statistics.
type CacheMetrics struct {
	Name              string    `json:"name"`
	Type              string    `json:"type"` // redis, memcached, local
	ConnectionsActive int64     `json:"connections_active"`
	ConnectionsTotal  int64     `json:"connections_total"`
	MemoryUsed        uint64    `json:"memory_used"`
	MemoryTotal       uint64    `json:"memory_total"`
	HitCount          int64     `json:"hit_count"`
	MissCount         int64     `json:"miss_count"`
	EvictionCount     int64     `json:"eviction_count"`
	KeyCount          int64     `json:"key_count"`
	ExpirationCount   int64     `json:"expiration_count"`
	AvgLatencyMs      float64   `json:"avg_latency_ms"`
	P95LatencyMs      float64   `json:"p95_latency_ms"`
	Status            string    `json:"status"`
	LastCollectedAt   time.Time `json:"last_collected_at"`
}

// CacheHealthCheckResult represents a health check result.
type CacheHealthCheckResult struct {
	Name    string    `json:"name"`
	Healthy bool      `json:"healthy"`
	Message string    `json:"message"`
	LatencyMs int     `json:"latency_ms"`
}

// CacheConfig defines cache monitoring settings.
type CacheConfig struct {
	Name              string `json:"name"`
	Type              string `json:"type"`
	Host              string `json:"host"`
	Port              int    `json:"port"`
	CollectionInterval int  `json:"collection_interval_sec"`
	IsEnabled         bool   `json:"is_enabled"`
}
