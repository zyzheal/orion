package bidashboard

import "errors"

type BiDashboardError struct { Code string; Message string; Cause error }

func (e *BiDashboardError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *BiDashboardError) Is(target error) bool { _, ok := target.(*BiDashboardError); return ok }
func (e *BiDashboardError) Unwrap() error { return e.Cause }

var (
    ErrBiDashboardNotFound     = &BiDashboardError{Code: "bidashboard_not_found", Message: "bi-dashboard: not found"}
    ErrBiDashboardInvalidInput = &BiDashboardError{Code: "bidashboard_invalid_input", Message: "bi-dashboard: invalid input"}
    ErrBiDashboardConflict     = &BiDashboardError{Code: "bidashboard_conflict", Message: "bi-dashboard: conflict"}
    ErrBiDashboardUnauthorized = &BiDashboardError{Code: "bidashboard_unauthorized", Message: "bi-dashboard: unauthorized"}
    ErrBiDashboardInternal     = &BiDashboardError{Code: "bidashboard_internal", Message: "bi-dashboard: internal error"}
)

func NewBiDashboardError(code, msg string) error { return &BiDashboardError{Code: code, Message: msg} }
func IsBiDashboardNotFound(err error) bool { return errors.Is(err, ErrBiDashboardNotFound) }
