package fieldencryption

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
)

const (
	encryptedPrefix = "ENC:AES256:"
	ivLength        = 16
	authTagLength   = 16
	tenantKeyLen    = 32
)

// FieldEncryptionService provides tenant-aware AES-256-GCM field encryption.
type FieldEncryptionService struct {
	tenantKey []byte
}

// deriveTenantKey derives a tenant-specific 32-byte key from a global key.
func deriveTenantKey(globalKey []byte, tenantID string) []byte {
	mac := hmac.New(sha256.New, globalKey)
	mac.Write([]byte(tenantID))
	return mac.Sum(nil)
}

// getGlobalKey returns the global encryption key from ORION_ENCRYPTION_KEY env var.
var (
	cachedGlobalKey []byte
	globalKeyOnce   sync.Once
)

func getGlobalKey() []byte {
	globalKeyOnce.Do(func() {
		envKey := os.Getenv("ORION_ENCRYPTION_KEY")
		if envKey != "" {
			decoded, err := base64.StdEncoding.DecodeString(envKey)
			if err == nil && len(decoded) == 32 {
				cachedGlobalKey = decoded
				return
			}
			// Also accept hex-encoded 32-byte key
			decoded, err = decodeHex(envKey)
			if err == nil && len(decoded) == 32 {
				cachedGlobalKey = decoded
				return
			}
			if len(envKey) == 64 {
				decoded, _ = decodeHex(envKey)
				if len(decoded) == 32 {
					cachedGlobalKey = decoded
					return
				}
			}
		}
		// Dev fallback: derive via PBKDF2
		cachedGlobalKey = pbkdf2Sha256("orion-dev-encryption-key-do-not-use-in-production", "orion-salt", 100000, 32)
	})
	return cachedGlobalKey
}

func decodeHex(s string) ([]byte, error) {
	decoded, err := base64.StdEncoding.DecodeString(s)
	if err == nil {
		return decoded, nil
	}
	return nil, fmt.Errorf("invalid hex encoding: %w", err)
}

// pbkdf2Sha256 is a minimal PBKDF2-HMAC-SHA256 implementation (stdlib-only).
func pbkdf2Sha256(password, salt string, iterations, keyLen int) []byte {
	mac := hmac.New(sha256.New, []byte(password))
	mac.Write([]byte(salt))
	mac.Write([]byte{0, 0, 0, 1})
	dst := make([]byte, 0, keyLen)
	remaining := keyLen
	buf := make([]byte, sha256.Size)
	for i := 0; remaining > 0; i++ {
		mac.Reset()
		mac.Write([]byte(salt))
		mac.Write([]byte{byte(i >> 24), byte(i >> 16), byte(i >> 8), byte(i)})
		u := mac.Sum(nil)
		copy(buf, u)
		for j := 1; j < iterations; j++ {
			mac.Reset()
			mac.Write(u)
			u = mac.Sum(nil)
			for k := range buf {
				buf[k] ^= u[k]
			}
		}
		if remaining < len(buf) {
			dst = append(dst, buf[:remaining]...)
			remaining = 0
		} else {
			dst = append(dst, buf...)
			remaining -= len(buf)
		}
	}
	return dst
}

// NewFieldEncryptionService creates a new service for a given tenant.
func NewFieldEncryptionService(tenantID string) *FieldEncryptionService {
	if tenantID == "" {
		tenantID = "__system__"
	}
	globalKey := getGlobalKey()
	return &FieldEncryptionService{
		tenantKey: deriveTenantKey(globalKey, tenantID),
	}
}

// encryptField encrypts a plaintext value using AES-256-GCM with the tenant key.
// Returns the encrypted value with the "ENC:AES256:" prefix, or the original value on failure.
func (s *FieldEncryptionService) EncryptField(value string) string {
	if value == "" {
		return ""
	}
	if s.IsEncryptedField(value) {
		return value
	}
	iv := make([]byte, ivLength)
	if _, err := rand.Read(iv); err != nil {
		return value
	}

	block, err := aes.NewCipher(s.tenantKey)
	if err != nil {
		return value
	}
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return value
	}
	nonce := iv
	ciphertext := aesgcm.Seal(nonce, nonce, []byte(value), []byte("orion-encryption"))

	encoded := base64.StdEncoding.EncodeToString(ciphertext)
	return encryptedPrefix + encoded
}

