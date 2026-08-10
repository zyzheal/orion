package productline

import "errors"

type ProductLineError struct { Code string; Message string; Cause error }

func (e *ProductLineError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ProductLineError) Is(target error) bool { _, ok := target.(*ProductLineError); return ok }
func (e *ProductLineError) Unwrap() error { return e.Cause }

var (
    ErrProductLineNotFound     = &ProductLineError{Code: "productline_not_found", Message: "product-line: not found"}
    ErrProductLineInvalidInput = &ProductLineError{Code: "productline_invalid_input", Message: "product-line: invalid input"}
    ErrProductLineConflict     = &ProductLineError{Code: "productline_conflict", Message: "product-line: conflict"}
    ErrProductLineUnauthorized = &ProductLineError{Code: "productline_unauthorized", Message: "product-line: unauthorized"}
    ErrProductLineInternal     = &ProductLineError{Code: "productline_internal", Message: "product-line: internal error"}
)

func NewProductLineError(code, msg string) error { return &ProductLineError{Code: code, Message: msg} }
func IsProductLineNotFound(err error) bool { return errors.Is(err, ErrProductLineNotFound) }
