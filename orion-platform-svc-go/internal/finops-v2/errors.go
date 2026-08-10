package finopsv2

import "errors"

// FinopsV2Error represents domain errors for the finops-v2 module.
type FinopsV2Error struct {
    Code    string
    Message string
    Cause   error
}

func (e *FinopsV2Error) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *FinopsV2Error) Is(target error) bool {
    _, ok := target.(*FinopsV2Error)
    return ok
}

func (e *FinopsV2Error) Unwrap() error {
    return e.Cause
}

var (
    ErrFinopsV2NotFound     = &FinopsV2Error{Code: "finopsv2_not_found", Message: "finops-v2: resource not found"}
    ErrFinopsV2InvalidInput = &FinopsV2Error{Code: "finopsv2_invalid_input", Message: "finops-v2: invalid input"}
    ErrFinopsV2Conflict     = &FinopsV2Error{Code: "finopsv2_conflict", Message: "finops-v2: resource conflict"}
    ErrFinopsV2Unauthorized = &FinopsV2Error{Code: "finopsv2_unauthorized", Message: "finops-v2: unauthorized access"}
    ErrFinopsV2Internal     = &FinopsV2Error{Code: "finopsv2_internal", Message: "finops-v2: internal error"}
)

func NewFinopsV2Error(code, message string) error {
    return &FinopsV2Error{Code: code, Message: message}
}

func IsFinopsV2NotFound(err error) bool {
    return errors.Is(err, ErrFinopsV2NotFound)
}
