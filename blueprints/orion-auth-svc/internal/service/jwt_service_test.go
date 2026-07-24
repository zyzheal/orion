package service

import (
	"testing"
	"time"
)

func TestGenerateTokens(t *testing.T) {
	svc := NewJWTService("test-secret-key", 15*time.Minute, 7*24*time.Hour)

	pair, err := svc.GenerateTokens("user-123", "tenant-abc", "admin")
	if err != nil {
		t.Fatalf("GenerateTokens failed: %v", err)
	}

	if pair.AccessToken == "" {
		t.Error("access token should not be empty")
	}
	if pair.RefreshToken == "" {
		t.Error("refresh token should not be empty")
	}
	if pair.TokenType != "Bearer" {
		t.Errorf("expected Bearer, got %s", pair.TokenType)
	}
	if pair.ExpiresIn != int((15 * time.Minute).Seconds()) {
		t.Errorf("expected 900, got %d", pair.ExpiresIn)
	}
	if pair.JTI == "" {
		t.Error("JTI should not be empty")
	}
}

func TestValidateToken(t *testing.T) {
	svc := NewJWTService("test-secret-key", 15*time.Minute, 7*24*time.Hour)

	pair, err := svc.GenerateTokens("user-123", "tenant-abc", "admin")
	if err != nil {
		t.Fatalf("GenerateTokens failed: %v", err)
	}

	claims, err := svc.ValidateToken(pair.AccessToken)
	if err != nil {
		t.Fatalf("ValidateToken failed: %v", err)
	}

	if claims.Subject != "user-123" {
		t.Errorf("expected user-123, got %s", claims.Subject)
	}
	if claims.TenantID != "tenant-abc" {
		t.Errorf("expected tenant-abc, got %s", claims.TenantID)
	}
	if claims.Role != "admin" {
		t.Errorf("expected admin, got %s", claims.Role)
	}
}

func TestValidateToken_InvalidSecret(t *testing.T) {
	svc1 := NewJWTService("secret-1", 15*time.Minute, 7*24*time.Hour)
	svc2 := NewJWTService("secret-2", 15*time.Minute, 7*24*time.Hour)

	pair, err := svc1.GenerateTokens("user-123", "tenant-abc", "admin")
	if err != nil {
		t.Fatalf("GenerateTokens failed: %v", err)
	}

	_, err = svc2.ValidateToken(pair.AccessToken)
	if err == nil {
		t.Error("expected validation to fail with different secret")
	}
}

func TestValidateToken_Expired(t *testing.T) {
	svc := NewJWTService("test-secret-key", -1*time.Second, 7*24*time.Hour)

	pair, err := svc.GenerateTokens("user-123", "tenant-abc", "admin")
	if err != nil {
		t.Fatalf("GenerateTokens failed: %v", err)
	}

	_, err = svc.ValidateToken(pair.AccessToken)
	if err == nil {
		t.Error("expected validation to fail for expired token")
	}
}

func TestValidateToken_Malformed(t *testing.T) {
	svc := NewJWTService("test-secret-key", 15*time.Minute, 7*24*time.Hour)

	_, err := svc.ValidateToken("not-a-valid-token")
	if err == nil {
		t.Error("expected validation to fail for malformed token")
	}
}

func TestGenerateUUID_Uniqueness(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 1000; i++ {
		id := generateUUID()
		if seen[id] {
			t.Fatalf("duplicate UUID generated: %s", id)
		}
		seen[id] = true
	}
}

func TestGenerateUUID_Format(t *testing.T) {
	id := generateUUID()
	// UUID format: 8-4-4-4-12 hex chars
	if len(id) != 36 {
		t.Errorf("expected 36 chars, got %d: %s", len(id), id)
	}
	if id[8] != '-' || id[13] != '-' || id[18] != '-' || id[23] != '-' {
		t.Errorf("invalid UUID format: %s", id)
	}
}
