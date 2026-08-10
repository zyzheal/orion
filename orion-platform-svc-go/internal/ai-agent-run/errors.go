package aiagentrun

import "errors"

type AiAgentRunError struct { Code string; Message string; Cause error }

func (e *AiAgentRunError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *AiAgentRunError) Is(target error) bool { _, ok := target.(*AiAgentRunError); return ok }
func (e *AiAgentRunError) Unwrap() error { return e.Cause }

var (
    ErrAiAgentRunNotFound     = &AiAgentRunError{Code: "aiagentrun_not_found", Message: "ai-agent-run: not found"}
    ErrAiAgentRunInvalidInput = &AiAgentRunError{Code: "aiagentrun_invalid_input", Message: "ai-agent-run: invalid input"}
    ErrAiAgentRunConflict     = &AiAgentRunError{Code: "aiagentrun_conflict", Message: "ai-agent-run: conflict"}
    ErrAiAgentRunUnauthorized = &AiAgentRunError{Code: "aiagentrun_unauthorized", Message: "ai-agent-run: unauthorized"}
    ErrAiAgentRunInternal     = &AiAgentRunError{Code: "aiagentrun_internal", Message: "ai-agent-run: internal error"}
)

func NewAiAgentRunError(code, msg string) error { return &AiAgentRunError{Code: code, Message: msg} }
func IsAiAgentRunNotFound(err error) bool { return errors.Is(err, ErrAiAgentRunNotFound) }
