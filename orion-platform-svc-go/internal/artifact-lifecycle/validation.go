package artifactlifecycle

import (
    "fmt"
    "regexp"
    "strings"
)

type ArtifactLifecycleValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultArtifactLifecycleValidator() *ArtifactLifecycleValidator {
    return &ArtifactLifecycleValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ArtifactLifecycleValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrArtifactLifecycleInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("artifact-lifecycle: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("artifact-lifecycle: invalid name")
    }
    return nil
}

func (v *ArtifactLifecycleValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("artifact-lifecycle: description too long") }
    return nil
}

func (v *ArtifactLifecycleValidator) ValidateType(typ string) error {
    if typ == "" { return ErrArtifactLifecycleInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("artifact-lifecycle: unsupported type")
}

func (v *ArtifactLifecycleValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrArtifactLifecycleInvalidInput }
    return nil
}

type ArtifactLifecycleValidationResult struct { Valid bool; Errors []string }

func (v *ArtifactLifecycleValidator) Validate(name, desc, typ, id string) *ArtifactLifecycleValidationResult {
    r := &ArtifactLifecycleValidationResult{}
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
