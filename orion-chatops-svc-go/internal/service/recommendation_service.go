package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"orion/chatops-svc-go/internal/models"
	"orion/chatops-svc-go/internal/repository"

	"github.com/google/uuid"
)

// RecommendationService generates smart recommendations based on system state.
type RecommendationService struct {
	repo *repository.Repository
}

func NewRecommendationService(repo *repository.Repository) *RecommendationService {
	return &RecommendationService{repo: repo}
}

// GetRecommendations returns smart recommendations for a tenant.
func (s *RecommendationService) GetRecommendations(ctx context.Context, tenantID string) ([]models.ChatOpsRecommendation, error) {
	var recs []models.ChatOpsRecommendation

	// Check for high error rate in audit logs
	errorCount, err := s.repo.CountAuditLogsByResult(ctx, tenantID, "error")
	if err != nil {
		log.Printf("recommendation: failed to count error audit logs: %v", err)
	}
	totalCount, err := s.repo.CountAuditLogs(ctx, tenantID)
	if err != nil {
		log.Printf("recommendation: failed to count total audit logs: %v", err)
	}

	if totalCount > 10 && errorCount > 0 {
		errorRate := float64(errorCount) / float64(totalCount) * 100
		if errorRate > 20 {
			recs = append(recs, models.ChatOpsRecommendation{
				ID:          uuid.New().String(),
				Type:        "health",
				Severity:    "warning",
				Title:       "High command error rate",
				Description: "Error rate is " + formatFloat(errorRate) + "%. Review recent failures.",
				Actions: []models.RecommendationAction{
					{Label: "View audit logs", Command: "/audit list status=error"},
				},
				Source:    "system",
				CreatedAt: time.Now(),
			})
		}
	}

	// Check command usage and suggest popular commands
	cmds, err := s.repo.ListCommands(ctx, tenantID, 0, 100)
	if err != nil {
		log.Printf("recommendation: failed to list commands: %v", err)
	}
	if len(cmds) > 0 {
		enabledCount := 0
		for _, c := range cmds {
			if c.Enabled {
				enabledCount++
			}
		}
		if enabledCount == 0 {
			recs = append(recs, models.ChatOpsRecommendation{
				ID:          uuid.New().String(),
				Type:        "setup",
				Severity:    "info",
				Title:       "No enabled commands",
				Description: "All commands are disabled. Enable commands to start using ChatOps.",
				Actions: []models.RecommendationAction{
					{Label: "View commands", Command: "/commands list"},
				},
				Source:    "system",
				CreatedAt: time.Now(),
			})
		}
	}

	// If no specific recommendations, add a general one
	if len(recs) == 0 {
		recs = append(recs, models.ChatOpsRecommendation{
			ID:          uuid.New().String(),
			Type:        "tip",
			Severity:    "info",
			Title:       "Getting started with ChatOps",
			Description: "Try /help to see available commands, or /pipeline list to view your pipelines.",
			Actions: []models.RecommendationAction{
				{Label: "Show help", Command: "/help"},
				{Label: "List pipelines", Command: "/pipeline list"},
			},
			Source:    "system",
			CreatedAt: time.Now(),
		})
	}

	return recs, nil
}

func formatFloat(f float64) string {
	return fmt.Sprintf("%.1f", f)
}
