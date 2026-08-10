package supplychain

import "errors"

type SupplyChainError struct { Code string; Message string; Cause error }

func (e *SupplyChainError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *SupplyChainError) Is(target error) bool { _, ok := target.(*SupplyChainError); return ok }
func (e *SupplyChainError) Unwrap() error { return e.Cause }

var (
    ErrSupplyChainNotFound     = &SupplyChainError{Code: "supplychain_not_found", Message: "supply-chain: not found"}
    ErrSupplyChainInvalidInput = &SupplyChainError{Code: "supplychain_invalid_input", Message: "supply-chain: invalid input"}
    ErrSupplyChainConflict     = &SupplyChainError{Code: "supplychain_conflict", Message: "supply-chain: conflict"}
    ErrSupplyChainUnauthorized = &SupplyChainError{Code: "supplychain_unauthorized", Message: "supply-chain: unauthorized"}
    ErrSupplyChainInternal     = &SupplyChainError{Code: "supplychain_internal", Message: "supply-chain: internal error"}
)

func NewSupplyChainError(code, msg string) error { return &SupplyChainError{Code: code, Message: msg} }
func IsSupplyChainNotFound(err error) bool { return errors.Is(err, ErrSupplyChainNotFound) }
