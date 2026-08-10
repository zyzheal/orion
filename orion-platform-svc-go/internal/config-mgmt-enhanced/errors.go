package configmgmtenhanced

import "errors"

// ConfigMgmtEnhancedError represents domain errors for the config-mgmt-enhanced module.
type ConfigMgmtEnhancedError struct {
    Code    string
    Message string
    Cause   error
}

func (e *ConfigMgmtEnhancedError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *ConfigMgmtEnhancedError) Is(target error) bool {
    _, ok := target.(*ConfigMgmtEnhancedError)
    return ok
}

func (e *ConfigMgmtEnhancedError) Unwrap() error {
    return e.Cause
}

var (
    ErrConfigMgmtEnhancedNotFound     = &ConfigMgmtEnhancedError{Code: "configmgmtenhanced_not_found", Message: "config-mgmt-enhanced: resource not found"}
    ErrConfigMgmtEnhancedInvalidInput = &ConfigMgmtEnhancedError{Code: "configmgmtenhanced_invalid_input", Message: "config-mgmt-enhanced: invalid input"}
    ErrConfigMgmtEnhancedConflict     = &ConfigMgmtEnhancedError{Code: "configmgmtenhanced_conflict", Message: "config-mgmt-enhanced: resource conflict"}
    ErrConfigMgmtEnhancedUnauthorized = &ConfigMgmtEnhancedError{Code: "configmgmtenhanced_unauthorized", Message: "config-mgmt-enhanced: unauthorized access"}
    ErrConfigMgmtEnhancedInternal     = &ConfigMgmtEnhancedError{Code: "configmgmtenhanced_internal", Message: "config-mgmt-enhanced: internal error"}
)

func NewConfigMgmtEnhancedError(code, message string) error {
    return &ConfigMgmtEnhancedError{Code: code, Message: message}
}

func IsConfigMgmtEnhancedNotFound(err error) bool {
    return errors.Is(err, ErrConfigMgmtEnhancedNotFound)
}
