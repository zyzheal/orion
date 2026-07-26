package service

import (
	"context"
	"testing"
)

func TestValidateInput(t *testing.T) {
	svc := &KnowledgeService{}

	_, err := svc.AddDocument(context.Background(), "base-1", "", "content", "")
	if err == nil {
		t.Error("expected error for empty title, got nil")
	}

	_, err = svc.AddDocument(context.Background(), "base-1", "title", "", "")
	if err == nil {
		t.Error("expected error for empty content, got nil")
	}
}

func TestNewKnowledgeService(t *testing.T) {
	svc := NewKnowledgeService(nil, nil)
	if svc == nil {
		t.Fatal("expected non-nil service")
	}
}
