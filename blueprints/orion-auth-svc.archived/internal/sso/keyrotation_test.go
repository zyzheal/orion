package sso

import (
	"context"
	"crypto/rsa"
	"fmt"
	"testing"
	"time"
)

// mockKeyStore implements KeyStore for testing.
type mockKeyStore struct {
	keys    map[string]*SigningKey // key: keyID
	active  map[string]string     // tenantID -> active keyID
}

func newMockKeyStore() *mockKeyStore {
	return &mockKeyStore{
		keys:   make(map[string]*SigningKey),
		active: make(map[string]string),
	}
}

func (s *mockKeyStore) SaveKey(ctx context.Context, key *SigningKey) error {
	s.keys[key.ID] = key
	if key.IsActive {
		s.active[key.TenantID] = key.ID
	}
	return nil
}

func (s *mockKeyStore) GetActiveKey(ctx context.Context, tenantID string) (*SigningKey, error) {
	keyID, ok := s.active[tenantID]
	if !ok {
		return nil, fmt.Errorf("no active key")
	}
	key, ok := s.keys[keyID]
	if !ok {
		return nil, fmt.Errorf("key not found")
	}
	return key, nil
}

func (s *mockKeyStore) GetKeyByID(ctx context.Context, keyID string) (*SigningKey, error) {
	if key, ok := s.keys[keyID]; ok {
		return key, nil
	}
	return nil, fmt.Errorf("key not found")
}

func (s *mockKeyStore) ListKeys(ctx context.Context, tenantID string) ([]*SigningKey, error) {
	var result []*SigningKey
	for _, k := range s.keys {
		if k.TenantID == tenantID {
			result = append(result, k)
		}
	}
	return result, nil
}

func (s *mockKeyStore) DeactivateKey(ctx context.Context, keyID string) error {
	if key, ok := s.keys[keyID]; ok {
		key.IsActive = false
	}
	return nil
}

func (s *mockKeyStore) DeleteKey(ctx context.Context, keyID string) error {
	delete(s.keys, keyID)
	return nil
}

