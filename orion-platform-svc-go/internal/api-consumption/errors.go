package apiconsumption

import "errors"

type ApiConsumptionError struct { Code string; Message string; Cause error }

func (e *ApiConsumptionError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ApiConsumptionError) Is(target error) bool { _, ok := target.(*ApiConsumptionError); return ok }
func (e *ApiConsumptionError) Unwrap() error { return e.Cause }

var (
    ErrApiConsumptionNotFound     = &ApiConsumptionError{Code: "apiconsumption_not_found", Message: "api-consumption: not found"}
    ErrApiConsumptionInvalidInput = &ApiConsumptionError{Code: "apiconsumption_invalid_input", Message: "api-consumption: invalid input"}
    ErrApiConsumptionConflict     = &ApiConsumptionError{Code: "apiconsumption_conflict", Message: "api-consumption: conflict"}
    ErrApiConsumptionUnauthorized = &ApiConsumptionError{Code: "apiconsumption_unauthorized", Message: "api-consumption: unauthorized"}
    ErrApiConsumptionInternal     = &ApiConsumptionError{Code: "apiconsumption_internal", Message: "api-consumption: internal error"}
)

func NewApiConsumptionError(code, msg string) error { return &ApiConsumptionError{Code: code, Message: msg} }
func IsApiConsumptionNotFound(err error) bool { return errors.Is(err, ErrApiConsumptionNotFound) }
