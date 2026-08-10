package pluginhotreload

import "errors"

type PluginHotreloadError struct { Code string; Message string; Cause error }

func (e *PluginHotreloadError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *PluginHotreloadError) Is(target error) bool { _, ok := target.(*PluginHotreloadError); return ok }
func (e *PluginHotreloadError) Unwrap() error { return e.Cause }

var (
    ErrPluginHotreloadNotFound     = &PluginHotreloadError{Code: "pluginhotreload_not_found", Message: "plugin-hotreload: not found"}
    ErrPluginHotreloadInvalidInput = &PluginHotreloadError{Code: "pluginhotreload_invalid_input", Message: "plugin-hotreload: invalid input"}
    ErrPluginHotreloadConflict     = &PluginHotreloadError{Code: "pluginhotreload_conflict", Message: "plugin-hotreload: conflict"}
    ErrPluginHotreloadUnauthorized = &PluginHotreloadError{Code: "pluginhotreload_unauthorized", Message: "plugin-hotreload: unauthorized"}
    ErrPluginHotreloadInternal     = &PluginHotreloadError{Code: "pluginhotreload_internal", Message: "plugin-hotreload: internal error"}
)

func NewPluginHotreloadError(code, msg string) error { return &PluginHotreloadError{Code: code, Message: msg} }
func IsPluginHotreloadNotFound(err error) bool { return errors.Is(err, ErrPluginHotreloadNotFound) }
