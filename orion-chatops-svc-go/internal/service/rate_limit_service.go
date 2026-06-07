package service

import (
	"context"
	"fmt"
	"time"

	"orion/chatops-svc-go/internal/models"
	"orion/chatops-svc-go/internal/repository"

	"github.com/google/uuid"
)

// RateLimitService manages rate limit rules and enforces them.
type RateLimitService struct {
	repo *repository.Repository
}

func NewRateLimitService(repo *repository.Repository) *RateLimitService {
	return &RateLimitService{repo: repo}
}

func (s *RateLimitService) Create(ctx context.Context, tenantID string, req models.CreateRateLimitRequest) (*models.ChatOpsRateLimit, error) {
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	rl := &models.ChatOpsRateLimit{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		TargetType:    req.TargetType,
		LimitType:     req.LimitType,
		LimitCount:    req.LimitCount,
		WindowSeconds: req.WindowSeconds,
		Description:   req.Description,
		Enabled:       enabled,
	}
	if req.TargetID != "" {
		rl.TargetID = &req.TargetID
	}
	if req.CommandName != "" {
		rl.CommandName = &req.CommandName
	}
	if err := s.repo.CreateRateLimit(ctx, rl); err != nil {
		return nil, err
	}
	return rl, nil
}

func (s *RateLimitService) Get(ctx context.Context, tenantID, id string) (*models.ChatOpsRateLimit, error) {
	return s.repo.GetRateLimit(ctx, tenantID, id)
}

func (s *RateLimitService) List(ctx context.Context, tenantID string) ([]models.ChatOpsRateLimit, error) {
	return s.repo.ListRateLimits(ctx, tenantID)
}

func (s *RateLimitService) Update(ctx context.Context, tenantID, id string, req models.UpdateRateLimitRequest) (*models.ChatOpsRateLimit, error) {
	existing, err := s.repo.GetRateLimit(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if req.TargetType != nil {
		existing.TargetType = *req.TargetType
	}
	if req.TargetID != nil {
		existing.TargetID = req.TargetID
	}
	if req.CommandName != nil {
		existing.CommandName = req.CommandName
	}
	if req.LimitType != nil {
		existing.LimitType = *req.LimitType
	}
	if req.LimitCount != nil {
		existing.LimitCount = *req.LimitCount
	}
	if req.WindowSeconds != nil {
		existing.WindowSeconds = *req.WindowSeconds
	}
	if req.Description != nil {
		existing.Description = *req.Description
	}
	if req.Enabled != nil {
		existing.Enabled = *req.Enabled
	}
	if err := s.repo.UpdateRateLimit(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *RateLimitService) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteRateLimit(ctx, tenantID, id)
}

// CheckRateLimit checks if a user+command is within rate limits.
// Returns true if allowed, false if rate limited.
func (s *RateLimitService) CheckRateLimit(ctx context.Context, tenantID, userID, commandName string) (bool, error) {
	limits, err := s.repo.GetRateLimitsForCommand(ctx, tenantID, userID, commandName)
	if err != nil {
		return false, fmt.Errorf("get rate limits: %w", err)
	}

	for _, rl := range limits {
		windowStart := time.Now().Add(-time.Duration(rl.WindowSeconds) * time.Second)

		// Determine command filter: if limit is command-specific, filter by command name
		cmdFilter := ""
		if rl.CommandName != nil && *rl.CommandName == commandName {
			cmdFilter = commandName
		} else if rl.CommandName != nil {
			// This rate limit is for a different command, skip it
			continue
		}

		count, err := s.repo.CountExecutionsInWindow(ctx, tenantID, userID, cmdFilter, windowStart)
		if err != nil {
			return false, fmt.Errorf("count executions in window: %w", err)
		}

		if count >= rl.LimitCount {
			return false, nil // rate limited
		}
	}

	return true, nil // allowed
}
