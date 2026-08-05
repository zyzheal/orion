package handler

import (
	"testing"

	"orion/platform-svc-go/internal/notification/notification/service"
)

func TestNewTemplateHandler(t *testing.T) {
	svc := service.NewTemplateService(nil, nil)
	h := NewTemplateHandler(svc)
	if h == nil {
		t.Fatal("NewTemplateHandler returned nil")
	}
}

func TestNewPolicyHandler(t *testing.T) {
	svc := service.NewPolicyService(nil, nil)
	h := NewPolicyHandler(svc)
	if h == nil {
		t.Fatal("NewPolicyHandler returned nil")
	}
}

func TestNewScheduledNotificationHandler(t *testing.T) {
	svc := service.NewScheduledNotificationService(nil, nil)
	h := NewScheduledNotificationHandler(svc)
	if h == nil {
		t.Fatal("NewScheduledNotificationHandler returned nil")
	}
}

func TestNewDNDHandler(t *testing.T) {
	svc := service.NewDNDService(nil, nil)
	h := NewDNDHandler(svc)
	if h == nil {
		t.Fatal("NewDNDHandler returned nil")
	}
}

func TestNewDeliveryHandler(t *testing.T) {
	svc := service.NewDeliveryService(nil, nil)
	h := NewDeliveryHandler(svc)
	if h == nil {
		t.Fatal("NewDeliveryHandler returned nil")
	}
}

func TestNewDashboardHandler(t *testing.T) {
	svc := service.NewDashboardService(nil, nil)
	h := NewDashboardHandler(svc)
	if h == nil {
		t.Fatal("NewDashboardHandler returned nil")
	}
}

func TestNewHandler(t *testing.T) {
	svc := service.New(nil)
	h := NewHandler(svc)
	if h == nil {
		t.Fatal("NewHandler returned nil")
	}
}
