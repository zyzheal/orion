package service

import (
	"testing"
)

func TestNewTemplateService(t *testing.T) {
	svc := NewTemplateService(nil, nil)
	if svc == nil {
		t.Fatalf("NewTemplateService returned nil")
	}
}

func TestTemplateServiceNotNil(t *testing.T) {
	_ = NewTemplateService(nil, nil)
}
