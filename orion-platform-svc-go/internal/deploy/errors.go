package deploy

import "errors"

type DeployError struct { Code string; Message string; Cause error }

func (e *DeployError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *DeployError) Is(target error) bool { _, ok := target.(*DeployError); return ok }
func (e *DeployError) Unwrap() error { return e.Cause }

var (
    ErrDeployNotFound     = &DeployError{Code: "deploy_not_found", Message: "deploy: not found"}
    ErrDeployInvalidInput = &DeployError{Code: "deploy_invalid_input", Message: "deploy: invalid input"}
    ErrDeployConflict     = &DeployError{Code: "deploy_conflict", Message: "deploy: conflict"}
    ErrDeployUnauthorized = &DeployError{Code: "deploy_unauthorized", Message: "deploy: unauthorized"}
    ErrDeployInternal     = &DeployError{Code: "deploy_internal", Message: "deploy: internal error"}
)

func NewDeployError(code, msg string) error { return &DeployError{Code: code, Message: msg} }
func IsDeployNotFound(err error) bool { return errors.Is(err, ErrDeployNotFound) }
