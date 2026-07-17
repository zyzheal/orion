package service

import (
	"context"
	"orion/platform-svc-go/internal/problem/models"
)

// ProblemRepo defines the repository interface for testing.
type ProblemRepo interface {
	CreateProblem(ctx context.Context, problem *models.Problem) error
	GetProblemByID(ctx context.Context, id string, tenantID string) (*models.Problem, error)
	ListProblems(ctx context.Context, tenantID string, filter *models.ProblemFilter) ([]models.Problem, int, error)
	UpdateProblem(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.Problem, error)
	DeleteProblem(ctx context.Context, id string, tenantID string) (bool, error)
	GetStats(ctx context.Context, tenantID string) (*models.ProblemStats, error)
	CreateKnownError(ctx context.Context, ke *models.KnownError) error
	GetKnownErrorByID(ctx context.Context, id string) (*models.KnownError, error)
	ListKnownErrors(ctx context.Context, tenantID string, filter *models.KnownErrorFilter) ([]models.KnownError, int, error)
	SearchKnownErrors(ctx context.Context, query string, tenantID string) ([]models.KnownError, int, error)
	UpdateKnownError(ctx context.Context, id string, updates map[string]interface{}) (*models.KnownError, error)
	DeleteKnownError(ctx context.Context, id string) (bool, error)
	LinkIncident(ctx context.Context, problemID, incidentID string) (*models.Problem, error)
	LinkIncidentWithTenant(ctx context.Context, problemID, incidentID, tenantID string) (*models.Problem, error)
	GetIncidentLinks(ctx context.Context, problemID string) ([]string, error)
	LinkChangeWithTenant(ctx context.Context, problemID, changeID, tenantID string) (*models.Problem, error)
	GetChangeLinks(ctx context.Context, problemID string) ([]string, error)
}
