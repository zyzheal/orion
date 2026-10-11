package service

import (
	"context"

	"orion/platform-svc-go/internal/recipient/models"
)

// ServiceInterface 定义 recipient 服务层契约。
type ServiceInterface interface {
	Resolve(ctx context.Context, spec *models.RecipientSpec) (*models.ResolveResult, error)
	Validate(spec *models.RecipientSpec) error
	Kinds() []models.Kind
}
