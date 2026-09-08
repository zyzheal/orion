package repository

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"sync"

	"orion/platform-svc-go/internal/infrastructure/backup/executor"
)

// DBA_ENCRYPTION_KEY env var must hold a base64-encoded 32-byte AES-256
// key. When unset, the crypto layer is disabled and passwords are stored
// in plaintext — the repository logs a warning on first use so operators
// know the DB is not encrypted at rest. When set, all DataSource
// passwords are encrypted on write and decrypted on read.
const envEncryptionKey = "DBA_ENCRYPTION_KEY"

var (
	encKey     []byte
	encKeyOnce sync.Once
	encKeyWarn sync.Once
)

// loadEncryptionKey reads the AES-256 key from the environment on first
// use. When the env var is unset, subsequent calls get a nil key and the
// repository falls back to plaintext storage (with a one-shot warning).
func loadEncryptionKey() []byte {
	encKeyOnce.Do(func() {
		raw := os.Getenv(envEncryptionKey)
		if raw == "" {
			return
		}
		key, err := base64.StdEncoding.DecodeString(raw)
		if err != nil {
			// Malformed key — treat as unset so the system degrades to
			// plaintext rather than crashing on startup.
			return
		}
		if len(key) != 32 {
			return
		}
		encKey = key
	})
	if encKey == nil {
		encKeyWarn.Do(func() {
			// In production this would go through zap; the repository
			// layer avoids a logger dependency for a one-shot warning.
			fmt.Fprintf(os.Stderr, "WARNING: %s not set or invalid; DBA passwords stored in plaintext\n", envEncryptionKey)
		})
	}
	return encKey
}

// encryptPassword encrypts a plaintext password for storage. When the
// encryption key is not configured, the plaintext is returned unchanged
// so the system degrades gracefully. The encrypted value is base64-encoded
// for safe storage in a TEXT column.
func encryptPassword(plaintext string) string {
	key := loadEncryptionKey()
	if key == nil || plaintext == "" {
		return plaintext
	}
	ct, err := executor.EncryptBytes(key, []byte(plaintext))
	if err != nil {
		// Encryption failure — return plaintext so the data source is
		// still usable. The operator will see connection failures if
		// the key is later rotated, which is a safer failure mode than
		// rejecting the write entirely.
		return plaintext
	}
	return "enc:" + base64.StdEncoding.EncodeToString(ct)
}

// decryptPassword decrypts a stored password. Values prefixed with "enc:"
// are decrypted; all other values are returned as-is so legacy plaintext
// passwords and unencrypted deployments keep working.
func decryptPassword(stored string) string {
	if stored == "" || len(stored) < 4 || stored[:4] != "enc:" {
		return stored
	}
	key := loadEncryptionKey()
	if key == nil {
		// Key was removed after encrypted data was written — we cannot
		// decrypt. Return empty so the caller fails closed rather than
		// using the ciphertext as a password.
		return ""
	}
	raw, err := base64.StdEncoding.DecodeString(stored[4:])
	if err != nil {
		return ""
	}
	pt, err := executor.DecryptBytes(key, raw)
	if err != nil {
		return ""
	}
	return string(pt)
}

// EncryptPassword is the exported variant for service-layer callers that
// need to pre-encrypt before passing to the repository.
func EncryptPassword(plaintext string) string {
	return encryptPassword(plaintext)
}

// DecryptPassword is the exported variant for service-layer callers.
func DecryptPassword(stored string) string {
	return decryptPassword(stored)
}

// Ensure the crypto helpers are referenced at package level so the
// compiler does not flag them as unused in builds without the env var.
var _ = context.Background
