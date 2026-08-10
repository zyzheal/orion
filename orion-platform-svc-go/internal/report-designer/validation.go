package reportdesigner

import (
    "fmt"
    "regexp"
    "strings"
)

type ReportDesignerValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultReportDesignerValidator() *ReportDesignerValidator {
    return &ReportDesignerValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ReportDesignerValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrReportDesignerInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("report-designer: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("report-designer: invalid name characters")
    }
    return nil
}

func (v *ReportDesignerValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("report-designer: description too long") }
    return nil
}

func (v *ReportDesignerValidator) ValidateType(typ string) error {
    if typ == "" { return ErrReportDesignerInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("report-designer: unsupported type")
}

func (v *ReportDesignerValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrReportDesignerInvalidInput }
    return nil
}

type ReportDesignerValidationResult struct { Valid bool; Errors []string }

func (v *ReportDesignerValidator) Validate(name, desc, typ, id string) *ReportDesignerValidationResult {
    r := &ReportDesignerValidationResult{}
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
