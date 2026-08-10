package aiagentrun

import (
    "fmt"
    "regexp"
    "strings"
)

type AiAgentRunValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultAiAgentRunValidator() *AiAgentRunValidator {
    return &AiAgentRunValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *AiAgentRunValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrAiAgentRunInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("ai-agent-run: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("ai-agent-run: invalid name")
    }
    return nil
}

func (v *AiAgentRunValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("ai-agent-run: description too long") }
    return nil
}

func (v *AiAgentRunValidator) ValidateType(typ string) error {
    if typ == "" { return ErrAiAgentRunInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("ai-agent-run: unsupported type")
}

func (v *AiAgentRunValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrAiAgentRunInvalidInput }
    return nil
}

type AiAgentRunValidationResult struct { Valid bool; Errors []string }

func (v *AiAgentRunValidator) Validate(name, desc, typ, id string) *AiAgentRunValidationResult {
    r := &AiAgentRunValidationResult{}
    checks := []struct{ field string; fn func() error }{
        {"name", func() error { return v.ValidateName(name) } },
        {"description", func() error { return v.ValidateDescription(desc) } },
        {"type", func() error { return v.ValidateType(typ) } },
        {"id", func() error { return v.ValidateID(id) } },
    }
    for _, c := range checks {
        if err := c.fn(); err != nil { r.Errors = append(r.Errors, c.field+": "+err.Error()) }
    }
    r.Valid = len(r.Errors) == 0
    return r
}
