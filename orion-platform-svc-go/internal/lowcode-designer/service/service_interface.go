// Code generated. DO NOT EDIT.
//
// This file defines ServiceInterface for lowcode-designer.

package service

import (
	"context"
	"orion/platform-svc-go/internal/lowcode-designer/models"
)

// ServiceInterface defines the interface for the lowcode-designer service.
type ServiceInterface interface {
	CreateForm(ctx context.Context, req *models.CreateFormRequest, tenantID, operator string) (*models.FormDefinition, error)
	GetForm(ctx context.Context, id, tenantID string) (*models.FormDefinition, error)
	ListForms(ctx context.Context, tenantID, category, status string) ([]models.FormDefinition, error)
	UpdateForm(ctx context.Context, id, tenantID, operator string, req *models.UpdateFormRequest) (*models.FormDefinition, error)
	DeleteForm(ctx context.Context, id, tenantID string) (bool, error)

	CreateField(ctx context.Context, formID, tenantID string, req *models.CreateFieldRequest) (*models.FormField, error)
	UpdateField(ctx context.Context, id, tenantID string, req *models.CreateFieldRequest) (*models.FormField, error)
	DeleteField(ctx context.Context, id, tenantID string) (bool, error)
	GetFieldsByForm(ctx context.Context, formID, tenantID string) ([]models.FormField, error)

	ListTemplates(ctx context.Context, tenantID, category string) ([]models.FormTemplate, error)
	GetTemplate(ctx context.Context, id string) (*models.FormTemplate, error)
	CreateTemplate(ctx context.Context, tenantID, name, description, category string, schema map[string]interface{}) (*models.FormTemplate, error)

	SubmitInstance(ctx context.Context, formID, tenantID string, req *models.SubmitInstanceRequest) (*models.FormInstance, error)
	ListInstances(ctx context.Context, tenantID, formID, status string) ([]models.FormInstance, error)
	GetInstance(ctx context.Context, id, tenantID string) (*models.FormInstance, error)
	ApproveInstance(ctx context.Context, id, tenantID string, req *models.ApproveInstanceRequest) (*models.FormInstance, error)

	ListComponents(ctx context.Context, tenantID, category string) ([]models.ComponentRegistry, error)
	GetComponent(ctx context.Context, id string) (*models.ComponentRegistry, error)
	CreateComponent(ctx context.Context, tenantID, name, displayName, category, version string, propsSchema map[string]interface{}, defaultConfig map[string]interface{}, icon string) (*models.ComponentRegistry, error)
}

// Ensure compile-time safety: *Service implements ServiceInterface.
var _ ServiceInterface = (*Service)(nil)
