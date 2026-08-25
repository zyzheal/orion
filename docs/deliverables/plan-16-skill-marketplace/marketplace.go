// Plan 16 — Skill Marketplace Lifecycle
// 本地: internal/skill/ (9 files, service.go 476 lines) has CRUD + RateSkill + CreateReview
// 缺口: no state machine, no versioning, no rating aggregation, no install tracking
package skill

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"
)

type SkillStatus string

const (
	StatusDraft      SkillStatus = "draft"
	StatusSubmitted  SkillStatus = "submitted"
	StatusInReview   SkillStatus = "in_review"
	StatusApproved   SkillStatus = "approved"
	StatusPublished  SkillStatus = "published"
	StatusRejected   SkillStatus = "rejected"
	StatusDeprecated SkillStatus = "deprecated"
	StatusArchived   SkillStatus = "archived"
)

var statusTransitions = map[SkillStatus][]SkillStatus{
	StatusDraft:      {StatusSubmitted},
	StatusSubmitted:  {StatusInReview, StatusDraft},
	StatusInReview:   {StatusApproved, StatusRejected},
	StatusApproved:   {StatusPublished, StatusRejected},
	StatusRejected:   {StatusDraft, StatusArchived},
	StatusPublished:  {StatusDeprecated, StatusArchived},
	StatusDeprecated: {StatusArchived, StatusPublished},
	StatusArchived:   {},
}

func CanTransition(from, to SkillStatus) bool {
	allowed, ok := statusTransitions[from]
	if !ok {
		return false
	}
	for _, s := range allowed {
		if s == to {
			return true
		}
	}
	return false
}

var ErrInvalidTransition = errors.New("invalid status transition")

type SkillVersion struct {
	Version     string     `json:"version"`
	Changelog   string     `json:"changelog"`
	Checksum    string     `json:"checksum"`
	CreatedAt   time.Time  `json:"createdAt"`
	PublishedAt *time.Time `json:"publishedAt,omitempty"`
}

type RatingSummary struct {
	AvgRating    float64     `json:"avgRating"`
	RatingCount  int         `json:"ratingCount"`
	Distribution map[int]int `json:"distribution"`
}

type MarketplaceManager struct {
	mu sync.RWMutex
}

func NewMarketplaceManager() *MarketplaceManager {
	return &MarketplaceManager{}
}

func (m *MarketplaceManager) Submit(ctx context.Context, skillID string, cur SkillStatus) error {
	if !CanTransition(cur, StatusSubmitted) {
		return fmt.Errorf("%w: %s -> %s", ErrInvalidTransition, cur, StatusSubmitted)
	}
	return nil
}

func (m *MarketplaceManager) StartReview(ctx context.Context, skillID string, cur SkillStatus) error {
	if !CanTransition(cur, StatusInReview) {
		return fmt.Errorf("%w: %s -> %s", ErrInvalidTransition, cur, StatusInReview)
	}
	return nil
}

func (m *MarketplaceManager) Approve(ctx context.Context, skillID string, cur SkillStatus, reviewerID string) error {
	if !CanTransition(cur, StatusApproved) {
		return fmt.Errorf("%w: %s -> %s", ErrInvalidTransition, cur, StatusApproved)
	}
	return nil
}

func (m *MarketplaceManager) Reject(ctx context.Context, skillID string, cur SkillStatus, reason string) error {
	if !CanTransition(cur, StatusRejected) {
		return fmt.Errorf("%w: %s -> %s", ErrInvalidTransition, cur, StatusRejected)
	}
	return nil
}

func (m *MarketplaceManager) Publish(ctx context.Context, skillID string, cur SkillStatus, ver SkillVersion) error {
	if !CanTransition(cur, StatusPublished) {
		return fmt.Errorf("%w: %s -> %s", ErrInvalidTransition, cur, StatusPublished)
	}
	now := time.Now()
	ver.PublishedAt = &now
	return nil
}