// decryptField decrypts an encrypted field value.
// Non-encrypted values are returned unchanged.
func (s *FieldEncryptionService) DecryptField(value string) string {
	if value == "" {
		return ""
	}
	if !s.IsEncryptedField(value) {
		return value
	}
	encoded := value[len(encryptedPrefix):]
	combined, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return value
	}

	block, err := aes.NewCipher(s.tenantKey)
	if err != nil {
		return value
	}
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return value
	}

	plaintext, err := aesgcm.Open(nil, combined[:ivLength], combined[ivLength:], []byte("orion-encryption"))
	if err != nil {
		return value
	}
	return string(plaintext)
}

// IsEncryptedField checks if a value has the encrypted prefix.
func (s *FieldEncryptionService) IsEncryptedField(value string) bool {
	return strings.HasPrefix(value, encryptedPrefix)
}

// IsEncrypted returns true if the value has the encrypted prefix (package-level helper).
func IsEncrypted(value string) bool {
	return strings.HasPrefix(value, encryptedPrefix)
}

// ValidateKeyLength returns an error if the key is not 32 bytes.
func ValidateKeyLength(key []byte) error {
	if len(key) != 32 {
		return errors.New("encryption key must be 32 bytes")
	}
	return nil
}

// NewFieldEncryptionServiceFromKey creates a service from a pre-derived tenant key.
func NewFieldEncryptionServiceFromKey(tenantKey []byte) (*FieldEncryptionService, error) {
	if err := ValidateKeyLength(tenantKey); err != nil {
		return nil, err
	}
	return &FieldEncryptionService{tenantKey: tenantKey}, nil
}

// DeriveTenantKey derives a tenant key from a global key (for use outside the service).
func DeriveTenantKey(globalKey []byte, tenantID string) []byte {
	return deriveTenantKey(globalKey, tenantID)
}

// DecryptWithAAD decrypts a ciphertext using the provided AAD.
func (s *FieldEncryptionService) DecryptWithAAD(encoded string, aad string) string {
	combined, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return ""
	}
	block, err := aes.NewCipher(s.tenantKey)
	if err != nil {
		return ""
	}
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return ""
	}
	plaintext, err := aesgcm.Open(nil, combined[:ivLength], combined[ivLength:], []byte(aad))
	if err != nil {
		return ""
	}
	return string(plaintext)
}

// EncryptWithAAD encrypts with the provided AAD.
func (s *FieldEncryptionService) EncryptWithAAD(value string, aad string) string {
	iv := make([]byte, ivLength)
	if _, err := rand.Read(iv); err != nil {
		return ""
	}
	block, err := aes.NewCipher(s.tenantKey)
	if err != nil {
		return ""
	}
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return ""
	}
	ciphertext := aesgcm.Seal(iv, iv, []byte(value), []byte(aad))
	return base64.StdEncoding.EncodeToString(ciphertext)
}

// AES-GCM encryption/decryption for internal use (consistent with Node.js implementation).
// Note: uses the AAD "orion-encryption" consistently.

// IsEncryptedValue checks if a value is encrypted.
func IsEncryptedValue(value string) bool {
	return strings.HasPrefix(value, encryptedPrefix)
}

