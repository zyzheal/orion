// Package sentinel provides canonical sentinel error values used by all Orion
// Go microservices.
//
// Previously each service/repository defined its own "var ErrNotFound =
// errors.New(...)" in ~157 files. This package deduplicates those definitions
// so consumers (services, repositories, handlers) share one canonical instance
// that works with errors.Is / errors.As.
//
// NOTE: do not place these in orion/go-common/pkg/errors because that package
// already owns string constants (ErrNotFound = "NOT_FOUND") used in 1200+
// handler call sites as error-code strings. Keeping the two concepts in
// separate packages avoids compile-time name clashes.
package sentinel

import "errors"

// NotFound is returned when a requested resource does not exist.
//
// Prefer returning sentinel.NotFound (or fmt.Errorf("...", sentinel.NotFound))
// instead of defining a per-module ErrNotFound.
var NotFound = errors.New("not found")

// Unauthorized is returned when the caller lacks valid credentials.
var Unauthorized = errors.New("unauthorized")

// Forbidden is returned when the caller lacks permission for the resource.
var Forbidden = errors.New("forbidden")

// Conflict is returned when the request would create a duplicate or otherwise
// conflict with existing state.
var Conflict = errors.New("conflict")

// BadRequest is returned when the request payload or parameters are invalid.
var BadRequest = errors.New("bad request")

// Internal is returned for unexpected server-side failures.
var Internal = errors.New("internal server error")
