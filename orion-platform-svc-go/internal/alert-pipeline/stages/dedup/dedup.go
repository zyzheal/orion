// Package dedup implements the deduplication stage of the alert pipeline.  It
// uses a fingerprint-based in-memory cache (with TTL) to suppress duplicate
// alerts that share the same source/metric within a configurable window.
package dedup

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"
	"time"

	"orion/platform-svc-go/internal/alert-pipeline/models"

	"go.uber.org/zap"
)

// cacheEntry records when a fingerprint was last seen.
type cacheEntry struct {
	alertID   string
	firstSeen time.Time
	lastSeen  time.Time
	count     int
}

// Stage deduplicates alerts by fingerprint within a TTL window.
type Stage struct {
	mu       sync.RWMutex
	logger   *zap.Logger
	window   time.Duration
	seen     map[string]*cacheEntry // fingerprint -> entry
}

// NewStage creates a dedup stage with the given TTL window.
func NewStage(logger *zap.Logger, window time.Duration) *Stage {
	return &Stage{
		logger: logger,
		window: window,
		seen:   make(map[string]*cacheEntry),
	}
}

// Name returns the canonical stage name.
func (s *Stage) Name() string {
	return "dedup"
}

// Process checks whether the alert is a duplicate.  It never fails; instead
// it marks AlertContext with duplicate metadata and continues the pipeline.
func (s *Stage) Process(ctx context.Context, alertCtx *models.AlertContext) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	fp := s.fingerprint(alertCtx.Alert)
	if fp == "" {
		alertCtx.Enrichments["dedup"] = "skipped"
		return nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	entry, exists := s.seen[fp]
	if exists && time.Since(entry.lastSeen) < s.window {
		entry.lastSeen = time.Now().UTC()
		entry.count++
		alertCtx.IsDuplicate = true
		alertCtx.GroupID = entry.alertID
		alertCtx.Enrichments["dedup"] = "duplicate"
		alertCtx.Enrichments["duplicateCount"] = entry.count
		s.logger.Info("duplicate alert suppressed",
			zap.String("fingerprint", fp),
			zap.String("original", entry.alertID),
			zap.String("current", alertCtx.AlertID),
			zap.Int("count", entry.count))
		return nil
	}

	now := time.Now().UTC()
	s.seen[fp] = &cacheEntry{
		alertID:   alertCtx.AlertID,
		firstSeen: now,
		lastSeen:  now,
		count:     1,
	}
	alertCtx.Enrichments["dedup"] = "unique"
	return nil
}

// Stats returns dedup statistics.
func (s *Stage) Stats() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var total, duplicates int
	for _, e := range s.seen {
		total++
		if e.count > 1 {
			duplicates++
		}
	}
	return map[string]interface{}{
		"activeFingerprints": total,
		"duplicateGroups":    duplicates,
	}
}

// Clear removes all dedup state (useful for testing).
func (s *Stage) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.seen = make(map[string]*cacheEntry)
}

func (s *Stage) fingerprint(v map[string]interface{}) string {
	if v == nil {
		return ""
	}
	var parts []string
	for _, key := range []string{"name", "severity", "sourceType", "sourceId"} {
		if val, ok := v[key]; ok {
			parts = append(parts, fmt.Sprint(val))
		}
	}
	hash := sha256.Sum256([]byte(strings.Join(parts, "|")))
	return "fp-" + hex.EncodeToString(hash[:16])
}
