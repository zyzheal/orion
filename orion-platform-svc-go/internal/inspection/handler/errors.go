package handler

type InspectionError struct { Code string; Message string; Cause error }

func (e *InspectionError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}
func (e *InspectionError) Is(target error) bool { _, ok := target.(*InspectionError); return ok }
func (e *InspectionError) Unwrap() error { return e.Cause }

var (
    ErrInspectionNotFound     = &InspectionError{Code: "inspection_not_found", Message: "inspection: not found"}
    ErrInspectionInvalidInput = &InspectionError{Code: "inspection_invalid_input", Message: "inspection: invalid input"}
    ErrInspectionConflict     = &InspectionError{Code: "inspection_conflict", Message: "inspection: conflict"}
)

func NewInspectionError(code, msg string) error { return &InspectionError{Code: code, Message: msg} }
