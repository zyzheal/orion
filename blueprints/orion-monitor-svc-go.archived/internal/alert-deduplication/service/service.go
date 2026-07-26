package service

import (
	"context"
	"crypto/md5"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"orion/monitor-svc-go/internal/alert-deduplication/models"
	"go.uber.org/zap"
)

type AlertDeduplicationService struct {
	logger *zap.Logger
	config *models.DeduplicationConfig
	recent map[string]*models.DeduplicationRecord // fingerprint -> record
}

func NewAlertDeduplicationService(logger *zap.Logger) *AlertDeduplicationService {
	return &AlertDeduplicationService{
		logger: logger,
		config: &models.DeduplicationConfig{
			IsEnabled: true,
			WindowSec: 300,
			FieldMask: "rule_id,severity,resource_id",
		},
		recent: make(map[string]*models.DeduplicationRecord),
	}
}

// Configure sets deduplication configuration.
func (s *AlertDeduplicationService) Configure(tenantID uuid.UUID, isEnabled bool, windowSec int, fieldMask string) {
	if windowSec <= 0 {
		windowSec = 300
	}
	if fieldMask == "" {
		fieldMask = "rule_id,severity,resource_id"
	}
	s.config.TenantID = tenantID
	s.config.IsEnabled = isEnabled
	s.config.WindowSec = windowSec
	s.config.FieldMask = fieldMask
	s.logger.Info("deduplication configured",
		zap.Bool("enabled", isEnabled),
		zap.Int("windowSec", windowSec),
	)
}

// GenerateFingerprint creates a fingerprint for an alert.
func (s *AlertDeduplicationService) GenerateFingerprint(alert map[string]string) string {
	fields := strings.Split(s.config.FieldMask, ",")
	parts := []string{}
	for _, field := range fields {
		if val, ok := alert[strings.TrimSpace(field)]; ok {
			parts = append(parts, val)
		}
	}
	content := strings.Join(parts, "|")
	hash := md5.Sum([]byte(content))
	return fmt.Sprintf("%x", hash)
}

// CheckDuplicate checks if an alert is a duplicate.
func (s *AlertDeduplicationService) CheckDuplicate(ctx context.Context, alert map[string]string) (*models.DeduplicationRecord, bool) {
	if !s.config.IsEnabled {
		return nil, false
	}

	fingerprint := s.GenerateFingerprint(alert)

	// Clean expired records
	cutoff := time.Now().Add(-time.Duration(s.config.WindowSec) * time.Second)
	for k, rec := range s.recent {
		if rec.DedupedAt.Before(cutoff) {
			delete(s.recent, k)
		}
	}

	// Check for existing record
	existing, found := s.recent[fingerprint]
	if found {
		now := time.Now()
		record := &models.DeduplicationRecord{
			ID:          uuid.New(),
			TenantID:    s.config.TenantID,
			OriginalID:  existing.ID,
			DuplicateID: uuid.New(),
			Fingerprint: fingerprint,
			DedupedAt:   now,
		}
		s.logger.Info("alert deduplicated",
			zap.String("fingerprint", fingerprint),
			zap.String("originalId", existing.ID.String()),
		)
		return record, true
	}

	// Store as original
	now := time.Now()
	record := &models.DeduplicationRecord{
		ID:          uuid.New(),
		TenantID:    s.config.TenantID,
		OriginalID:  uuid.New(),
		DuplicateID: uuid.Nil,
		Fingerprint: fingerprint,
		DedupedAt:   now,
	}
	s.recent[fingerprint] = record

	s.logger.Debug("alert stored as original",
		zap.String("fingerprint", fingerprint),
	)
	return record, false
}

// Stats returns deduplication statistics.
func (s *AlertDeduplicationService) Stats() map[string]interface{} {
	cutoff := time.Now().Add(-time.Duration(s.config.WindowSec) * time.Second)
	activeCount := 0
	for _, rec := range s.recent {
		if rec.DedupedAt.After(cutoff) {
			activeCount++
		}
	}

	return map[string]interface{}{
		"is_enabled":   s.config.IsEnabled,
		"window_sec":   s.config.WindowSec,
		"field_mask":   s.config.FieldMask,
		"active_count": activeCount,
		"total_count":  len(s.recent),
	}
}

// IsEnabled checks if deduplication is enabled.
func (s *AlertDeduplicationService) IsEnabled() bool {
	return s.config.IsEnabled
}
