package sbom

import "errors"

// SbomError represents domain errors for the sbom module.
type SbomError struct {
    Code    string
    Message string
    Cause   error
}

func (e *SbomError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *SbomError) Is(target error) bool {
    _, ok := target.(*SbomError)
    return ok
}

func (e *SbomError) Unwrap() error {
    return e.Cause
}

var (
    ErrSbomNotFound     = &SbomError{Code: "sbom_not_found", Message: "sbom: resource not found"}
    ErrSbomInvalidInput = &SbomError{Code: "sbom_invalid_input", Message: "sbom: invalid input"}
    ErrSbomConflict     = &SbomError{Code: "sbom_conflict", Message: "sbom: resource conflict"}
    ErrSbomUnauthorized = &SbomError{Code: "sbom_unauthorized", Message: "sbom: unauthorized access"}
    ErrSbomInternal     = &SbomError{Code: "sbom_internal", Message: "sbom: internal error"}
)

func NewSbomError(code, message string) error {
    return &SbomError{Code: code, Message: message}
}

func IsSbomNotFound(err error) bool {
    return errors.Is(err, ErrSbomNotFound)
}
