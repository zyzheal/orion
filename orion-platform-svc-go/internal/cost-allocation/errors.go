package costallocation

import "errors"

type CostAllocationError struct { Code string; Message string; Cause error }

func (e *CostAllocationError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *CostAllocationError) Is(target error) bool { _, ok := target.(*CostAllocationError); return ok }
func (e *CostAllocationError) Unwrap() error { return e.Cause }

var (
    ErrCostAllocationNotFound     = &CostAllocationError{Code: "costallocation_not_found", Message: "cost-allocation: not found"}
    ErrCostAllocationInvalidInput = &CostAllocationError{Code: "costallocation_invalid_input", Message: "cost-allocation: invalid input"}
    ErrCostAllocationConflict     = &CostAllocationError{Code: "costallocation_conflict", Message: "cost-allocation: conflict"}
    ErrCostAllocationUnauthorized = &CostAllocationError{Code: "costallocation_unauthorized", Message: "cost-allocation: unauthorized"}
    ErrCostAllocationInternal     = &CostAllocationError{Code: "costallocation_internal", Message: "cost-allocation: internal error"}
)

func NewCostAllocationError(code, msg string) error { return &CostAllocationError{Code: code, Message: msg} }
func IsCostAllocationNotFound(err error) bool { return errors.Is(err, ErrCostAllocationNotFound) }
