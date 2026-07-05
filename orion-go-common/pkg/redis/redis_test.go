package redis

import (
	"testing"
)

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()
	if cfg.Addr != "localhost:6379" {
		t.Errorf("expected 'localhost:6379', got %q", cfg.Addr)
	}
	if cfg.DialTimeout == 0 {
		t.Error("expected non-zero DialTimeout")
	}
	if cfg.ReadTimeout == 0 {
		t.Error("expected non-zero ReadTimeout")
	}
	if cfg.WriteTimeout == 0 {
		t.Error("expected non-zero WriteTimeout")
	}
}

func TestNewClient_DefaultConfig(t *testing.T) {
	cfg := DefaultConfig()
	client := NewClient(cfg)
	if client == nil {
		t.Fatal("expected non-nil client")
	}
	client.Close()
}

func TestNewClient_CustomConfig(t *testing.T) {
	cfg := Config{
		Addr:         "redis-host:6380",
		Password:     "secret",
		DB:           3,
		PoolSize:     20,
		MinIdleConns: 5,
		DialTimeout:  10 * 1e9, // 10s in nanoseconds
		ReadTimeout:  5 * 1e9,
		WriteTimeout: 5 * 1e9,
	}
	client := NewClient(cfg)
	if client == nil {
		t.Fatal("expected non-nil client")
	}
	client.Close()
}

func TestNewClientFromURL_Valid(t *testing.T) {
	client, err := NewClientFromURL("redis://localhost:6379/0")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if client == nil {
		t.Fatal("expected non-nil client")
	}
	client.Close()
}

func TestNewClientFromURL_Invalid(t *testing.T) {
	_, err := NewClientFromURL("not-a-url")
	if err == nil {
		t.Error("expected error for invalid URL")
	}
}

func TestNewClient_EmptyAddr(t *testing.T) {
	cfg := Config{}
	client := NewClient(cfg)
	if client == nil {
		t.Fatal("expected non-nil client")
	}
	client.Close()
}
