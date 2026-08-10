package contract

import "errors"

type ContractError struct { Code string; Message string; Cause error }

func (e *ContractError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ContractError) Is(target error) bool { _, ok := target.(*ContractError); return ok }
func (e *ContractError) Unwrap() error { return e.Cause }

var (
    ErrContractNotFound     = &ContractError{Code: "contract_not_found", Message: "contract: not found"}
    ErrContractInvalidInput = &ContractError{Code: "contract_invalid_input", Message: "contract: invalid input"}
    ErrContractConflict     = &ContractError{Code: "contract_conflict", Message: "contract: conflict"}
    ErrContractUnauthorized = &ContractError{Code: "contract_unauthorized", Message: "contract: unauthorized"}
    ErrContractInternal     = &ContractError{Code: "contract_internal", Message: "contract: internal error"}
)

func NewContractError(code, msg string) error { return &ContractError{Code: code, Message: msg} }
func IsContractNotFound(err error) bool { return errors.Is(err, ErrContractNotFound) }
