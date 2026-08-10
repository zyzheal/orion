package reportdesigner

import "errors"

// ReportDesignerError represents domain errors for the report-designer module.
type ReportDesignerError struct {
    Code    string
    Message string
    Cause   error
}

func (e *ReportDesignerError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *ReportDesignerError) Is(target error) bool {
    _, ok := target.(*ReportDesignerError)
    return ok
}

func (e *ReportDesignerError) Unwrap() error {
    return e.Cause
}

var (
    ErrReportDesignerNotFound     = &ReportDesignerError{Code: "reportdesigner_not_found", Message: "report-designer: resource not found"}
    ErrReportDesignerInvalidInput = &ReportDesignerError{Code: "reportdesigner_invalid_input", Message: "report-designer: invalid input"}
    ErrReportDesignerConflict     = &ReportDesignerError{Code: "reportdesigner_conflict", Message: "report-designer: resource conflict"}
    ErrReportDesignerUnauthorized = &ReportDesignerError{Code: "reportdesigner_unauthorized", Message: "report-designer: unauthorized access"}
    ErrReportDesignerInternal     = &ReportDesignerError{Code: "reportdesigner_internal", Message: "report-designer: internal error"}
)

func NewReportDesignerError(code, message string) error {
    return &ReportDesignerError{Code: code, Message: message}
}

func IsReportDesignerNotFound(err error) bool {
    return errors.Is(err, ErrReportDesignerNotFound)
}