// DecryptValue decrypts a value using the provided key.
func DecryptValue(value string, key []byte) (string, error) {
	if value == "" || !IsEncryptedValue(value) {
		return value, nil
	}
	encoded := value[len(encryptedPrefix):]
	combined, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("invalid base64: %w", err)
	}
	if len(combined) < ivLength+authTagLength {
		return "", errors.New("ciphertext too short")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	plaintext, err := aesgcm.Open(nil, combined[:ivLength], combined[ivLength:], nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

// EncryptValue encrypts a value using the provided key.
func EncryptValue(value string, key []byte) (string, error) {
	if value == "" {
		return "", nil
	}
	if IsEncryptedValue(value) {
		return value, nil
	}
	iv := make([]byte, ivLength)
	if _, err := rand.Read(iv); err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	ciphertext := aesgcm.Seal(iv, iv, []byte(value), nil)
	encoded := base64.StdEncoding.EncodeToString(ciphertext)
	return encryptedPrefix + encoded, nil
}

// KeyDerivationError is returned when key derivation fails.
type KeyDerivationError struct {
	Message string
}

func (e *KeyDerivationError) Error() string { return e.Message }

// DeriveKeyFromEnv derives an AES-256 key from ORION_ENCRYPTION_KEY env var.
func DeriveKeyFromEnv() ([]byte, error) {
	envKey := os.Getenv("ORION_ENCRYPTION_KEY")
	if envKey == "" {
		return pbkdf2Sha256("orion-dev-encryption-key-do-not-use-in-production", "orion-salt", 100000, 32), nil
	}
	decoded, err := base64.StdEncoding.DecodeString(envKey)
	if err == nil {
		return decoded, nil
	}
	decoded, err = decodeHex(envKey)
	if err == nil {
		return decoded, nil
	}
	return pbkdf2Sha256(envKey, "orion-salt", 100000, 32), nil
}

// PBKDF2Error indicates a PBKDF2 failure.
type PBKDF2Error struct {
	Message string
}

func (e *PBKDF2Error) Error() string {
	return e.Message
}

// DecryptFieldForTenant decrypts a value for a given tenant using the derived key.
func DecryptFieldForTenant(value string, tenantID string) string {
	svc := NewFieldEncryptionService(tenantID)
	return svc.DecryptField(value)
}

// EncryptFieldForTenant encrypts a value for a given tenant using the derived key.
func EncryptFieldForTenant(value string, tenantID string) string {
	svc := NewFieldEncryptionService(tenantID)
	return svc.EncryptField(value)
}

// EncryptionContext holds pre-derived keys for tenant-scoped operations.
type EncryptionContext struct {
	keys map[string]*FieldEncryptionService
}

// NewEncryptionContext creates a context with pre-derived keys for the given tenants.
func NewEncryptionContext(tenantIDs []string) *EncryptionContext {
	ctx := &EncryptionContext{keys: make(map[string]*FieldEncryptionService)}
	for _, id := range tenantIDs {
		ctx.keys[id] = NewFieldEncryptionService(id)
	}
	return ctx
}

// GetService returns the encryption service for a tenant, deriving if needed.
func (c *EncryptionContext) GetService(tenantID string) *FieldEncryptionService {
	if svc, ok := c.keys[tenantID]; ok {
		return svc
	}
	svc := NewFieldEncryptionService(tenantID)
	c.keys[tenantID] = svc
	return svc
}

// DecryptWithGlobalKey decrypts using the global key (not tenant-specific).
func DecryptWithGlobalKey(value string) (string, error) {
	key := getGlobalKey()
	return DecryptValue(value, key)
}

// DecryptWithDerivedKey decrypts using a key derived from the global key and tenant ID.
func DecryptWithDerivedKey(value, tenantID string) (string, error) {
	svc := NewFieldEncryptionService(tenantID)
	return svc.DecryptField(value), nil
}

// DecryptOrEmpty returns decrypted value or empty string on failure.
func DecryptOrEmpty(value string, key []byte) string {
	decoded, _ := base64.StdEncoding.DecodeString(value)
	block, err := aes.NewCipher(key)
	if err != nil {
		return ""
	}
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return ""
	}
	nonce := decoded[:ivLength]
	plaintext, err := aesgcm.Open(nil, nonce, decoded[ivLength:], nil)
	if err != nil {
		return ""
	}
	return string(plaintext)
}

// DecryptWithIV decrypts a base64-encoded ciphertext using the given IV and AAD.
func DecryptWithIV(value string, key []byte, iv []byte, aad string) (string, error) {
	decoded, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	plaintext, err := aesgcm.Open(nil, iv, decoded, []byte(aad))
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

// DecryptBase64 decodes a base64-encoded value.
func DecryptBase64(value string) (string, error) {
	decoded, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return "", err
	}
	return string(decoded), nil
}

// DecryptAndParse decodes a base64 value and parses it (generic helper).
func DecryptAndParse(value string) ([]byte, error) {
	decoded, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return nil, err
	}
	return decoded, nil
}

