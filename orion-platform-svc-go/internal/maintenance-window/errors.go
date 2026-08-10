package maintenancewindow

import "errors"

type MaintenanceWindowError struct { Code string; Message string; Cause error }

func (e *MaintenanceWindowError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *MaintenanceWindowError) Is(target error) bool { _, ok := target.(*MaintenanceWindowError); return ok }
func (e *MaintenanceWindowError) Unwrap() error { return e.Cause }

var (
    ErrMaintenanceWindowNotFound     = &MaintenanceWindowError{Code: "maintenancewindow_not_found", Message: "maintenance-window: not found"}
    ErrMaintenanceWindowInvalidInput = &MaintenanceWindowError{Code: "maintenancewindow_invalid_input", Message: "maintenance-window: invalid input"}
    ErrMaintenanceWindowConflict     = &MaintenanceWindowError{Code: "maintenancewindow_conflict", Message: "maintenance-window: conflict"}
    ErrMaintenanceWindowUnauthorized = &MaintenanceWindowError{Code: "maintenancewindow_unauthorized", Message: "maintenance-window: unauthorized"}
    ErrMaintenanceWindowInternal     = &MaintenanceWindowError{Code: "maintenancewindow_internal", Message: "maintenance-window: internal error"}
)

func NewMaintenanceWindowError(code, msg string) error { return &MaintenanceWindowError{Code: code, Message: msg} }
func IsMaintenanceWindowNotFound(err error) bool { return errors.Is(err, ErrMaintenanceWindowNotFound) }
