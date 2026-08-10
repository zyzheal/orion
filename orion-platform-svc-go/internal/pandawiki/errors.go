package pandawiki

import "errors"

type PandawikiError struct { Code string; Message string; Cause error }

func (e *PandawikiError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *PandawikiError) Is(target error) bool { _, ok := target.(*PandawikiError); return ok }
func (e *PandawikiError) Unwrap() error { return e.Cause }

var (
    ErrPandawikiNotFound     = &PandawikiError{Code: "pandawiki_not_found", Message: "pandawiki: not found"}
    ErrPandawikiInvalidInput = &PandawikiError{Code: "pandawiki_invalid_input", Message: "pandawiki: invalid input"}
    ErrPandawikiConflict     = &PandawikiError{Code: "pandawiki_conflict", Message: "pandawiki: conflict"}
    ErrPandawikiUnauthorized = &PandawikiError{Code: "pandawiki_unauthorized", Message: "pandawiki: unauthorized"}
    ErrPandawikiInternal     = &PandawikiError{Code: "pandawiki_internal", Message: "pandawiki: internal error"}
)

func NewPandawikiError(code, msg string) error { return &PandawikiError{Code: code, Message: msg} }
func IsPandawikiNotFound(err error) bool { return errors.Is(err, ErrPandawikiNotFound) }