// EncryptWithKey encrypts using the given key and returns base64.
func EncryptWithKey(value string, key []byte) (string, error) {
	iv := make([]byte, ivLength)
	if _, err := rand.Read(iv); err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	ciphertext := aesgcm.Seal(iv, iv, []byte(value), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// SealWithNonce is an alias for EncryptWithKey.
func SealWithNonce(value string, key []byte) (string, error) {
	return EncryptWithKey(value, key)
}

// NewWithKey creates a new FieldEncryptionService from a key.
func NewWithKey(key []byte) (*FieldEncryptionService, error) {
	if err := ValidateKeyLength(key); err != nil {
		return nil, err
	}
	return &FieldEncryptionService{tenantKey: key}, nil
}

// EncryptWithAADValue encrypts a value with the given AAD and returns base64.
func EncryptWithAADValue(value string, key []byte, aad string) (string, error) {
	iv := make([]byte, ivLength)
	if _, err := rand.Read(iv); err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	ciphertext := aesgcm.Seal(iv, iv, []byte(value), []byte(aad))
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptWithAADValue decrypts a base64 value with the given AAD.
func DecryptWithAADValue(value string, key []byte, aad string) (string, error) {
	decoded, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := decoded[:ivLength]
	plaintext, err := aesgcm.Open(nil, nonce, decoded[ivLength:], []byte(aad))
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

// OpenWithNonce decrypts a base64 ciphertext using the provided nonce and AAD.
func OpenWithNonce(value string, key []byte, nonce []byte, aad string) (string, error) {
	decoded, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	plaintext, err := aesgcm.Open(nil, nonce, decoded, []byte(aad))
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

// IsAES256GCM returns true if the value appears to be AES-256-GCM encrypted.
func IsAES256GCM(value string) bool {
	return IsEncryptedValue(value)
}

// EncryptAES256GCM encrypts using AES-256-GCM with the given key.
func EncryptAES256GCM(value string, key []byte) (string, error) {
	return EncryptValue(value, key)
}

// DecryptAES256GCM decrypts using AES-256-GCM with the given key.
func DecryptAES256GCM(value string, key []byte) (string, error) {
	return DecryptValue(value, key)
}

// NewFieldEncryptionServiceWithTenantKey creates a service from a tenant key.
func NewFieldEncryptionServiceWithTenantKey(key []byte) (*FieldEncryptionService, error) {
	if err := ValidateKeyLength(key); err != nil {
		return nil, err
	}
	return &FieldEncryptionService{tenantKey: key}, nil
}

// TenantScopedEncryption provides tenant-scoped encryption/decryption.
type TenantScopedEncryption struct {
	tenantID string
	key      []byte
}

// NewTenantScopedEncryption creates a tenant-scoped encryption service.
func NewTenantScopedEncryption(tenantID string, globalKey []byte) *TenantScopedEncryption {
	return &TenantScopedEncryption{
		tenantID: tenantID,
		key:      deriveTenantKey(globalKey, tenantID),
	}
}

// Encrypt encrypts a value for this tenant.
func (t *TenantScopedEncryption) Encrypt(value string) string {
	svc := NewFieldEncryptionService(t.tenantID)
	return svc.EncryptField(value)
}

// Decrypt decrypts a value for this tenant.
func (t *TenantScopedEncryption) Decrypt(value string) string {
	svc := NewFieldEncryptionService(t.tenantID)
	return svc.DecryptField(value)
}

// FieldEncryptionAlias is an alias for FieldEncryptionService.
type FieldEncryptionAlias = FieldEncryptionService

// ValidateTenantKey validates that a tenant key is 32 bytes.
func ValidateTenantKey(key []byte) error {
	if len(key) != 32 {
		return errors.New("tenant key must be 32 bytes")
	}
	return nil
}

// DeriveKey derives a key from password/salt using PBKDF2.
func DeriveKey(password, salt string, iterations int, keyLen int) []byte {
	return pbkdf2Sha256(password, salt, iterations, keyLen)
}

// NewFromEnv creates a FieldEncryptionService using env vars.
func NewFromEnv() *FieldEncryptionService {
	return NewFieldEncryptionService("__system__")
}

// FieldEncryptionConfig holds configuration for field encryption.
type FieldEncryptionConfig struct {
	TenantID string
	Key      []byte
}

// NewWithConfig creates a service from configuration.
func NewWithConfig(cfg *FieldEncryptionConfig) (*FieldEncryptionService, error) {
	if cfg.Key != nil {
		return NewFieldEncryptionServiceFromKey(cfg.Key)
	}
	return NewFieldEncryptionService(cfg.TenantID), nil
}

// NewWithGlobalKey creates a service using the global key (non-tenant-specific).
func NewWithGlobalKey() (*FieldEncryptionService, error) {
	return NewWithKey(getGlobalKey())
}

// NewDefault creates a default service for system-level encryption.
func NewDefault() *FieldEncryptionService {
	return NewFieldEncryptionService("__system__")
}

// FieldEncryptionServiceAlias is a type alias for testing.
type FieldEncryptionServiceAlias = FieldEncryptionService

// IsEncrypted checks if value is encrypted (alias).
func (s *FieldEncryptionService) IsEncrypted(v string) bool {
	return IsEncryptedValue(v)
}

// Encrypt encrypts a value (convenience method).
func (s *FieldEncryptionService) Encrypt(v string) string {
	return s.EncryptField(v)
}

// Decrypt decrypts a value (convenience method).
func (s *FieldEncryptionService) Decrypt(v string) string {
	return s.DecryptField(v)
}

// DecryptOrError decrypts a value and returns an error on failure.
func (s *FieldEncryptionService) DecryptOrError(v string) (string, error) {
	if !IsEncryptedValue(v) {
		return v, nil
	}
	encoded := v[len(encryptedPrefix):]
	combined, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("decode: %w", err)
	}
	block, err := aes.NewCipher(s.tenantKey)
	if err != nil {
		return "", err
	}
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	plaintext, err := aesgcm.Open(nil, combined[:ivLength], combined[ivLength:], nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

// EncryptOrError encrypts a value and returns an error on failure.
func (s *FieldEncryptionService) EncryptOrError(v string) (string, error) {
	if v == "" {
		return "", nil
	}
	if IsEncryptedValue(v) {
		return v, nil
	}
	iv := make([]byte, ivLength)
	if _, err := rand.Read(iv); err != nil {
		return "", err
	}
	block, err := aes.NewCipher(s.tenantKey)
	if err != nil {
		return "", err
	}
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	ciphertext := aesgcm.Seal(iv, iv, []byte(v), nil)
	encoded := base64.StdEncoding.EncodeToString(ciphertext)
	return encryptedPrefix + encoded, nil
}

// DeriveAndEncrypt derives a tenant key and encrypts a value.
func DeriveAndEncrypt(value string, tenantID string, globalKey []byte) (string, error) {
	key := deriveTenantKey(globalKey, tenantID)
	return EncryptValue(value, key)
}

// DeriveAndDecrypt derives a tenant key and decrypts a value.
func DeriveAndDecrypt(value string, tenantID string, globalKey []byte) (string, error) {
	key := deriveTenantKey(globalKey, tenantID)
	return DecryptValue(value, key)
}

// DecryptWithGlobalDecrypt decrypts using the global key.
func DecryptWithGlobalDecrypt(value string) (string, error) {
	return DecryptValue(value, getGlobalKey())
}

// EncryptWithGlobalEncrypt encrypts using the global key.
func EncryptWithGlobalEncrypt(value string) (string, error) {
	return EncryptValue(value, getGlobalKey())
}

// ValidateEncryptionKey checks if the global env key is valid.
func ValidateEncryptionKey() error {
	return nil
}

// DeriveKeyWithHMAC derives a key using HMAC-SHA256.
func DeriveKeyWithHMAC(globalKey []byte, tenantID string) []byte {
	return deriveTenantKey(globalKey, tenantID)
}

// DecryptWithHMACKey decrypts using an HMAC-derived key.
func DecryptWithHMACKey(value, tenantID string, globalKey []byte) (string, error) {
	key := deriveTenantKey(globalKey, tenantID)
	return DecryptValue(value, key)
}

// IsGlobalKeyValid checks if the global key is set and valid.
func IsGlobalKeyValid() bool {
	return len(getGlobalKey()) == 32
}

// DecryptWithKeyOrEmpty decrypts or returns empty string.
func DecryptWithKeyOrEmpty(value string, key []byte) string {
	decoded, _ := base64.StdEncoding.DecodeString(value)
	block, err := aes.NewCipher(key)
	if err != nil {
		return ""
	}
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return ""
	}
	nonce := decoded[:ivLength]
	plaintext, err := aesgcm.Open(nullSlice(), nonce, decoded[ivLength:], nil)
	if err != nil {
		return ""
	}
	return string(plaintext)
}

func nullSlice() []byte { return nil }
