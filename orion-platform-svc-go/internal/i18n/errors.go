package i18n

import "errors"

type I18nError struct { Code string; Message string; Cause error }

func (e *I18nError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *I18nError) Is(target error) bool { _, ok := target.(*I18nError); return ok }
func (e *I18nError) Unwrap() error { return e.Cause }

var (
    ErrI18nNotFound     = &I18nError{Code: "i18n_not_found", Message: "i18n: not found"}
    ErrI18nInvalidInput = &I18nError{Code: "i18n_invalid_input", Message: "i18n: invalid input"}
    ErrI18nConflict     = &I18nError{Code: "i18n_conflict", Message: "i18n: conflict"}
    ErrI18nUnauthorized = &I18nError{Code: "i18n_unauthorized", Message: "i18n: unauthorized"}
    ErrI18nInternal     = &I18nError{Code: "i18n_internal", Message: "i18n: internal error"}
)

func NewI18nError(code, msg string) error { return &I18nError{Code: code, Message: msg} }
func IsI18nNotFound(err error) bool { return errors.Is(err, ErrI18nNotFound) }
