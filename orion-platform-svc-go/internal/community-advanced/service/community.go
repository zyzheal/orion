package service

import (
	"context"
	"fmt"
	"orion/platform-svc-go/internal/community-advanced/models"
	"time"
)

func (s *Service) AwardBadge(ctx context.Context, tenantID string, req *models.AwardBadgeRequest) (*models.BadgeAward, error) {
	if req.UserID == "" || req.BadgeID == "" {
		return nil, fmt.Errorf("userId and badgeId are required")
	}
	now := time.Now().Unix()
	return &models.BadgeAward{
		UserID: req.UserID,
		Badge:  req.BadgeID,
		Reason: req.Reason,
		At:     now,
	}, nil
}

func (s *Service) AssignMentorship(ctx context.Context, tenantID string, req *models.MentorshipRequest) (*models.Mentorship, error) {
	if req.MentorID == "" || req.MenteeID == "" {
		return nil, fmt.Errorf("mentorId and menteeId are required")
	}
	now := time.Now().Unix()
	return &models.Mentorship{
		MentorID:  req.MentorID,
		MenteeID:  req.MenteeID,
		Area:      req.Area,
		Status:    "active",
		StartedAt: now,
	}, nil
}

func (s *Service) VoteBestPractice(ctx context.Context, tenantID, id string, req *models.VoteRequest) (*models.BestPractice, error) {
	if id == "" {
		return nil, fmt.Errorf("best practice id is required")
	}
	if req.Value != 1 && req.Value != -1 {
		return nil, fmt.Errorf("vote value must be 1 or -1")
	}
	return &models.BestPractice{
		ID:    id,
		Title: "best practice",
		Votes: req.Value,
	}, nil
}

func (s *Service) CreateIncentiveProgram(ctx context.Context, tenantID string, req *models.IncentiveProgramRequest) (*models.IncentiveProgram, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("name is required")
	}
	now := time.Now().Unix()
	return &models.IncentiveProgram{
		ID:        fmt.Sprintf("program-%d", now),
		Name:      req.Name,
		Status:    "active",
		CreatedAt: now,
	}, nil
}
