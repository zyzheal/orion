package models

import (
	"fmt"
	"regexp"
	"strings"
)

// TemplateRenderResult holds the output of rendering a template with variables.
type TemplateRenderResult struct {
	Subject        string   `json:"subject"`
	Body           string   `json:"body"`
	MissingVars    []string `json:"missing_vars"`
}

// TemplatePreviewInput is the payload for previewing a template with sample variables.
type TemplatePreviewInput struct {
	Variables map[string]string `json:"variables" binding:"required"`
}

// TemplateInheritanceOverride holds optional field overrides when inheriting a template.
type TemplateInheritanceOverride struct {
	Name            *string  `json:"name"`
	EventType       *string  `json:"event_type"`
	Subject         *string  `json:"subject"`
	SubjectTemplate *string  `json:"subject_template"`
	BodyTemplate    *string  `json:"body_template"`
	ChannelIDs      []string `json:"channel_ids"`
}

// ValidateCreateTemplateInput checks that required fields are present.
func ValidateCreateTemplateInput(input *CreateNotificationTemplateInput) error {
	if input == nil {
		return fmt.Errorf("input is nil")
	}
	if strings.TrimSpace(input.Name) == "" {
		return fmt.Errorf("name is required")
	}
	if strings.TrimSpace(input.EventType) == "" {
		return fmt.Errorf("event_type is required")
	}
	if strings.TrimSpace(input.BodyTemplate) == "" {
		return fmt.Errorf("body_template is required")
	}
	return nil
}

// templateVarRE matches {{variable}} placeholders (alphanumeric, underscore, hyphen).
var templateVarRE = regexp.MustCompile(`\{\{\s*([a-zA-Z_][a-zA-Z0-9_-]*)\s*\}\}`)

// ExtractTemplateVariables returns all unique {{variable}} names found in s.
func ExtractTemplateVariables(s string) []string {
	matches := templateVarRE.FindAllStringSubmatch(s, -1)
	seen := make(map[string]struct{})
	var vars []string
	for _, m := range matches {
		name := strings.TrimSpace(m[1])
		if _, ok := seen[name]; !ok {
			seen[name] = struct{}{}
			vars = append(vars, name)
		}
	}
	return vars
}

// RenderTemplate replaces {{variable}} placeholders in template with values from vars.
// Returns the rendered string and a slice of variable names that were missing from vars.
func RenderTemplate(template string, vars map[string]string) (string, []string) {
	placeholders := ExtractTemplateVariables(template)
	if len(placeholders) == 0 {
		return template, nil
	}

	missing := make([]string, 0)
	rendered := template
	for _, key := range placeholders {
		if val, ok := vars[key]; ok {
			re := regexp.MustCompile(`\{\{\s*` + regexp.QuoteMeta(key) + `\s*\}\}`)
			rendered = re.ReplaceAllString(rendered, val)
		} else {
			missing = append(missing, key)
		}
	}
	return rendered, missing
}

// RenderTemplateFull renders both subject_template and body_template for a template entity.
// Falls back to the plain `subject` field when subject_template is empty.
func RenderTemplateFull(t *NotificationTemplate, variables map[string]string) TemplateRenderResult {
	subjectSrc := t.SubjectTemplate
	if subjectSrc == "" {
		subjectSrc = t.Subject
	}
	bodyRendered, bodyMissing := RenderTemplate(t.BodyTemplate, variables)
	subjectRendered, subjectMissing := RenderTemplate(subjectSrc, variables)

	seen := make(map[string]struct{})
	var allMissing []string
	for _, v := range bodyMissing {
		if _, ok := seen[v]; !ok {
			seen[v] = struct{}{}
			allMissing = append(allMissing, v)
		}
	}
	for _, v := range subjectMissing {
		if _, ok := seen[v]; !ok {
			seen[v] = struct{}{}
			allMissing = append(allMissing, v)
		}
	}

	return TemplateRenderResult{
		Subject:     subjectRendered,
		Body:        bodyRendered,
		MissingVars: allMissing,
	}
}
