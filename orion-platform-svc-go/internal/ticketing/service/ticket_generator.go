package service

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/repository"

	"github.com/google/uuid"
)

type TicketGeneratorService struct {
	repo repository.TicketRepositoryInterface
}

func NewTicketGeneratorService(repo repository.TicketRepositoryInterface) *TicketGeneratorService {
	return &TicketGeneratorService{repo: repo}
}

func (s *TicketGeneratorService) FromAlert(ctx context.Context, tenantID string, alert map[string]any, createdBy string) (*models.Ticket, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("repository not available")
	}

	// Extract alert fields
	source, _ := alert["source"].(string)
	if source == "" {
		source, _ = alert["sourceId"].(string)
	}
	title, _ := alert["title"].(string)
	if title == "" {
		title, _ = alert["message"].(string)
	}
	if title == "" {
		return nil, fmt.Errorf("alert title/message is required")
	}

	priority, _ := alert["severity"].(string)
	if priority == "" {
		priority, _ = alert["priority"].(string)
		if priority == "" {
			priority = "medium"
		}
	}

	description, _ := alert["description"].(string)
	if description == "" {
		description, _ = alert["details"].(string)
	}

	ticket := &models.Ticket{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Title:       fmt.Sprintf("[Alert] %s", title),
		Description: description,
		Type:        "alert",
		Priority:    priority,
		Status:      models.StatusOpen,
		CreatedBy:   createdBy,
	}

	if err := s.repo.Create(ctx, ticket); err != nil {
		return nil, err
	}
	return ticket, nil
}

func (s *TicketGeneratorService) FromIncident(ctx context.Context, tenantID string, incident map[string]any, createdBy string) (*models.Ticket, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("repository not available")
	}

	incidentID, _ := incident["id"].(string)
	if incidentID == "" {
		return nil, fmt.Errorf("incident id is required")
	}

	title, _ := incident["title"].(string)
	if title == "" {
		return nil, fmt.Errorf("incident title is required")
	}

	priority, _ := incident["severity"].(string)
	if priority == "" {
		priority, _ := incident["priority"].(string)
		if priority == "" {
			priority = "high"
		}
	}

	description, _ := incident["description"].(string)
	if description == "" {
		_, _ = incident["details"]
	}

	ticket := &models.Ticket{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Title:       fmt.Sprintf("[Incident %s] %s", incidentID, title),
		Description: description,
		Type:        "incident",
		Priority:    priority,
		Status:      models.StatusOpen,
		CreatedBy:   createdBy,
	}

	if err := s.repo.Create(ctx, ticket); err != nil {
		return nil, err
	}
	return ticket, nil
}
