package audit

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// AuditBlock represents a block of audit entries that gets signed together.
type AuditBlock struct {
	BlockID    string        `json:"block_id"`
	TenantID   string        `json:"tenant_id"`
	StartIdx   int           `json:"start_idx"`
	EndIdx     int           `json:"end_idx"`
	EntryCount int           `json:"entry_count"`
	Entries    []*AuditEntry `json:"entries"`
	BlockHash  string        `json:"block_hash"`
	Signature  string        `json:"signature"`
	SignedAt   time.Time     `json:"signed_at"`
	KeyID      string        `json:"key_id"`
}

// Signer periodically signs blocks of audit entries for tamper-proofing.
type Signer struct {
	store      WORMStore
	privateKey *rsa.PrivateKey
	keyID      string
	interval   time.Duration
	blockSize  int
	mu         sync.Mutex
	stopCh     chan struct{}
}

// NewSigner creates a new periodic signer.
// interval: how often to sign (e.g., 1 hour)
// blockSize: number of entries per signed block
func NewSigner(store WORMStore, privateKey *rsa.PrivateKey, keyID string, interval time.Duration, blockSize int) *Signer {
	if blockSize <= 0 {
		blockSize = 100
	}
	return &Signer{
		store:      store,
		privateKey: privateKey,
		keyID:      keyID,
		interval:   interval,
		blockSize:  blockSize,
		stopCh:     make(chan struct{}),
	}
}

// Start begins the periodic signing loop. Runs until Stop() is called.
func (s *Signer) Start(ctx context.Context, tenantID string) {
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-s.stopCh:
			return
		case <-ticker.C:
			s.SignBlock(ctx, tenantID)
		}
	}
}

// Stop signals the signer to stop.
func (s *Signer) Stop() {
	close(s.stopCh)
}

// SignBlock signs the most recent block of audit entries.
func (s *Signer) SignBlock(ctx context.Context, tenantID string) (*AuditBlock, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Get the most recent entries
	entries, err := s.store.List(ctx, tenantID, s.blockSize, 0)
	if err != nil {
		return nil, fmt.Errorf("list entries for signing: %w", err)
	}
	if len(entries) == 0 {
		return nil, nil
	}

	// Create block
	block := &AuditBlock{
		BlockID:    fmt.Sprintf("block_%s_%d", tenantID, time.Now().UnixNano()),
		TenantID:   tenantID,
		StartIdx:   0,
		EndIdx:     len(entries) - 1,
		EntryCount: len(entries),
		Entries:    entries,
		SignedAt:   time.Now().UTC(),
		KeyID:      s.keyID,
	}

	// Compute block hash
	block.BlockHash = s.computeBlockHash(block)

	// Sign with RSA private key
	signature, err := s.signData([]byte(block.BlockHash))
	if err != nil {
		return nil, fmt.Errorf("sign block: %w", err)
	}
	block.Signature = base64.StdEncoding.EncodeToString(signature)

	return block, nil
}

// VerifyBlock verifies the signature of an audit block.
func (s *Signer) VerifyBlock(block *AuditBlock, publicKey *rsa.PublicKey) error {
	// Verify block hash
	expectedHash := s.computeBlockHash(block)
	if block.BlockHash != expectedHash {
		return fmt.Errorf("block hash mismatch")
	}

	// Verify signature
	sigBytes, err := base64.StdEncoding.DecodeString(block.Signature)
	if err != nil {
		return fmt.Errorf("decode signature: %w", err)
	}

	hash := sha256.Sum256([]byte(block.BlockHash))
	err = rsa.VerifyPKCS1v15(publicKey, crypto.SHA256, hash[:], sigBytes)
	if err != nil {
		return fmt.Errorf("signature verification failed: %w", err)
	}

	return nil
}

// computeBlockHash computes a hash over all entries in a block.
func (s *Signer) computeBlockHash(block *AuditBlock) string {
	hasher := sha256.New()
	for _, entry := range block.Entries {
		data, _ := json.Marshal(map[string]string{
			"id":        entry.ID,
			"hash":      entry.Hash,
			"prev_hash": entry.PrevHash,
		})
		hasher.Write(data)
	}
	sum := hasher.Sum(nil)
	return base64.StdEncoding.EncodeToString(sum)
}

// signData signs data with the RSA private key.
func (s *Signer) signData(data []byte) ([]byte, error) {
	hash := sha256.Sum256(data)
	return rsa.SignPKCS1v15(rand.Reader, s.privateKey, crypto.SHA256, hash[:])
}

// GenerateKeyPair generates an RSA key pair for audit signing.
func GenerateKeyPair(bits int) (*rsa.PrivateKey, error) {
	if bits < 2048 {
		bits = 2048
	}
	return rsa.GenerateKey(rand.Reader, bits)
}

// ExportPublicKeyPEM exports the public key in PEM format.
func ExportPublicKeyPEM(privateKey *rsa.PrivateKey) []byte {
	pubASN1, _ := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	return []byte(base64.StdEncoding.EncodeToString(pubASN1))
}
