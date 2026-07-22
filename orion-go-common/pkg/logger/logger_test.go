package logger

import (
	"testing"
)

func TestNew_DefaultConfig(t *testing.T) {
	cfg := DefaultConfig("test-svc")
	if cfg.Level != "info" {
		t.Errorf("expected level 'info', got %q", cfg.Level)
	}
	if cfg.ServiceName != "test-svc" {
		t.Errorf("expected service name 'test-svc', got %q", cfg.ServiceName)
	}
	if cfg.Development {
		t.Error("expected Development=false")
	}
}

func TestNew_ProductionLogger(t *testing.T) {
	cfg := Config{
		Level:       "info",
		Development: false,
		ServiceName: "test-svc",
	}
	logger, err := New(cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if logger == nil {
		t.Fatal("expected non-nil logger")
	}
}

func TestNew_DevelopmentLogger(t *testing.T) {
	cfg := Config{
		Level:       "debug",
		Development: true,
		ServiceName: "test-svc",
	}
	logger, err := New(cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if logger == nil {
		t.Fatal("expected non-nil logger")
	}
}

func TestNew_InvalidLevel(t *testing.T) {
	cfg := Config{
		Level:       "invalid",
		Development: false,
		ServiceName: "test-svc",
	}
	logger, err := New(cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Should fall back to info level
	if logger == nil {
		t.Fatal("expected non-nil logger")
	}
}

func TestNew_WithoutServiceName(t *testing.T) {
	cfg := Config{
		Level:       "info",
		Development: false,
	}
	logger, err := New(cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if logger == nil {
		t.Fatal("expected non-nil logger")
	}
}

func TestMust_Success(t *testing.T) {
	cfg := DefaultConfig("test-svc")
	logger := Must(cfg)
	if logger == nil {
		t.Fatal("expected non-nil logger")
	}
}

func TestParseLevel(t *testing.T) {
	tests := []struct {
		input   string
		wantErr bool
	}{
		{"debug", false},
		{"info", false},
		{"warn", false},
		{"error", false},
		{"invalid", true},
	}
	for _, tt := range tests {
		_, err := parseLevel(tt.input)
		if (err != nil) != tt.wantErr {
			t.Errorf("parseLevel(%q): err=%v, wantErr=%v", tt.input, err, tt.wantErr)
		}
	}
}
