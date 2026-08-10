package ociregistry

import "errors"

type OciRegistryError struct { Code string; Message string; Cause error }

func (e *OciRegistryError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *OciRegistryError) Is(target error) bool { _, ok := target.(*OciRegistryError); return ok }
func (e *OciRegistryError) Unwrap() error { return e.Cause }

var (
    ErrOciRegistryNotFound     = &OciRegistryError{Code: "ociregistry_not_found", Message: "oci-registry: not found"}
    ErrOciRegistryInvalidInput = &OciRegistryError{Code: "ociregistry_invalid_input", Message: "oci-registry: invalid input"}
    ErrOciRegistryConflict     = &OciRegistryError{Code: "ociregistry_conflict", Message: "oci-registry: conflict"}
    ErrOciRegistryUnauthorized = &OciRegistryError{Code: "ociregistry_unauthorized", Message: "oci-registry: unauthorized"}
    ErrOciRegistryInternal     = &OciRegistryError{Code: "ociregistry_internal", Message: "oci-registry: internal error"}
)

func NewOciRegistryError(code, msg string) error { return &OciRegistryError{Code: code, Message: msg} }
func IsOciRegistryNotFound(err error) bool { return errors.Is(err, ErrOciRegistryNotFound) }
