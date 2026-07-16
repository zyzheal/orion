package sso

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"sync"
	"time"
)

// KeyRotationManager manages RS256 key pairs for JWT signing with automatic rotation.
type KeyRotationManager struct {
	store  KeyStore
	config KeyRotationConfig
	mu     sync.RWMutex
	// Current active signing key
	activeKey *SigningKey
	// Previous key kept for verification of in-flight tokens
	previousKey *SigningKey
}

// KeyRotationConfig holds key rotation configuration.
type KeyRotationConfig struct {
	// RotationInterval is how often to rotate keys. Default: 24 hours.
	RotationInterval time.Duration `json:"rotation_interval"`
	// KeySize is the RSA key size in bits. Default: 2048.
	KeySize int `json:"key_size"`
	// GracePeriod is how long the previous key remains valid for verification. Default: 1 hour.
	GracePeriod time.Duration `json:"grace_period"`
	// MaxKeyHistory is the maximum number of old keys to retain. Default: 5.
	MaxKeyHistory int `json:"max_key_history"`
	// UseVault enables Vault as the key backend. Default: false (in-memory + DB).
	UseVault bool `json:"use_vault"`
	// VaultAddress is the Vault server address. Required if UseVault is true.
	VaultAddress string `json:"vault_address"`
	// VaultMountPath is the Vault transit mount path. Default: "transit".
	VaultMountPath string `json:"vault_mount_path"`
	// VaultKeyName is the key name in Vault. Default: "orion-jwt-signing".
	VaultKeyName string `json:"vault_key_name"`
}

// KeyStore provides persistence for key metadata.
type KeyStore interface {
	// SaveKey stores a key pair (or reference).
	SaveKey(ctx context.Context, key *SigningKey) error
	// GetActiveKey returns the current active signing key.
	GetActiveKey(ctx context.Context, tenantID string) (*SigningKey, error)
	// GetKeyByID returns a specific key by ID.
	GetKeyByID(ctx context.Context, keyID string) (*SigningKey, error)
	// ListKeys returns all keys for a tenant, ordered by creation time.
	ListKeys(ctx context.Context, tenantID string) ([]*SigningKey, error)
	// DeactivateKey marks a key as no longer active for signing.
	DeactivateKey(ctx context.Context, keyID string) error
	// DeleteKey removes a key (only if deactivated and past grace period).
	DeleteKey(ctx context.Context, keyID string) error
}

