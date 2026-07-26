package service

import (
	"context"
	"testing"

	"orion/config-mgmt-svc-go/internal/config/models"
)

func TestServiceErrors(t *testing.T) {
	if ErrConfigNotFound.Error() != "config item not found" {
		t.Errorf("unexpected: %s", ErrConfigNotFound.Error())
	}
	if ErrVersionNotFound.Error() != "config version not found" {
		t.Errorf("unexpected: %s", ErrVersionNotFound.Error())
	}
	if ErrAlreadyExists.Error() != "config already exists in target environment" {
		t.Errorf("unexpected: %s", ErrAlreadyExists.Error())
	}
	if ErrInvalidVersion.Error() != "target version must be less than current version" {
		t.Errorf("unexpected: %s", ErrInvalidVersion.Error())
	}
}

func TestValidateConfig_EmptyKey(t *testing.T) {
	svc := &Service{}
	result := svc.ValidateConfig(context.Background(), "", "value", "production")
	if result.Valid {
		t.Error("expected invalid for empty key")
	}
	found := false
	for _, i := range result.Issues {
		if i.Field == "key" && i.Level == "error" {
			found = true
		}
	}
	if !found {
		t.Error("expected error issue for empty key")
	}
}

func TestValidateConfig_LongKey(t *testing.T) {
	svc := &Service{}
	longKey := make([]byte, 300)
	for i := range longKey {
		longKey[i] = 'a'
	}
	result := svc.ValidateConfig(context.Background(), string(longKey), "value", "production")
	if result.Valid {
		t.Error("expected invalid for key exceeding 256 chars")
	}
}

func TestValidateConfig_InvalidJSON(t *testing.T) {
	svc := &Service{}
	result := svc.ValidateConfig(context.Background(), "db.host", `{"invalid": }`, "production")
	if result.Valid {
		t.Error("expected invalid for malformed JSON")
	}
}

func TestValidateConfig_InvalidEnvironment(t *testing.T) {
	svc := &Service{}
	result := svc.ValidateConfig(context.Background(), "db.host", "localhost", "invalid_env")
	// Invalid environment produces a warning, not an error — result should still be valid
	hasWarning := false
	for _, i := range result.Issues {
		if i.Level == "warning" && i.Field == "environment" {
			hasWarning = true
		}
	}
	if !hasWarning {
		t.Error("expected warning issue for invalid environment")
	}
}

func TestValidateConfig_ValidInput(t *testing.T) {
	svc := &Service{}
	result := svc.ValidateConfig(context.Background(), "db.host", "localhost", "production")
	if !result.Valid {
		t.Errorf("expected valid, got issues: %+v", result.Issues)
	}
}

func TestValidateConfig_EmptyValue(t *testing.T) {
	svc := &Service{}
	result := svc.ValidateConfig(context.Background(), "db.host", "", "production")
	// Should be valid but with warning
	if !result.Valid {
		t.Error("empty value should still be valid (warning only)")
	}
	hasWarning := false
	for _, i := range result.Issues {
		if i.Level == "warning" && i.Field == "value" {
			hasWarning = true
		}
	}
	if !hasWarning {
		t.Error("expected warning for empty value")
	}
}

func TestValidateConfig_ValidJSON(t *testing.T) {
	svc := &Service{}
	result := svc.ValidateConfig(context.Background(), "app.config", `{"debug": true, "port": 8080}`, "dev")
	if !result.Valid {
		t.Errorf("expected valid JSON, got issues: %+v", result.Issues)
	}
}

func TestHasErrors(t *testing.T) {
	if hasErrors(nil) {
		t.Error("expected false for nil")
	}
	if hasErrors([]models.ValidationIssue{}) {
		t.Error("expected false for empty slice")
	}
}

func TestConstants(t *testing.T) {
	if ChangeTypeCreate != "create" {
		t.Errorf("unexpected ChangeTypeCreate: %s", ChangeTypeCreate)
	}
	if ChangeTypeUpdate != "update" {
		t.Errorf("unexpected ChangeTypeUpdate: %s", ChangeTypeUpdate)
	}
	if ChangeTypeRollback != "rollback" {
		t.Errorf("unexpected ChangeTypeRollback: %s", ChangeTypeRollback)
	}
	if DefaultEnv != "production" {
		t.Errorf("unexpected DefaultEnv: %s", DefaultEnv)
	}
	if DefaultVersion != 1 {
		t.Errorf("unexpected DefaultVersion: %d", DefaultVersion)
	}
	if MaxHistoryLimit != 200 {
		t.Errorf("unexpected MaxHistoryLimit: %d", MaxHistoryLimit)
	}
}

func TestNowUTC(t *testing.T) {
	ts := nowUTC()
	if ts.IsZero() {
		t.Error("expected non-zero time")
	}
}
