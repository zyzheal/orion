package models

import (
	"testing"
	"time"
)

func TestTicket_Fields(t *testing.T) {
	now := time.Now()
	ticket := Ticket{
		ID:          "ticket-1",
		TenantID:    "tenant-1",
		Title:       "Test Ticket",
		Description: "Test Description",
		Type:        "bug",
		Priority:    "high",
		Status:      "open",
		CreatedBy:   "user-1",
		AssignedTo:  "user-2",
		ResolvedAt:  nil,
		ClosedAt:    nil,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if ticket.ID != "ticket-1" {
		t.Errorf("expected ID 'ticket-1', got '%s'", ticket.ID)
	}
	if ticket.TenantID != "tenant-1" {
		t.Errorf("expected TenantID 'tenant-1', got '%s'", ticket.TenantID)
	}
	if ticket.Title != "Test Ticket" {
		t.Errorf("expected Title 'Test Ticket', got '%s'", ticket.Title)
	}
	if ticket.Type != "bug" {
		t.Errorf("expected Type 'bug', got '%s'", ticket.Type)
	}
	if ticket.Priority != "high" {
		t.Errorf("expected Priority 'high', got '%s'", ticket.Priority)
	}
	if ticket.Status != "open" {
		t.Errorf("expected Status 'open', got '%s'", ticket.Status)
	}
	if ticket.ResolvedAt != nil {
		t.Error("expected ResolvedAt to be nil")
	}
	if ticket.ClosedAt != nil {
		t.Error("expected ClosedAt to be nil")
	}
}

func TestTicketComment_Fields(t *testing.T) {
	now := time.Now()
	comment := TicketComment{
		ID:         "comment-1",
		TicketID:   "ticket-1",
		Author:     "user-1",
		Content:    "Test comment",
		IsInternal: false,
		CreatedAt:  now,
	}

	if comment.ID != "comment-1" {
		t.Errorf("expected ID 'comment-1', got '%s'", comment.ID)
	}
	if comment.TicketID != "ticket-1" {
		t.Errorf("expected TicketID 'ticket-1', got '%s'", comment.TicketID)
	}
	if comment.Author != "user-1" {
		t.Errorf("expected Author 'user-1', got '%s'", comment.Author)
	}
	if comment.Content != "Test comment" {
		t.Errorf("expected Content 'Test comment', got '%s'", comment.Content)
	}
	if comment.IsInternal != false {
		t.Error("expected IsInternal to be false")
	}
}

func TestTicketAttachment_Fields(t *testing.T) {
	now := time.Now()
	attachment := TicketAttachment{
		ID:         "attachment-1",
		TicketID:   "ticket-1",
		FileName:   "test.txt",
		FilePath:   "/uploads/test.txt",
		FileSize:   1024,
		UploadedBy: "user-1",
		CreatedAt:  now,
	}

	if attachment.ID != "attachment-1" {
		t.Errorf("expected ID 'attachment-1', got '%s'", attachment.ID)
	}
	if attachment.TicketID != "ticket-1" {
		t.Errorf("expected TicketID 'ticket-1', got '%s'", attachment.TicketID)
	}
	if attachment.FileName != "test.txt" {
		t.Errorf("expected FileName 'test.txt', got '%s'", attachment.FileName)
	}
	if attachment.FilePath != "/uploads/test.txt" {
		t.Errorf("expected FilePath '/uploads/test.txt', got '%s'", attachment.FilePath)
	}
	if attachment.FileSize != 1024 {
		t.Errorf("expected FileSize 1024, got %d", attachment.FileSize)
	}
}

func TestCreateTicketRequest_Fields(t *testing.T) {
	req := CreateTicketRequest{
		Title:       "Test Ticket",
		Description: "Test Description",
		Type:        "bug",
		Priority:    "high",
	}

	if req.Title != "Test Ticket" {
		t.Errorf("expected Title 'Test Ticket', got '%s'", req.Title)
	}
	if req.Description != "Test Description" {
		t.Errorf("expected Description 'Test Description', got '%s'", req.Description)
	}
	if req.Type != "bug" {
		t.Errorf("expected Type 'bug', got '%s'", req.Type)
	}
	if req.Priority != "high" {
		t.Errorf("expected Priority 'high', got '%s'", req.Priority)
	}
}

func TestCreateCommentRequest_Fields(t *testing.T) {
	req := CreateCommentRequest{
		Author:     "user-1",
		Content:    "Test comment",
		IsInternal: true,
	}

	if req.Author != "user-1" {
		t.Errorf("expected Author 'user-1', got '%s'", req.Author)
	}
	if req.Content != "Test comment" {
		t.Errorf("expected Content 'Test comment', got '%s'", req.Content)
	}
	if req.IsInternal != true {
		t.Error("expected IsInternal to be true")
	}
}
