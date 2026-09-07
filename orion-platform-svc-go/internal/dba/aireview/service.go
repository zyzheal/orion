package aireview

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ReviewRepository is the persistence contract the Service needs.
type ReviewRepository interface {
	Insert(ctx context.Context, rec *ReviewRecord) error
	Get(ctx context.Context, id string) (*ReviewRecord, error)
	ListByTenant(ctx context.Context, tenantID string, limit int) ([]ReviewRecord, error)
}

// Service wraps the Reviewer and adds persistence + tenant scoping.
type Service struct {
	reviewer *Reviewer
	repo     ReviewRepository // may be nil — history then disabled
	log      *zap.Logger
}

// NewService wires a Service. Pass nil repo to disable history persistence.
func NewService(reviewer *Reviewer, repo ReviewRepository, log *zap.Logger) *Service {
	if log == nil {
		log = zap.NewNop()
	}
	return &Service{reviewer: reviewer, repo: repo, log: log}
}

// ReviewSQL runs the review, persists the result when a repo is wired, and
// returns the enriched result (with ID/TenantID populated).
//
// Errors are only returned when the reviewer itself fails — persistence
// errors are logged but do not fail the review, because a successful
// review is more valuable than a persisted record.
func (s *Service) ReviewSQL(ctx context.Context, tenantID string, req SQLReviewRequest) (*SQLReviewResult, error) {
	if s.reviewer == nil {
		return nil, fmt.Errorf("aireview: reviewer not configured")
	}
	result, err := s.reviewer.ReviewForTenant(ctx, req, tenantID)
	if err != nil {
		return nil, err
	}
	if tenantID == "" {
		tenantID = "_anonymous"
	}
	result.TenantID = tenantID

	if s.repo != nil {
		rec, jsonErr := s.recordFromResult(result, req)
		if jsonErr == nil {
			if err := s.repo.Insert(ctx, rec); err != nil {
				s.log.Warn("aireview: history insert failed",
					zap.String("tenant_id", tenantID),
					zap.String("review_id", result.ID),
					zap.Error(err),
				)
			} else {
				result.ID = rec.ID
			}
		} else {
			s.log.Warn("aireview: history serialization failed",
				zap.String("tenant_id", tenantID),
				zap.Error(jsonErr),
			)
		}
	} else if result.ID == "" {
		// No persistence: still give the caller a stable ID for tracing.
		result.ID = uuid.New().String()
	}

	s.log.Debug("aireview: review complete",
		zap.String("tenant_id", tenantID),
		zap.String("verdict", result.Verdict),
		zap.Int("score", result.Score),
		zap.Bool("ai_called", result.AICalled),
		zap.String("sql_redacted", RedactSQL(req.SQL)),
		zap.Int("sql_len", len(req.SQL)),
		zap.Duration("duration", result.Duration),
	)
	return result, nil
}

// GetReviewHistory returns up to limit recent reviews for tenantID.
func (s *Service) GetReviewHistory(ctx context.Context, tenantID string, limit int) ([]ReviewRecord, error) {
	if s.repo == nil {
		return []ReviewRecord{}, nil
	}
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	return s.repo.ListByTenant(ctx, tenantID, limit)
}

// GetReviewResult fetches a single persisted review by ID.
func (s *Service) GetReviewResult(ctx context.Context, id string) (*ReviewRecord, error) {
	if s.repo == nil {
		return nil, sentinel.NotFound
	}
	rec, err := s.repo.Get(ctx, id)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return rec, nil
}

// recordFromResult marshals the review result into a ReviewRecord for persistence.
func (s *Service) recordFromResult(r *SQLReviewResult, req SQLReviewRequest) (*ReviewRecord, error) {
	if r.ID == "" {
		r.ID = uuid.New().String()
	}
	localJSON, err := marshalJSON(r.LocalAudit)
	if err != nil {
		return nil, fmt.Errorf("aireview: marshal local audit: %w", err)
	}
	aiJSON, err := marshalJSON(r.AISuggestions)
	if err != nil {
		return nil, fmt.Errorf("aireview: marshal ai suggestions: %w", err)
	}
	rec := &ReviewRecord{
		ID:           r.ID,
		TenantID:     r.TenantID,
		SQL:          req.SQL,
		DBType:       req.DBType,
		Verdict:      r.Verdict,
		Score:        r.Score,
		ModelUsed:    r.ModelUsed,
		DurationMs:   r.Duration.Milliseconds(),
		LocalAudit:   localJSON,
		AISuggestions: aiJSON,
		CreatedAt:    time.Now().UTC(),
	}
	return rec, nil
}

// marshalJSON marshals v to compact JSON bytes as a string.
func marshalJSON(v interface{}) (string, error) {
	if v == nil {
		return "{}", nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