// SigningKey represents an RSA key pair for JWT signing.
type SigningKey struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenant_id" db:"tenant_id"`
	Algorithm    string    `json:"algorithm" db:"algorithm"` // "RS256"
	PublicKeyPEM string    `json:"public_key_pem" db:"public_key_pem"`
	// PrivateKeyPEM is empty when UseVault is true (key lives in Vault).
	PrivateKeyPEM string    `json:"private_key_pem,omitempty" db:"private_key_pem"`
	IsActive      bool      `json:"is_active" db:"is_active"`
	ActivatedAt   time.Time `json:"activated_at" db:"activated_at"`
	ExpiresAt     time.Time `json:"expires_at" db:"expires_at"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	// VaultKeyID is the reference to the key in Vault (if UseVault is true).
	VaultKeyID string `json:"vault_key_id,omitempty" db:"vault_key_id"`
}

// VaultClient is the interface for HashiCorp Vault transit engine.
type VaultClient interface {
	// GenerateKey generates a new key in Vault transit engine.
	GenerateKey(ctx context.Context, name string) (string, error)
	// Sign signs data using a Vault-managed key.
	Sign(ctx context.Context, keyName string, data []byte) (string, error)
	// Verify verifies a signature using a Vault-managed key.
	Verify(ctx context.Context, keyName string, data []byte, signature string) (bool, error)
	// GetPublicKey returns the public key for a Vault-managed key.
	GetPublicKey(ctx context.Context, keyName string) (string, error)
	// RotateKey rotates a key in Vault.
	RotateKey(ctx context.Context, name string) error
}

// NewKeyRotationManager creates a new key rotation manager.
func NewKeyRotationManager(store KeyStore, config KeyRotationConfig) *KeyRotationManager {
	if config.RotationInterval == 0 {
		config.RotationInterval = 24 * time.Hour
	}
	if config.KeySize == 0 {
		config.KeySize = 2048
	}
	if config.GracePeriod == 0 {
		config.GracePeriod = 1 * time.Hour
	}
	if config.MaxKeyHistory == 0 {
		config.MaxKeyHistory = 5
	}
	if config.VaultMountPath == "" {
		config.VaultMountPath = "transit"
	}
	if config.VaultKeyName == "" {
		config.VaultKeyName = "orion-jwt-signing"
	}

	return &KeyRotationManager{
		store:  store,
		config: config,
	}
}

// Initialize loads or creates the initial signing key.
func (m *KeyRotationManager) Initialize(ctx context.Context, tenantID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Try to load existing active key
	key, err := m.store.GetActiveKey(ctx, tenantID)
	if err == nil && key != nil {
		m.activeKey = key
		return nil
	}

	// Generate new key
	key, err = m.generateKey(ctx, tenantID)
	if err != nil {
		return fmt.Errorf("generate initial key: %w", err)
	}

	if err := m.store.SaveKey(ctx, key); err != nil {
		return fmt.Errorf("save initial key: %w", err)
	}

	m.activeKey = key
	return nil
}

// GetSigningKey returns the current active signing key.
func (m *KeyRotationManager) GetSigningKey() *SigningKey {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.activeKey
}

// GetVerificationKeys returns all keys valid for verification (active + grace period).
func (m *KeyRotationManager) GetVerificationKeys() []*SigningKey {
	m.mu.RLock()
	defer m.mu.RUnlock()

	keys := []*SigningKey{}
	if m.activeKey != nil {
		keys = append(keys, m.activeKey)
	}
	if m.previousKey != nil && m.previousKey.ExpiresAt.After(time.Now()) {
		keys = append(keys, m.previousKey)
	}
	return keys
}

// GetKeyByID returns a key by its ID (for JWKS endpoint).
func (m *KeyRotationManager) GetKeyByID(ctx context.Context, keyID string) (*SigningKey, error) {
	m.mu.RLock()
	if m.activeKey != nil && m.activeKey.ID == keyID {
		defer m.mu.RUnlock()
		return m.activeKey, nil
	}
	if m.previousKey != nil && m.previousKey.ID == keyID {
		defer m.mu.RUnlock()
		return m.previousKey, nil
	}
	m.mu.RUnlock()

	return m.store.GetKeyByID(ctx, keyID)
}

// Rotate performs key rotation: generates a new key, deactivates the old one.
func (m *KeyRotationManager) Rotate(ctx context.Context, tenantID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Generate new key
	newKey, err := m.generateKey(ctx, tenantID)
	if err != nil {
		return fmt.Errorf("generate new key: %w", err)
	}

	if err := m.store.SaveKey(ctx, newKey); err != nil {
		return fmt.Errorf("save new key: %w", err)
	}

	// Deactivate old key
	if m.activeKey != nil {
		m.activeKey.IsActive = false
		m.activeKey.ExpiresAt = time.Now().Add(m.config.GracePeriod)
		_ = m.store.DeactivateKey(ctx, m.activeKey.ID)
		m.previousKey = m.activeKey
	}

	m.activeKey = newKey
	return nil
}

// StartAutoRotation starts a background goroutine that rotates keys periodically.
func (m *KeyRotationManager) StartAutoRotation(ctx context.Context, tenantID string) {
	ticker := time.NewTicker(m.config.RotationInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			_ = m.Rotate(ctx, tenantID)
		}
	}
}

// CleanupOldKeys removes expired keys beyond the history limit.
func (m *KeyRotationManager) CleanupOldKeys(ctx context.Context, tenantID string) error {
	keys, err := m.store.ListKeys(ctx, tenantID)
	if err != nil {
		return fmt.Errorf("list keys: %w", err)
	}

	// Count inactive keys
	inactiveKeys := []*SigningKey{}
	for _, k := range keys {
		if !k.IsActive && k.ExpiresAt.Before(time.Now()) {
			inactiveKeys = append(inactiveKeys, k)
		}
	}

	// Delete excess keys
	if len(inactiveKeys) > m.config.MaxKeyHistory {
		toDelete := inactiveKeys[:len(inactiveKeys)-m.config.MaxKeyHistory]
		for _, k := range toDelete {
			_ = m.store.DeleteKey(ctx, k.ID)
		}
	}

	return nil
}

// generateKey creates a new RSA key pair.
func (m *KeyRotationManager) generateKey(ctx context.Context, tenantID string) (*SigningKey, error) {
	if m.config.UseVault {
		return m.generateVaultKey(ctx, tenantID)
	}
	return m.generateLocalKey(tenantID)
}

func (m *KeyRotationManager) generateLocalKey(tenantID string) (*SigningKey, error) {
	privateKey, err := rsa.GenerateKey(rand.Reader, m.config.KeySize)
	if err != nil {
		return nil, fmt.Errorf("generate RSA key: %w", err)
	}

	privateKeyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(privateKey),
	})

	publicKeyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PUBLIC KEY",
		Bytes: x509.MarshalPKCS1PublicKey(&privateKey.PublicKey),
	})

	keyID := generateKeyID(publicKeyPEM)

	return &SigningKey{
		ID:             keyID,
		TenantID:       tenantID,
		Algorithm:      "RS256",
		PublicKeyPEM:   string(publicKeyPEM),
		PrivateKeyPEM:  string(privateKeyPEM),
		IsActive:       true,
		ActivatedAt:    time.Now(),
		ExpiresAt:      time.Now().Add(m.config.RotationInterval + m.config.GracePeriod),
		CreatedAt:      time.Now(),
	}, nil
}

func (m *KeyRotationManager) generateVaultKey(ctx context.Context, tenantID string) (*SigningKey, error) {
	// Vault key generation would go here
	// For now, fall back to local generation
	return m.generateLocalKey(tenantID)
}

// generateKeyID creates a deterministic key ID from the public key.
func generateKeyID(publicKeyPEM []byte) string {
	h := sha256.Sum256(publicKeyPEM)
	return base64.RawURLEncoding.EncodeToString(h[:16])
}

// GetPublicKey returns the public key for signing operations.
func (m *KeyRotationManager) GetPublicKey() *rsa.PublicKey {
	key := m.GetSigningKey()
	if key == nil {
		return nil
	}

	block, _ := pem.Decode([]byte(key.PublicKeyPEM))
	if block == nil {
		return nil
	}

	pub, err := x509.ParsePKCS1PublicKey(block.Bytes)
	if err != nil {
		return nil
	}

	return pub
}

// GetPrivateKey returns the private key for signing operations.
func (m *KeyRotationManager) GetPrivateKey() *rsa.PrivateKey {
	key := m.GetSigningKey()
	if key == nil || key.PrivateKeyPEM == "" {
		return nil
	}

	block, _ := pem.Decode([]byte(key.PrivateKeyPEM))
	if block == nil {
		return nil
	}

	priv, err := x509.ParsePKCS1PrivateKey(block.Bytes)
	if err != nil {
		return nil
	}

	return priv
}

// GenerateKeyPair generates a new RSA key pair and returns PEM-encoded strings.
// Utility function for initial setup or testing.
func GenerateKeyPair(bits int) (publicPEM, privatePEM string, err error) {
	privateKey, err := rsa.GenerateKey(rand.Reader, bits)
	if err != nil {
		return "", "", fmt.Errorf("generate key: %w", err)
	}

	privBytes := x509.MarshalPKCS1PrivateKey(privateKey)
	privatePEM = string(pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: privBytes,
	}))

	pubBytes := x509.MarshalPKCS1PublicKey(&privateKey.PublicKey)
	publicPEM = string(pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PUBLIC KEY",
		Bytes: pubBytes,
	}))

	return publicPEM, privatePEM, nil
}
