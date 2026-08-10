package handler

type GenericHandlerError struct { Code string; Message string; Cause error }

func (e *GenericHandlerError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}
func (e *GenericHandlerError) Is(target error) bool { _, ok := target.(*GenericHandlerError); return ok }
func (e *GenericHandlerError) Unwrap() error { return e.Cause }

var (
    ErrGenericHandlerNotFound     = &GenericHandlerError{Code: "handler_not_found", Message: "handler: not found"}
    ErrGenericHandlerInvalidInput = &GenericHandlerError{Code: "handler_invalid_input", Message: "handler: invalid input"}
    ErrGenericHandlerConflict     = &GenericHandlerError{Code: "handler_conflict", Message: "handler: conflict"}
)

func NewGenericHandlerError(code, msg string) error { return &GenericHandlerError{Code: code, Message: msg} }
