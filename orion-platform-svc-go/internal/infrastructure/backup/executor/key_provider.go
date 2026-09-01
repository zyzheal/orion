package executor

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
)

// KeyProvider resolves an AES-256 key material by its stable identifier
// (e.g. "v1", "v2", or a KMS key ARN / alias). Encryption asks for the
// current key ID, decryption asks for the exact ID recorded in the header on
// write, so rotating the store to a new key never breaks old artifacts.
//
// G6 introduces this seam without changing EncryptFile/DecryptFile's primary
// signatures: those keep taking a raw []byte key, which is equivalent to a
// static single-key provider.
type KeyProvider interface {
	// GetKey returns the 32-byte AES-256 key for the given id. It must
	// return an error for unknown ids so decryption fails closed instead of
	// silently using a wrong/wildcard key.
	GetKey(ctx context.Context, keyID string) ([]byte, error)
}

// StaticKeyProvider returns a single fixed key for every id. It backs the
// non-versioned EncryptFile/DecryptFile paths and simplifies callers that
// manage exactly one key.
type StaticKeyProvider struct {
	Key []byte
}

func (p *StaticKeyProvider) GetKey(_ context.Context, _ string) ([]byte, error) {
	if len(p.Key) != 32 {
		return nil, ErrEmptyKey
	}
	return p.Key, nil
}

// StaticMapKeyProvider serves multiple named keys from an in-memory map. It
// is used by tests to simulate a versioned key store where old versions
// remain readable after rotation.
type StaticMapKeyProvider struct {
	Keys map[string][]byte
}

func (p *StaticMapKeyProvider) GetKey(_ context.Context, keyID string) ([]byte, error) {
	k, ok := p.Keys[keyID]
	if !ok {
		return nil, fmt.Errorf("key provider: unknown key id %q", keyID)
	}
	if len(k) != 32 {
		return nil, fmt.Errorf("key provider: key %q is not AES-256 (got %d bytes)", keyID, len(k))
	}
	return k, nil
}

// Base64KeyProvider decodes a base64-encoded key for the id from a static
// map, enabling config-file backed key stores. Values are base64 standard
// encoding of exactly 32 bytes.
type Base64KeyProvider struct {
	Encoded map[string]string
}

func (p *Base64KeyProvider) GetKey(_ context.Context, keyID string) ([]byte, error) {
	enc, ok := p.Encoded[keyID]
	if !ok {
		return nil, fmt.Errorf("key provider: unknown key id %q", keyID)
	}
	k, err := base64.StdEncoding.DecodeString(strings.TrimSpace(enc))
	if err != nil {
		return nil, fmt.Errorf("key provider: key %q is not valid base64: %w", keyID, err)
	}
	if len(k) != 32 {
		return nil, fmt.Errorf("key provider: key %q is not AES-256 (got %d bytes)", keyID, len(k))
	}
	return k, nil
}

// KMSKeyProvider is a fail-closed stub for a real KMS integration. It only
// serves keys that were explicitly provisioned in the map; any other id
// returns an error rather than guessing. Production KMS adapters (AWS KMS /
// GCP KMS / HashiCorp Vault) implement the same KeyProvider interface.
type KMSKeyProvider struct {
	Provisioned map[string][]byte
}

func (p *KMSKeyProvider) GetKey(_ context.Context, keyID string) ([]byte, error) {
	k, ok := p.Provisioned[keyID]
	if !ok {
		return nil, fmt.Errorf("kms: key id %q not provisioned (fail-closed)", keyID)
	}
	if len(k) != 32 {
		return nil, fmt.Errorf("kms: key %q is not AES-256 (got %d bytes)", keyID, len(k))
	}
	return k, nil
}

// StaticKeyProviderFrom returns a KeyProvider wrapping a single key. It is a
// convenience used to preserve the existing `EncryptFile(src,dst,key)` API
// while letting callers pass a provider-compatible value.
func StaticKeyProviderFrom(key []byte) *StaticKeyProvider {
	return &StaticKeyProvider{Key: key}
}

var _ KeyProvider = (*StaticKeyProvider)(nil)
var _ KeyProvider = (*StaticMapKeyProvider)(nil)
var _ KeyProvider = (*Base64KeyProvider)(nil)
var _ KeyProvider = (*KMSKeyProvider)(nil)

// ErrUnknownKeyID indicates a decryption requested an id the provider does
// not serve — distinct from auth failure so callers can distinguish "key
// retired/lost" from "tampered data".
var ErrUnknownKeyID = errors.New("key provider: unknown key id")