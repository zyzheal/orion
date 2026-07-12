package service

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/sprint/models"
	"orion/platform-svc-go/internal/sprint/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateSprintRequest) (*models.Sprint, error) {
	m := &models.Sprint{
		TenantID: tenantID,
		Name:     req.Name,
	}
	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Sprint, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, limit, offset int) ([]models.Sprint, error) {
	return s.repo.List(ctx, tenantID, limit, offset)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateSprintRequest) (*models.Sprint, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// GetBoard returns the sprint board view grouped by ticket status.
func (s *Service) GetBoard(ctx context.Context, tenantID, sprintID string) (*models.SprintBoard, error) {
	board, err := s.repo.GetBoard(ctx, tenantID, sprintID)
	if err != nil {
		return nil, err
	}
	return board, nil
}

// AddTicket adds a ticket to a sprint with an optional sort order.
func (s *Service) AddTicket(ctx context.Context, tenantID, sprintID string, req models.AddTicketRequest) (*models.SprintTicket, error) {
	if req.SortOrder == nil {
		req.SortOrder = new(int)
	}
	ticket := &models.SprintTicket{
		TenantID:  tenantID,
		SprintID:  sprintID,
		TicketID:  req.TicketID,
		SortOrder: *req.SortOrder,
	}
	if err := s.repo.AddTicket(ctx, ticket); err != nil {
		return nil, err
	}
	return ticket, nil
}

// RemoveTicket removes a ticket from a sprint.
func (s *Service) RemoveTicket(ctx context.Context, tenantID, sprintID, ticketID string) error {
	if err := s.repo.RemoveTicket(ctx, tenantID, sprintID, ticketID); err != nil {
		return err
	}
	return nil
}

// ReorderTickets reorders tickets within a sprint.
func (s *Service) ReorderTickets(ctx context.Context, tenantID, sprintID string, req models.ReorderTicketsRequest) error {
	if err := s.repo.ReorderTickets(ctx, tenantID, sprintID, req.Orders); err != nil {
		return err
	}
	return nil
}

// GetBurndownData returns burndown data for a sprint.
func (s *Service) GetBurndownData(ctx context.Context, tenantID, sprintID string) (*models.BurndownData, error) {
	data, err := s.repo.GetBurndownData(ctx, tenantID, sprintID)
	if err != nil {
		return nil, err
	}
	return data, nil
}

func (s *Service) notFound() error {
	return fmt.Errorf("not found")
}
