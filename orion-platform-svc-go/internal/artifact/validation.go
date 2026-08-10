package artifact

import (
    "fmt"
    "regexp"
    "strings"
)

type ArtifactValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultArtifactValidator() *ArtifactValidator {
    return &ArtifactValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ArtifactValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrArtifactInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("artifact: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("artifact: invalid name characters")
    }
    return nil
}

func (v *ArtifactValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("artifact: description too long") }
    return nil
}

func (v *ArtifactValidator) ValidateType(typ string) error {
    if typ == "" { return ErrArtifactInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("artifact: unsupported type")
}

func (v *ArtifactValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrArtifactInvalidInput }
    return nil
}

type ArtifactValidationResult struct { Valid bool; Errors []string }

func (v *ArtifactValidator) Validate(name, desc, typ, id string) *ArtifactValidationResult {
    r := &ArtifactValidationResult{}
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
