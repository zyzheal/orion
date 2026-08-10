package apikey

import "errors"

type ApiKeyError struct { Code string; Message string; Cause error }

func (e *ApiKeyError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ApiKeyError) Is(target error) bool { _, ok := target.(*ApiKeyError); return ok }
func (e *ApiKeyError) Unwrap() error { return e.Cause }

var (
    ErrApiKeyNotFound     = &ApiKeyError{Code: "apikey_not_found", Message: "api-key: not found"}
    ErrApiKeyInvalidInput = &ApiKeyError{Code: "apikey_invalid_input", Message: "api-key: invalid input"}
    ErrApiKeyConflict     = &ApiKeyError{Code: "apikey_conflict", Message: "api-key: conflict"}
    ErrApiKeyUnauthorized = &ApiKeyError{Code: "apikey_unauthorized", Message: "api-key: unauthorized"}
    ErrApiKeyInternal     = &ApiKeyError{Code: "apikey_internal", Message: "api-key: internal error"}
)

func NewApiKeyError(code, msg string) error { return &ApiKeyError{Code: code, Message: msg} }
func IsApiKeyNotFound(err error) bool { return errors.Is(err, ErrApiKeyNotFound) }
