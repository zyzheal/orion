// Package aesgcm holds the single implementation of credential-at-rest
// encryption used by every data source module.
//
// The AES-256-GCM helpers used to live privately inside
// internal/datasource/service. internal/database-devops never got them — its
// DatabaseSource.Password went to the database in plaintext — because copying
// 40 lines into a second package is exactly the divergence that makes "we
// encrypt credentials" true for one module and false for the other. Sharing the
// implementation is what turns ARCH-0.11's "one credential model" from a line in
// a doc into code.
package aesgcm

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
)

// Key derives a 32-byte AES-256 key from a secret. A 64-char hex string is used
// as-is; anything else is SHA-256'd, so an ordinary passphrase works.
//
// An empty secret still yields a valid key (SHA-256 of ""). Callers therefore
// must resolve the key from the environment themselves and refuse to run on a
// development fallback in production — see datasourceKey in cmd/server.
func Key(secret string) []byte {
	if len(secret) == 64 {
		if b, err := hex.DecodeString(secret); err == nil {
			return b
		}
	}
	h := sha256.Sum256([]byte(secret))
	return h[:]
}

// Encrypt seals plaintext with AES-256-GCM and returns hex. The nonce is
// prepended to the ciphertext, so Decrypt needs no separate nonce argument.
func Encrypt(key []byte, plaintext string) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return hex.EncodeToString(ciphertext), nil
}

// Decrypt reverses Encrypt. A wrong key or a tampered ciphertext fails the
// GCM authentication tag rather than returning garbage.
func Decrypt(key []byte, ciphertext string) (string, error) {
	raw, err := hex.DecodeString(ciphertext)
	if err != nil {
		return "", fmt.Errorf("decode hex: %w", err)
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize() {
		return "", fmt.Errorf("ciphertext shorter than nonce")
	}
	nonce, data := raw[:gcm.NonceSize()], raw[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, data, nil)
	if err != nil {
		return "", fmt.Errorf("open: %w", err)
	}
	return string(plain), nil
}
