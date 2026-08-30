package executor

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"os"
)

// ErrEmptyKey is returned when an empty or mis-sized key is passed to the
// EncryptFile / DecryptFile helpers. AES-256 requires exactly 32 bytes.
var ErrEmptyKey = errors.New("encryption key must be 32 bytes (AES-256-GCM)")

// EncryptFile reads plaintext from src and writes AES-256-GCM encrypted
// bytes to dst. A random nonce is prepended to the ciphertext so
// DecryptFile can recover the key without any out-of-band state.
//
// The implementation reads the whole plaintext into memory before sealing.
// Backup artifacts are typically in the hundreds-of-MB to low-GB range and
// streaming with GCM has well-known nonce/size limits that make it fragile.
// Phase 2 may swap this for a chunked AEAD scheme if larger artifacts appear.
func EncryptFile(src, dst string, key []byte) error {
	if len(key) != 32 {
		return ErrEmptyKey
	}
	plaintext, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return err
	}
	sealed := gcm.Seal(nonce, nonce, plaintext, nil)
	return os.WriteFile(dst, sealed, 0o600)
}

// DecryptFile reads AES-256-GCM encrypted bytes from src and writes the
// plaintext to dst. Returns an error if authentication fails, which happens
// either when the key is wrong or when the ciphertext has been tampered with.
func DecryptFile(src, dst string, key []byte) error {
	if len(key) != 32 {
		return ErrEmptyKey
	}
	ciphertext, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}
	ns := gcm.NonceSize()
	if len(ciphertext) < ns {
		return errors.New("ciphertext too short for AES-256-GCM")
	}
	nonce, ct := ciphertext[:ns], ciphertext[ns:]
	plaintext, err := gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return fmt.Errorf("decryption failed (wrong key or corrupted file): %w", err)
	}
	return os.WriteFile(dst, plaintext, 0o600)
}

// EncryptBytes and DecryptBytes are the in-memory variants used by
// executors that produce or consume byte slices directly rather than
// files. Kept here so the crypto module has a single source of truth for
// the GCM scheme.
func EncryptBytes(key, plaintext []byte) ([]byte, error) {
	if len(key) != 32 {
		return nil, ErrEmptyKey
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

func DecryptBytes(key, ciphertext []byte) ([]byte, error) {
	if len(key) != 32 {
		return nil, ErrEmptyKey
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	ns := gcm.NonceSize()
	if len(ciphertext) < ns {
		return nil, errors.New("ciphertext too short for AES-256-GCM")
	}
	return gcm.Open(nil, ciphertext[:ns], ciphertext[ns:], nil)
}
