package workflowwebhook

import "errors"

// WorkflowWebhookError represents domain errors for the workflow-webhook module.
type WorkflowWebhookError struct {
    Code    string
    Message string
    Cause   error
}

func (e *WorkflowWebhookError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *WorkflowWebhookError) Is(target error) bool {
    _, ok := target.(*WorkflowWebhookError)
    return ok
}

func (e *WorkflowWebhookError) Unwrap() error {
    return e.Cause
}

var (
    ErrWorkflowWebhookNotFound     = &WorkflowWebhookError{Code: "workflowwebhook_not_found", Message: "workflow-webhook: resource not found"}
    ErrWorkflowWebhookInvalidInput = &WorkflowWebhookError{Code: "workflowwebhook_invalid_input", Message: "workflow-webhook: invalid input"}
    ErrWorkflowWebhookConflict     = &WorkflowWebhookError{Code: "workflowwebhook_conflict", Message: "workflow-webhook: resource conflict"}
    ErrWorkflowWebhookUnauthorized = &WorkflowWebhookError{Code: "workflowwebhook_unauthorized", Message: "workflow-webhook: unauthorized access"}
    ErrWorkflowWebhookInternal     = &WorkflowWebhookError{Code: "workflowwebhook_internal", Message: "workflow-webhook: internal error"}
)

func NewWorkflowWebhookError(code, message string) error {
    return &WorkflowWebhookError{Code: code, Message: message}
}

func IsWorkflowWebhookNotFound(err error) bool {
    return errors.Is(err, ErrWorkflowWebhookNotFound)
}
