// Package apicomponent defines configuration errors for the API Component system.

package apicomponent

import "errors"

// ConfigError represents a configuration error in an API component.
type ConfigError struct {
	// Field identifies which field caused the error.
	Field string
	// Reason explains why the configuration is invalid.
	Reason string
}

// Error implements the error interface.
func (e *ConfigError) Error() string {
	return "api-component: invalid " + e.Field + ": " + e.Reason
}

// Is checks whether the given error is a ConfigError.
func (e *ConfigError) Is(target error) bool {
	_, ok := target.(*ConfigError)
	return ok
}

var ErrNotRegistered = errors.New("api-component: route not registered")
var ErrAlreadyRegistered = errors.New("api-component: route already registered")
var ErrComponentNotFound = errors.New("api-component: component not found")