func (m *MarketplaceManager) Deprecate(ctx context.Context, skillID string, cur SkillStatus, reason string) error {
	if !CanTransition(cur, StatusDeprecated) {
		return fmt.Errorf("%w: %s -> %s", ErrInvalidTransition, cur, StatusDeprecated)
	}
	return nil
}

func (m *MarketplaceManager) Archive(ctx context.Context, skillID string, cur SkillStatus) error {
	if !CanTransition(cur, StatusArchived) {
		return fmt.Errorf("%w: %s -> %s", ErrInvalidTransition, cur, StatusArchived)
	}
	return nil
}

func (m *MarketplaceManager) AggregateRatings(ratings []int) RatingSummary {
	if len(ratings) == 0 {
		return RatingSummary{Distribution: make(map[int]int)}
	}
	dist := make(map[int]int)
	sum := 0
	for _, r := range ratings {
		if r < 1 {
			r = 1
		}
		if r > 5 {
			r = 5
		}
		dist[r]++
		sum += r
	}
	return RatingSummary{AvgRating: float64(sum) / float64(len(ratings)), RatingCount: len(ratings), Distribution: dist}
}

type InstallEvent struct {
	SkillID   string    `json:"skillId"`
	UserID    string    `json:"userId"`
	TenantID  string    `json:"tenantId"`
	Version   string    `json:"version"`
	Timestamp time.Time `json:"timestamp"`
	Source    string    `json:"source"`
}

type InstallTracker struct {
	mu     sync.Mutex
	events map[string][]InstallEvent
}

func NewInstallTracker() *InstallTracker {
	return &InstallTracker{events: make(map[string][]InstallEvent)}
}

func (t *InstallTracker) RecordInstall(skillID, userID, tenantID, version, source string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.events[skillID] = append(t.events[skillID], InstallEvent{
		SkillID: skillID, UserID: userID, TenantID: tenantID,
		Version: version, Timestamp: time.Now(), Source: source,
	})
}

func (t *InstallTracker) GetInstallCount(skillID string) int {
	t.mu.Lock()
	defer t.mu.Unlock()
	return len(t.events[skillID])
}

func (t *InstallTracker) GetRecentInstalls(skillID string, since time.Time) []InstallEvent {
	t.mu.Lock()
	defer t.mu.Unlock()
	var result []InstallEvent
	for _, e := range t.events[skillID] {
		if e.Timestamp.After(since) {
			result = append(result, e)
		}
	}
	return result
}

type ReviewDecision struct {
	ReviewerID  string    `json:"reviewerId"`
	SkillID     string    `json:"skillId"`
	Decision    string    `json:"decision"`
	Comment     string    `json:"comment"`
	Score       int       `json:"score"`
	ReviewedAt  time.Time `json:"reviewedAt"`
}

type ReviewPipeline struct {
	mu        sync.Mutex
	reviews   map[string][]ReviewDecision
	threshold int
}

func NewReviewPipeline(threshold int) *ReviewPipeline {
	return &ReviewPipeline{reviews: make(map[string][]ReviewDecision), threshold: threshold}
}

func (p *ReviewPipeline) SubmitReview(d ReviewDecision) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if d.Score < 0 || d.Score > 100 {
		return fmt.Errorf("score must be 0-100, got %d", d.Score)
	}
	p.reviews[d.SkillID] = append(p.reviews[d.SkillID], d)
	return nil
}

func (p *ReviewPipeline) GetConsensus(skillID string) (approved bool, avgScore float64, reviewCount int) {
	p.mu.Lock()
	defer p.mu.Unlock()
	reviews := p.reviews[skillID]
	if len(reviews) == 0 {
		return false, 0, 0
	}
	sum := 0
	approvals := 0
	for _, r := range reviews {
		sum += r.Score
		if r.Decision == "approve" {
			approvals++
		}
	}
	avgScore = float64(sum) / float64(len(reviews))
	approved = avgScore >= float64(p.threshold) && approvals > len(reviews)/2
	return approved, avgScore, len(reviews)
}