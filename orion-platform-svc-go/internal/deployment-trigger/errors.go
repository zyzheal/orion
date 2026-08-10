package deploymenttrigger

import "errors"

// DeploymentTriggerError represents domain errors for the deployment-trigger module.
type DeploymentTriggerError struct {
    Code    string
    Message string
    Cause   error
}

func (e *DeploymentTriggerError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *DeploymentTriggerError) Is(target error) bool {
    _, ok := target.(*DeploymentTriggerError)
    return ok
}

func (e *DeploymentTriggerError) Unwrap() error {
    return e.Cause
}

var (
    ErrDeploymentTriggerNotFound     = &DeploymentTriggerError{Code: "deploymenttrigger_not_found", Message: "deployment-trigger: resource not found"}
    ErrDeploymentTriggerInvalidInput = &DeploymentTriggerError{Code: "deploymenttrigger_invalid_input", Message: "deployment-trigger: invalid input"}
    ErrDeploymentTriggerConflict     = &DeploymentTriggerError{Code: "deploymenttrigger_conflict", Message: "deployment-trigger: resource conflict"}
    ErrDeploymentTriggerUnauthorized = &DeploymentTriggerError{Code: "deploymenttrigger_unauthorized", Message: "deployment-trigger: unauthorized access"}
    ErrDeploymentTriggerInternal     = &DeploymentTriggerError{Code: "deploymenttrigger_internal", Message: "deployment-trigger: internal error"}
)

func NewDeploymentTriggerError(code, message string) error {
    return &DeploymentTriggerError{Code: code, Message: message}
}

func IsDeploymentTriggerNotFound(err error) bool {
    return errors.Is(err, ErrDeploymentTriggerNotFound)
}