func TestKeyRotationManager_Initialize_CreatesNewKey(t *testing.T) {
	store := newMockKeyStore()
	mgr := NewKeyRotationManager(store, KeyRotationConfig{})

	err := mgr.Initialize(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	key := mgr.GetSigningKey()
	if key == nil {
		t.Fatal("expected non-nil signing key")
	}
	if key.Algorithm != "RS256" {
		t.Errorf("expected algorithm=RS256, got %s", key.Algorithm)
	}
	if key.PrivateKeyPEM == "" {
		t.Error("expected non-empty private key PEM")
	}
	if key.PublicKeyPEM == "" {
		t.Error("expected non-empty public key PEM")
	}
}

func TestKeyRotationManager_Initialize_LoadsExistingKey(t *testing.T) {
	store := newMockKeyStore()
	mgr := NewKeyRotationManager(store, KeyRotationConfig{})

	// First initialize creates a key
	err := mgr.Initialize(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	key1 := mgr.GetSigningKey()

	// Second initialize should load existing key
	mgr2 := NewKeyRotationManager(store, KeyRotationConfig{})
	err = mgr2.Initialize(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	key2 := mgr2.GetSigningKey()

	if key1.ID != key2.ID {
		t.Errorf("expected same key ID on re-initialize, got %s vs %s", key1.ID, key2.ID)
	}
}

func TestKeyRotationManager_Rotate(t *testing.T) {
	store := newMockKeyStore()
	mgr := NewKeyRotationManager(store, KeyRotationConfig{
		GracePeriod: 1 * time.Hour,
	})

	err := mgr.Initialize(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	oldKey := mgr.GetSigningKey()

	// Rotate
	err = mgr.Rotate(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	newKey := mgr.GetSigningKey()
	if newKey.ID == oldKey.ID {
		t.Error("new key should have different ID after rotation")
	}
	if !newKey.IsActive {
		t.Error("new key should be active")
	}
}

func TestKeyRotationManager_GetVerificationKeys(t *testing.T) {
	store := newMockKeyStore()
	mgr := NewKeyRotationManager(store, KeyRotationConfig{
		GracePeriod: 1 * time.Hour,
	})

	err := mgr.Initialize(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Before rotation: 1 key
	keys := mgr.GetVerificationKeys()
	if len(keys) != 1 {
		t.Errorf("expected 1 verification key before rotation, got %d", len(keys))
	}

	// After rotation: 2 keys (active + previous in grace period)
	_ = mgr.Rotate(context.Background(), "t1")
	keys = mgr.GetVerificationKeys()
	if len(keys) != 2 {
		t.Errorf("expected 2 verification keys after rotation, got %d", len(keys))
	}
}

func TestKeyRotationManager_GetPublicKey(t *testing.T) {
	store := newMockKeyStore()
	mgr := NewKeyRotationManager(store, KeyRotationConfig{})

	err := mgr.Initialize(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	pubKey := mgr.GetPublicKey()
	if pubKey == nil {
		t.Fatal("expected non-nil public key")
	}
	if pubKey.N == nil {
		t.Error("public key N should not be nil")
	}
}

func TestKeyRotationManager_GetPrivateKey(t *testing.T) {
	store := newMockKeyStore()
	mgr := NewKeyRotationManager(store, KeyRotationConfig{})

	err := mgr.Initialize(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	privKey := mgr.GetPrivateKey()
	if privKey == nil {
		t.Fatal("expected non-nil private key")
	}
	if privKey.D == nil {
		t.Error("private key D should not be nil")
	}

	// Verify public/private key pair matches
	pubKey := mgr.GetPublicKey()
	if privKey.PublicKey.N.Cmp(pubKey.N) != 0 {
		t.Error("public key N should match between private and public key")
	}
}

func TestKeyRotationManager_GetPublicKey_NilKey(t *testing.T) {
	store := newMockKeyStore()
	mgr := NewKeyRotationManager(store, KeyRotationConfig{})

	// Before Initialize, should return nil
	pubKey := mgr.GetPublicKey()
	if pubKey != nil {
		t.Error("expected nil public key before initialization")
	}
}

func TestKeyRotationManager_GetPrivateKey_NilKey(t *testing.T) {
	store := newMockKeyStore()
	mgr := NewKeyRotationManager(store, KeyRotationConfig{})

	privKey := mgr.GetPrivateKey()
	if privKey != nil {
		t.Error("expected nil private key before initialization")
	}
}

func TestKeyRotationManager_DefaultConfig(t *testing.T) {
	mgr := NewKeyRotationManager(nil, KeyRotationConfig{})

	if mgr.config.RotationInterval != 24*time.Hour {
		t.Errorf("expected default rotation interval=24h, got %v", mgr.config.RotationInterval)
	}
	if mgr.config.KeySize != 2048 {
		t.Errorf("expected default key size=2048, got %d", mgr.config.KeySize)
	}
	if mgr.config.GracePeriod != 1*time.Hour {
		t.Errorf("expected default grace period=1h, got %v", mgr.config.GracePeriod)
	}
	if mgr.config.MaxKeyHistory != 5 {
		t.Errorf("expected default max key history=5, got %d", mgr.config.MaxKeyHistory)
	}
}

func TestGenerateKeyPair(t *testing.T) {
	pubPEM, privPEM, err := GenerateKeyPair(2048)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if pubPEM == "" {
		t.Error("expected non-empty public PEM")
	}
	if privPEM == "" {
		t.Error("expected non-empty private PEM")
	}
	if pubPEM == privPEM {
		t.Error("public and private PEM should be different")
	}
}

func TestGenerateKeyID(t *testing.T) {
	id1 := generateKeyID([]byte("key-data-1"))
	id2 := generateKeyID([]byte("key-data-1"))
	id3 := generateKeyID([]byte("key-data-2"))

	if id1 != id2 {
		t.Error("same input should produce same key ID")
	}
	if id1 == id3 {
		t.Error("different input should produce different key ID")
	}
	if len(id1) == 0 {
		t.Error("expected non-empty key ID")
	}
}

func TestKeyRotationManager_Rotate_MultipleTimes(t *testing.T) {
	store := newMockKeyStore()
	mgr := NewKeyRotationManager(store, KeyRotationConfig{
		GracePeriod: 1 * time.Hour,
	})

	err := mgr.Initialize(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Rotate 3 times
	var keyIDs []string
	keyIDs = append(keyIDs, mgr.GetSigningKey().ID)
	for i := 0; i < 3; i++ {
		_ = mgr.Rotate(context.Background(), "t1")
		keyIDs = append(keyIDs, mgr.GetSigningKey().ID)
	}

	// All key IDs should be unique
	seen := make(map[string]bool)
	for _, id := range keyIDs {
		if seen[id] {
			t.Errorf("duplicate key ID: %s", id)
		}
		seen[id] = true
	}
}

func TestKeyRotationManager_CleanupOldKeys(t *testing.T) {
	store := newMockKeyStore()
	mgr := NewKeyRotationManager(store, KeyRotationConfig{
		GracePeriod:    1 * time.Millisecond,
		MaxKeyHistory:  2,
	})

	err := mgr.Initialize(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Rotate several times to create old keys
	for i := 0; i < 5; i++ {
		_ = mgr.Rotate(context.Background(), "t1")
		time.Sleep(2 * time.Millisecond) // let grace period expire
	}

	// Cleanup
	err = mgr.CleanupOldKeys(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Should have at most MaxKeyHistory + active + previous = 4 keys
	keys, _ := store.ListKeys(context.Background(), "t1")
	if len(keys) > 4 {
		t.Errorf("expected at most 4 keys after cleanup, got %d", len(keys))
	}
}

func TestSigningKey_Fields(t *testing.T) {
	key := &SigningKey{
		ID:             "key-1",
		TenantID:       "t1",
		Algorithm:      "RS256",
		PublicKeyPEM:   "pub",
		PrivateKeyPEM:  "priv",
		IsActive:       true,
		ActivatedAt:    time.Now(),
		ExpiresAt:      time.Now().Add(24 * time.Hour),
		CreatedAt:      time.Now(),
	}

	if key.ID != "key-1" {
		t.Errorf("expected ID=key-1, got %s", key.ID)
	}
	if key.Algorithm != "RS256" {
		t.Errorf("expected algorithm=RS256, got %s", key.Algorithm)
	}
	if !key.IsActive {
		t.Error("expected IsActive=true")
	}
}

func TestVaultClient_InterfaceCompliance(t *testing.T) {
	// Verify that a nil VaultClient satisfies the interface at compile time
	var _ VaultClient = (*nilVaultClient)(nil)
}

type nilVaultClient struct{}

func (c *nilVaultClient) GenerateKey(ctx context.Context, name string) (string, error) {
	return "", nil
}
func (c *nilVaultClient) Sign(ctx context.Context, keyName string, data []byte) (string, error) {
	return "", nil
}
func (c *nilVaultClient) Verify(ctx context.Context, keyName string, data []byte, signature string) (bool, error) {
	return false, nil
}
func (c *nilVaultClient) GetPublicKey(ctx context.Context, keyName string) (string, error) {
	return "", nil
}
func (c *nilVaultClient) RotateKey(ctx context.Context, name string) error { return nil }

func TestKeyRotationManager_GetKeyByID(t *testing.T) {
	store := newMockKeyStore()
	mgr := NewKeyRotationManager(store, KeyRotationConfig{})

	_ = mgr.Initialize(context.Background(), "t1")
	activeKey := mgr.GetSigningKey()

	// Should find active key by ID
	found, err := mgr.GetKeyByID(context.Background(), activeKey.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if found.ID != activeKey.ID {
		t.Errorf("expected key ID=%s, got %s", activeKey.ID, found.ID)
	}
}

func TestKeyRotationManager_GetKeyByID_NotFound(t *testing.T) {
	store := newMockKeyStore()
	mgr := NewKeyRotationManager(store, KeyRotationConfig{})

	_ = mgr.Initialize(context.Background(), "t1")

	_, err := mgr.GetKeyByID(context.Background(), "nonexistent-key")
	if err == nil {
		t.Error("expected error for nonexistent key")
	}
}

func TestKeyRotationManager_Rotate_VerifyKeyPair(t *testing.T) {
	store := newMockKeyStore()
	mgr := NewKeyRotationManager(store, KeyRotationConfig{
		GracePeriod: 1 * time.Hour,
	})

	_ = mgr.Initialize(context.Background(), "t1")

	// Verify we can sign and verify with current key
	privKey := mgr.GetPrivateKey()
	pubKey := mgr.GetPublicKey()

	if privKey == nil || pubKey == nil {
		t.Fatal("expected non-nil keys")
	}

	// Simple sign/verify roundtrip using RSA
	msg := []byte("test message")
	signature, err := rsa.SignPKCS1v15(nil, privKey, 0, msg)
	if err != nil {
		t.Fatalf("sign error: %v", err)
	}

	err = rsa.VerifyPKCS1v15(pubKey, 0, msg, signature)
	if err != nil {
		t.Fatalf("verify error: %v", err)
	}

	// After rotation, new key should have different public key
	_ = mgr.Rotate(context.Background(), "t1")
	newPubKey := mgr.GetPublicKey()
	if newPubKey.N.Cmp(pubKey.N) == 0 {
		t.Error("new public key should be different after rotation")
	}

	// Old signature should NOT verify with new key
	err = rsa.VerifyPKCS1v15(newPubKey, 0, msg, signature)
	if err == nil {
		t.Error("old signature should not verify with new key")
	}
}
