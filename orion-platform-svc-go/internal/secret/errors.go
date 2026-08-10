package secret

import "errors"

type SecretError struct { Code string; Message string; Cause error }

func (e *SecretError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *SecretError) Is(target error) bool { _, ok := target.(*SecretError); return ok }
func (e *SecretError) Unwrap() error { return e.Cause }

var (
    ErrSecretNotFound     = &SecretError{Code: "secret_not_found", Message: "secret: not found"}
    ErrSecretInvalidInput = &SecretError{Code: "secret_invalid_input", Message: "secret: invalid input"}
    ErrSecretConflict     = &SecretError{Code: "secret_conflict", Message: "secret: conflict"}
    ErrSecretUnauthorized = &SecretError{Code: "secret_unauthorized", Message: "secret: unauthorized"}
    ErrSecretInternal     = &SecretError{Code: "secret_internal", Message: "secret: internal error"}
)

func NewSecretError(code, msg string) error { return &SecretError{Code: code, Message: msg} }
func IsSecretNotFound(err error) bool { return errors.Is(err, ErrSecretNotFound) }
