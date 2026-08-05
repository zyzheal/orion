package service

import (
	"context"
	"testing"

	"orion/platform-svc-go/internal/notification/notification/models"
	"orion/platform-svc-go/internal/notification/notification/repository"
)

func TestNewServiceNotNil(t *testing.T) {
	svc := NewService(&repository.Repository{})
	if svc == nil {
		t.Fatal("NewService returned nil")
	}
}

func TestServiceSendNotification(t *testing.T) {
	svc := NewService(&repository.Repository{})
	req := &models.CreateNotificationRequest{
		Recipient: "u@e.com",
		Subject:   "Hi",
		Body:      "Hello",
		Type:      "test",
		Channel:   models.ChannelEmail,
	}
	_, _ = svc.SendNotification(context.Background(), "t1", req)
}

func TestServiceGetNotification(t *testing.T) {
	svc := NewService(&repository.Repository{})
	_, _ = svc.GetNotification(context.Background(), "t1", "n-1")
}

func TestServiceListNotifications(t *testing.T) {
	svc := NewService(&repository.Repository{})
	_, _, _ = svc.ListNotifications(context.Background(), "t1", models.ListNotificationsQuery{Page: 1, Limit: 10})
}

func TestServiceMarkAsRead(t *testing.T) {
	svc := NewService(&repository.Repository{})
	_, _ = svc.MarkAsRead(context.Background(), "t1", "n-1")
}

func TestServiceGetUnreadCount(t *testing.T) {
	svc := NewService(&repository.Repository{})
	_, _ = svc.GetUnreadCount(context.Background(), "t1", "u-1")
}

func TestServiceBroadcast(t *testing.T) {
	svc := NewService(&repository.Repository{})
	req := &models.BroadcastRequest{
		Type: "test",
	}
	_, _ = svc.Broadcast(context.Background(), "t1", req)
}

func TestServiceDelete(t *testing.T) {
	svc := NewService(&repository.Repository{})
	_ = svc.Delete(context.Background(), "t1", "n-1")
}

func TestServiceCount(t *testing.T) {
	svc := NewService(&repository.Repository{})
	_, _ = svc.Count(context.Background(), "t1")
}

func TestServiceStats(t *testing.T) {
	svc := NewService(&repository.Repository{})
	_, _ = svc.Stats(context.Background(), "t1")
}

func TestServiceCreateTemplate(t *testing.T) {
	svc := NewService(&repository.Repository{})
	_ = svc.CreateTemplate(context.Background(), "t1", &models.NotificationTemplate{})
}

func TestServiceListTemplates(t *testing.T) {
	svc := NewService(&repository.Repository{})
	_, _ = svc.ListTemplates(context.Background(), "t1")
}

func TestServiceGetTemplate(t *testing.T) {
	svc := NewService(&repository.Repository{})
	_, _ = svc.GetTemplate(context.Background(), "t1", "t-1")
}

func TestServiceDeleteTemplate(t *testing.T) {
	svc := NewService(&repository.Repository{})
	_ = svc.DeleteTemplate(context.Background(), "t1", "t-1")
}

func TestServiceCreateChannel(t *testing.T) {
	svc := NewService(&repository.Repository{})
	_ = svc.CreateChannel(context.Background(), "t1", &models.NotificationChannel{})
}

func TestServiceListChannels(t *testing.T) {
	svc := NewService(&repository.Repository{})
	_, _ = svc.ListChannels(context.Background(), "t1")
}

func TestServiceGetChannel(t *testing.T) {
	svc := NewService(&repository.Repository{})
	_, _ = svc.GetChannel(context.Background(), "t1", "c-1")
}

func TestServiceGetSettings(t *testing.T) {
	svc := NewService(&repository.Repository{})
	_, _ = svc.GetSettings(context.Background(), "t1", "u-1")
}

func TestServiceGetSubscriptions(t *testing.T) {
	svc := NewService(&repository.Repository{})
	_, _ = svc.GetSubscriptions(context.Background(), "t1", "u-1")
}

func TestServiceSubscribe(t *testing.T) {
	svc := NewService(&repository.Repository{})
	_, _ = svc.Subscribe(context.Background(), "t1", "u-1", "email", true)
}

func TestServiceUnsubscribe(t *testing.T) {
	svc := NewService(&repository.Repository{})
	_ = svc.Unsubscribe(context.Background(), "t1", "u-1", "email")
}
