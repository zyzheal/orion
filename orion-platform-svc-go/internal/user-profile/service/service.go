package service

import (
	"context"

	"orion/platform-svc-go/internal/user-profile/models"
	"orion/platform-svc-go/internal/user-profile/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetProfile(ctx context.Context, tenantID, userID string) (*models.UserProfile, error) {
	return s.repo.GetByUserID(ctx, tenantID, userID)
}

func (s *Service) UpdateProfile(ctx context.Context, tenantID, userID string, req models.UpdateProfileRequest) (*models.UserProfile, error) {
	attrs := make(map[string]interface{})
	if req.FirstName != "" {
		attrs["first_name"] = req.FirstName
	}
	if req.LastName != "" {
		attrs["last_name"] = req.LastName
	}
	if req.Bio != "" {
		attrs["bio"] = req.Bio
	}
	if req.Timezone != "" {
		attrs["timezone"] = req.Timezone
	}
	if req.AvatarURL != "" {
		attrs["avatar_url"] = req.AvatarURL
	}
	return s.repo.Update(ctx, tenantID, userID, attrs)
}

func (s *Service) EnsureProfile(ctx context.Context, tenantID, userID string) (*models.UserProfile, error) {
	p, err := s.repo.GetByUserID(ctx, tenantID, userID)
	if err == nil {
		return p, nil
	}
	return s.repo.Create(ctx, tenantID, userID)
}
