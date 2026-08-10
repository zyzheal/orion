package mcp

import "errors"

type McpError struct { Code string; Message string; Cause error }

func (e *McpError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *McpError) Is(target error) bool { _, ok := target.(*McpError); return ok }
func (e *McpError) Unwrap() error { return e.Cause }

var (
    ErrMcpNotFound     = &McpError{Code: "mcp_not_found", Message: "mcp: not found"}
    ErrMcpInvalidInput = &McpError{Code: "mcp_invalid_input", Message: "mcp: invalid input"}
    ErrMcpConflict     = &McpError{Code: "mcp_conflict", Message: "mcp: conflict"}
    ErrMcpUnauthorized = &McpError{Code: "mcp_unauthorized", Message: "mcp: unauthorized"}
    ErrMcpInternal     = &McpError{Code: "mcp_internal", Message: "mcp: internal error"}
)

func NewMcpError(code, msg string) error { return &McpError{Code: code, Message: msg} }
func IsMcpNotFound(err error) bool { return errors.Is(err, ErrMcpNotFound) }
