package pluginmarketplace

import "errors"

type PluginMarketplaceError struct { Code string; Message string; Cause error }

func (e *PluginMarketplaceError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *PluginMarketplaceError) Is(target error) bool { _, ok := target.(*PluginMarketplaceError); return ok }
func (e *PluginMarketplaceError) Unwrap() error { return e.Cause }

var (
    ErrPluginMarketplaceNotFound     = &PluginMarketplaceError{Code: "pluginmarketplace_not_found", Message: "plugin-marketplace: not found"}
    ErrPluginMarketplaceInvalidInput = &PluginMarketplaceError{Code: "pluginmarketplace_invalid_input", Message: "plugin-marketplace: invalid input"}
    ErrPluginMarketplaceConflict     = &PluginMarketplaceError{Code: "pluginmarketplace_conflict", Message: "plugin-marketplace: conflict"}
    ErrPluginMarketplaceUnauthorized = &PluginMarketplaceError{Code: "pluginmarketplace_unauthorized", Message: "plugin-marketplace: unauthorized"}
    ErrPluginMarketplaceInternal     = &PluginMarketplaceError{Code: "pluginmarketplace_internal", Message: "plugin-marketplace: internal error"}
)

func NewPluginMarketplaceError(code, msg string) error { return &PluginMarketplaceError{Code: code, Message: msg} }
func IsPluginMarketplaceNotFound(err error) bool { return errors.Is(err, ErrPluginMarketplaceNotFound) }
