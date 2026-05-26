package service

import (
	"context"

	"orion-ticket-svc-go/internal/models"
	"orion-ticket-svc-go/internal/repository"
	"orion-ticket-svc-go/internal/otel"

	"github.com/google/uuid"
)

type TicketService struct {
	repo    *repository.TicketRepository
	comment *repository.CommentRepository
}

func NewTicketService(repo *repository.TicketRepository, comment *repository.CommentRepository) *TicketService {
	return &TicketService{repo: repo, comment: comment}
}

func (s *TicketService) Create(ctx context.Context, tenantID string, req *models.CreateTicketRequest, createdBy string) (*models.Ticket, error) {
	_, span := otel.Tracer().Start(ctx, "TicketService.Create")
	defer span.End()

	ticket := &models.Ticket{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Title:       req.Title,
		Description: req.Description,
		Type:        req.Type,
		Priority:    req.Priority,
		Status:      "open",
		CreatedBy:   createdBy,
	}

	if err := s.repo.Create(ticket); err != nil {
		return nil, err
	}
	return ticket, nil
}

func (s *TicketService) GetByID(ctx context.Context, id, tenantID string) (*models.Ticket, error) {
	_, span := otel.Tracer().Start(ctx, "TicketService.GetByID")
	defer span.End()

	return s.repo.GetByID(id, tenantID)
}

func (s *TicketService) List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.Ticket, int, error) {
	_, span := otel.Tracer().Start(ctx, "TicketService.List")
	defer span.End()

	if q.Page <= 0 {
		q.Page = 1
	}
	if q.PageSize <= 0 {
		q.PageSize = 20
	}

	return s.repo.List(tenantID, q)
}

func (s *TicketService) Update(ctx context.Context, ticket *models.Ticket) error {
	_, span := otel.Tracer().Start(ctx, "TicketService.Update")
	defer span.End()

	return s.repo.Update(ticket)
}

func (s *TicketService) Delete(ctx context.Context, id, tenantID string) error {
	_, span := otel.Tracer().Start(ctx, "TicketService.Delete")
	defer span.End()

	return s.repo.Delete(id, tenantID)
}

func (s *TicketService) Resolve(ctx context.Context, id, tenantID string) error {
	_, span := otel.Tracer().Start(ctx, "TicketService.Resolve")
	defer span.End()

	return s.repo.UpdateStatus(id, tenantID, "resolved")
}

func (s *TicketService) Assign(ctx context.Context, id, tenantID, assignedTo string) error {
	_, span := otel.Tracer().Start(ctx, "TicketService.Assign")
	defer span.End()

	return s.repo.UpdateAssignee(id, tenantID, assignedTo)
}

func (s *TicketService) AddComment(ctx context.Context, ticketID, tenantID string, req *models.CreateCommentRequest) (*models.TicketComment, error) {
	_, span := otel.Tracer().Start(ctx, "TicketService.AddComment")
	defer span.End()

	// Verify ticket exists and belongs to tenant
	if _, err := s.repo.GetByID(ticketID, tenantID); err != nil {
		return nil, err
	}

	comment := &models.TicketComment{
		ID:         uuid.New().String(),
		TicketID:   ticketID,
		Author:     req.Author,
		Content:    req.Content,
		IsInternal: req.IsInternal,
	}

	if err := s.comment.Create(comment); err != nil {
		return nil, err
	}
	return comment, nil
}

func (s *TicketService) ListComments(ctx context.Context, ticketID, tenantID string) ([]models.TicketComment, error) {
	_, span := otel.Tracer().Start(ctx, "TicketService.ListComments")
	defer span.End()

	// Verify ticket exists and belongs to tenant
	if _, err := s.repo.GetByID(ticketID, tenantID); err != nil {
		return nil, err
	}

	return s.comment.ListByTicket(ticketID)
}
