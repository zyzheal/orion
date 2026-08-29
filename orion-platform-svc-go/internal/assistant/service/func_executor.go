package service

import (
	"context"

	"orion/platform-svc-go/internal/assistant/models"
)

// ExecuteFunc implements an ActionExecutor backed by a closure.
type ExecuteFunc func(ctx context.Context, tenantID string, req *models.ActionRequest) (*models.ActionResult, error)

// FuncActionExecutor adapts a closure into an ActionExecutor.
type FuncActionExecutor struct {
	kind models.ActionKind
	fn   ExecuteFunc
}

// NewFuncActionExecutor wraps a closure as an executor for kind.
func NewFuncActionExecutor(kind models.ActionKind, fn ExecuteFunc) *FuncActionExecutor {
	return &FuncActionExecutor{kind: kind, fn: fn}
}

// Kind returns the action kind this executor handles.
func (e *FuncActionExecutor) Kind() models.ActionKind { return e.kind }

// Execute runs the closure.
func (e *FuncActionExecutor) Execute(ctx context.Context, tenantID string, req *models.ActionRequest) (*models.ActionResult, error) {
	return e.fn(ctx, tenantID, req)
}
