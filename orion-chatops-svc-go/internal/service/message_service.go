package service

import (
	"context"
	"time"

	"orion/chatops-svc-go/internal/models"

	"github.com/google/uuid"
)

// MessageService handles sending messages to chat platforms.
type MessageService struct {
	webhookSvc *WebhookService
}

func NewMessageService(webhookSvc *WebhookService) *MessageService {
	return &MessageService{webhookSvc: webhookSvc}
}

// SendMessage sends a message and returns the response.
func (s *MessageService) SendMessage(ctx context.Context, tenantID string, req models.SendMessageRequest) (*models.MessageResponse, error) {
	msg := &models.MessageResponse{
		ID:        uuid.New().String(),
		Content:   req.Content,
		Channel:   req.Channel,
		Platform:  req.Platform,
		UserID:    req.UserID,
		Status:    "sent",
		CreatedAt: time.Now(),
	}

	// Fire webhook event for message sent
	if s.webhookSvc != nil {
		_ = s.webhookSvc.DeliverEvent(ctx, tenantID, "message.sent", map[string]interface{}{
			"message_id": msg.ID,
			"content":    req.Content,
			"channel":    req.Channel,
			"platform":   req.Platform,
			"user_id":    req.UserID,
		})
	}

	return msg, nil
}
