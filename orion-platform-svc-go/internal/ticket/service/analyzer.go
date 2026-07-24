package service

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/ticket/models"
	"orion/go-common/pkg/otel"
	"orion/platform-svc-go/internal/ticket/repository"

	"github.com/google/uuid"
)

type AnalyzerService struct {
	relationRepo repository.RelationRepositoryInterface
	ticketRepo   repository.TicketRepositoryInterface
}

func NewAnalyzerService(relationRepo repository.RelationRepositoryInterface, ticketRepo repository.TicketRepositoryInterface) *AnalyzerService {
	return &AnalyzerService{relationRepo: relationRepo, ticketRepo: ticketRepo}
}

// AddRelation creates a relation between two tickets
func (s *AnalyzerService) AddRelation(ctx context.Context, ticketID, relatedTicketID, relationType, createdBy, description string, confidence float64) (*models.TicketRelation, error) {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "AnalyzerService.AddRelation")
	defer span.End()

	// Validate relation type
	valid := false
	for _, rt := range models.ValidRelationTypes {
		if rt == relationType {
			valid = true
			break
		}
	}
	if !valid {
		return nil, fmt.Errorf("invalid relation type: %s", relationType)
	}

	// Check for duplicate relation
	exists, _ := s.relationRepo.Exists(ctx, ticketID, relatedTicketID, relationType)
	if exists {
		return nil, fmt.Errorf("relation already exists")
	}

	rel := &models.TicketRelation{
		ID:              uuid.New().String(),
		TicketID:        ticketID,
		RelatedTicketID: relatedTicketID,
		RelationType:    relationType,
		CreatedBy:       createdBy,
		Description:     description,
		Confidence:      confidence,
	}

	if err := s.relationRepo.Create(ctx, rel); err != nil {
		return nil, err
	}
	return rel, nil
}

// GetRelations returns all relations for a ticket
func (s *AnalyzerService) GetRelations(ctx context.Context, ticketID string) ([]models.TicketRelation, error) {
	return s.relationRepo.ListByTicket(ctx, ticketID)
}

// FindRelatedTickets finds tickets related to the given ticket
func (s *AnalyzerService) FindRelatedTickets(ctx context.Context, ticketID string, maxResults int, minConfidence float64) ([]models.TicketRelation, error) {
	if maxResults <= 0 {
		maxResults = 10
	}

	relations, err := s.relationRepo.FindSimilar(ctx, ticketID, maxResults)
	if err != nil {
		return nil, err
	}

	if minConfidence > 0 {
		var filtered []models.TicketRelation
		for _, r := range relations {
			if r.Confidence >= minConfidence {
				filtered = append(filtered, r)
			}
		}
		return filtered, nil
	}

	return relations, nil
}

// DetectDuplicates finds potential duplicate tickets
func (s *AnalyzerService) DetectDuplicates(ctx context.Context, ticketID string, threshold float64) ([]models.TicketRelation, error) {
	if threshold <= 0 {
		threshold = 0.7
	}

	relations, err := s.relationRepo.ListByTicket(ctx, ticketID)
	if err != nil {
		return nil, err
	}

	var duplicates []models.TicketRelation
	for _, r := range relations {
		if r.RelationType == models.RelationDuplicate && r.Confidence >= threshold {
			duplicates = append(duplicates, r)
		}
	}
	return duplicates, nil
}

// CorrelateRootCause analyzes tickets for common root causes
func (s *AnalyzerService) CorrelateRootCause(ctx context.Context, ticketIDs []string) (*models.RootCauseCorrelation, error) {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "AnalyzerService.CorrelateRootCause")
	defer span.End()

	if len(ticketIDs) < 2 {
		return nil, fmt.Errorf("need at least 2 tickets for correlation")
	}

	// Collect all relations for the given tickets
	allRelations := make(map[string]bool)
	for _, tid := range ticketIDs {
		relations, _ := s.relationRepo.ListByTicket(ctx, tid)
		for _, r := range relations {
			allRelations[r.TicketID] = true
			allRelations[r.RelatedTicketID] = true
		}
	}

	correlation := &models.RootCauseCorrelation{
		TicketIDs:    ticketIDs,
		RelatedCount: len(allRelations),
	}

	// Simple heuristic: if many tickets are interconnected, they likely share a root cause
	if correlation.RelatedCount > len(ticketIDs) {
		correlation.Confidence = 0.7
		correlation.RootCause = "correlated through shared relations"
	} else {
		correlation.Confidence = 0.3
		correlation.RootCause = "weak correlation"
	}

	return correlation, nil
}
