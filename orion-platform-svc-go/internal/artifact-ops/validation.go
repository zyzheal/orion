package artifactops

import (
    "fmt"
    "regexp"
    "strings"
)

type ArtifactOpsValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultArtifactOpsValidator() *ArtifactOpsValidator {
    return &ArtifactOpsValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ArtifactOpsValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrArtifactOpsInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("artifact-ops: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("artifact-ops: invalid name")
    }
    return nil
}

func (v *ArtifactOpsValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("artifact-ops: description too long") }
    return nil
}

func (v *ArtifactOpsValidator) ValidateType(typ string) error {
    if typ == "" { return ErrArtifactOpsInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("artifact-ops: unsupported type")
}

func (v *ArtifactOpsValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrArtifactOpsInvalidInput }
    return nil
}

type ArtifactOpsValidationResult struct { Valid bool; Errors []string }

func (v *ArtifactOpsValidator) Validate(name, desc, typ, id string) *ArtifactOpsValidationResult {
    r := &ArtifactOpsValidationResult{}
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
