package fieldencryption

import (
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

// EncryptValue encrypts a value using AES-256-GCM with the provided key.
func EncryptValue(value string, key []byte) (string, error) {
	if value == "" {
		return "", nil
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, aesgcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	ciphertext := aesgcm.Seal(nonce, nonce, []byte(value), []byte("orion-encryption"))
	return encryptedPrefix + base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptValue decrypts a value using AES-256-GCM with the provided key.
func DecryptValue(value string, key []byte) (string, error) {
	if !IsEncrypted(value) {
		return "", nil
	}
	encoded := value[len(encryptedPrefix):]
	combined, err := base64.StdEncoding.DecodeString(encoded)
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
	nonceSize := aesgcm.NonceSize()
	if len(combined) < nonceSize {
		return "", errors.New("invalid encrypted data")
	}
	plaintext, err := aesgcm.Open(nil, combined[:nonceSize], combined[nonceSize:], []byte("orion-encryption"))
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

// EncryptWithGlobalEncrypt encrypts a value using the global key (convenience alias used by handlers).
func EncryptWithGlobalEncrypt(value string) (string, error) {
	return Encrypt(value)
}

// Encrypt is a package-level convenience function that encrypts a value using the global key.
func Encrypt(value string) (string, error) {
	return EncryptValue(value, getGlobalKey())
}

// Decrypt is a package-level convenience function that decrypts a value using the global key.
func Decrypt(value string) (string, error) {
	return DecryptValue(value, getGlobalKey())
}
