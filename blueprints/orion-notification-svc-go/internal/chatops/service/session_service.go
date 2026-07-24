package service

import (
	"context"
	"database/sql"
	"errors"

	"orion/notification-svc-go/internal/chatops/models"
	"orion/notification-svc-go/internal/chatops/repository"

	"github.com/google/uuid"
)

// SessionService manages chat session state.
type SessionService struct {
	repo *repository.Repository
}

func NewSessionService(repo *repository.Repository) *SessionService {
	return &SessionService{repo: repo}
}

func (s *SessionService) GetOrCreate(ctx context.Context, tenantID, sessionKey, userID, channelID string) (*models.ChatOpsSession, error) {
	session, err := s.repo.GetSessionByKey(ctx, tenantID, sessionKey)
	if err == nil {
		return session, nil
	}
	// Only attempt create on "not found"; return other errors
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	// Create new session
	session = &models.ChatOpsSession{
		ID:         uuid.New().String(),
		TenantID:   tenantID,
		SessionKey: sessionKey,
		UserID:     userID,
		ChannelID:  channelID,
		History:    models.JSONB{"messages": []interface{}{}},
		State:      models.JSONB{},
	}
	if err := s.repo.CreateSession(ctx, session); err != nil {
		return nil, err
	}
	return session, nil
}

func (s *SessionService) Get(ctx context.Context, tenantID, sessionKey string) (*models.ChatOpsSession, error) {
	return s.repo.GetSessionByKey(ctx, tenantID, sessionKey)
}

func (s *SessionService) UpdateState(ctx context.Context, tenantID, sessionKey string, state, history models.JSONB) error {
	return s.repo.UpdateSessionState(ctx, tenantID, sessionKey, state, history)
}

func (s *SessionService) Delete(ctx context.Context, tenantID, sessionKey string) error {
	return s.repo.DeleteSession(ctx, tenantID, sessionKey)
}
