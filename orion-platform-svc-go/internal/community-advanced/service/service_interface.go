package service

import (
	"context"
	"orion/platform-svc-go/internal/community-advanced/models"
)

type ServiceInterface interface {
	AwardBadge(ctx context.Context, tenantID string, req *models.AwardBadgeRequest) (*models.BadgeAward, error)
	AssignMentorship(ctx context.Context, tenantID string, req *models.MentorshipRequest) (*models.Mentorship, error)
	VoteBestPractice(ctx context.Context, tenantID, id string, req *models.VoteRequest) (*models.BestPractice, error)
	CreateIncentiveProgram(ctx context.Context, tenantID string, req *models.IncentiveProgramRequest) (*models.IncentiveProgram, error)
	Create(ctx context.Context, req *models.CreateRequest, tenantID string) (*models.CommunityAdvanced, error)
	Get(ctx context.Context, id, tenantID string) (*models.CommunityAdvanced, error)
	List(ctx context.Context, tenantID string) ([]models.CommunityAdvanced, error)
	Update(ctx context.Context, id, tenantID string, req *models.UpdateRequest) (*models.CommunityAdvanced, error)
	Delete(ctx context.Context, id, tenantID string) (bool, error)
}

var _ ServiceInterface = (*Service)(nil)

