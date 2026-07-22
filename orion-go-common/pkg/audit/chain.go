// Package audit provides tamper-proof audit logging with chain hashing,
// WORM storage, and UEBA anomaly detection.
package audit

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"
)

// AuditEntry represents a single audit log entry in the chain.
type AuditEntry struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenant_id"`
	UserID    string    `json:"user_id"`
	Resource  string    `json:"resource"`
	Action    string    `json:"action"`
	Decision  string    `json:"decision"` // "allow" or "deny"
	Source    string    `json:"source"`   // "rbac", "abac", "relationship", "super_admin"
	Reason    string    `json:"reason"`
	IPAddress string    `json:"ip_address"`
	UserAgent string    `json:"user_agent"`
	RequestID string    `json:"request_id"`
	Timestamp time.Time `json:"timestamp"`

	// Chain fields
	PrevHash string `json:"prev_hash"`
	Hash     string `json:"hash"`
}

// ChainHasher computes chain hashes for audit entries.
// Each entry's hash includes the previous entry's hash, forming a tamper-evident chain.
type ChainHasher struct {
	// Separator is the field delimiter in the hash payload. Default: "|".
	Separator string
}

// NewChainHasher creates a new ChainHasher with default settings.
func NewChainHasher() *ChainHasher {
	return &ChainHasher{Separator: "|"}
}

// ComputeHash computes the SHA-256 hash for an audit entry.
// Hash = SHA256(prev_hash + sep + tenant_id + sep + user_id + sep + resource + sep + action + sep + decision + sep + timestamp)
func (h *ChainHasher) ComputeHash(entry *AuditEntry) string {
	payload := fmt.Sprintf("%s%s%s%s%s%s%s%s%s%s%s%s%s",
		entry.PrevHash, h.Separator,
		entry.TenantID, h.Separator,
		entry.UserID, h.Separator,
		entry.Resource, h.Separator,
		entry.Action, h.Separator,
		entry.Decision, h.Separator,
		entry.Timestamp.Format(time.RFC3339Nano),
	)
	sum := sha256.Sum256([]byte(payload))
	return hex.EncodeToString(sum[:])
}

// SealEntry computes and sets the Hash field on an audit entry.
// The PrevHash must already be set before calling this method.
func (h *ChainHasher) SealEntry(entry *AuditEntry) {
	entry.Hash = h.ComputeHash(entry)
}

// VerifyEntry verifies that an entry's hash is correct given its PrevHash.
// Returns true if the hash is valid.
func (h *ChainHasher) VerifyEntry(entry *AuditEntry) bool {
	expected := h.ComputeHash(entry)
	return entry.Hash == expected
}

// VerifyChain verifies the integrity of a chain of audit entries.
// Returns (valid bool, firstInvalidIndex int). If valid is true, firstInvalidIndex is -1.
func (h *ChainHasher) VerifyChain(entries []*AuditEntry) (bool, int) {
	for i, entry := range entries {
		// Verify hash integrity
		if !h.VerifyEntry(entry) {
			return false, i
		}

		// Verify chain link (except for the first entry)
		if i > 0 && entry.PrevHash != entries[i-1].Hash {
			return false, i
		}
	}
	return true, -1
}

// ChainVerifier provides high-level chain verification with reporting.
type ChainVerifier struct {
	hasher *ChainHasher
}

// NewChainVerifier creates a new ChainVerifier.
func NewChainVerifier() *ChainVerifier {
	return &ChainVerifier{hasher: NewChainHasher()}
}

// VerificationResult contains the result of a chain verification.
type VerificationResult struct {
	Valid           bool   `json:"valid"`
	TotalEntries    int    `json:"total_entries"`
	VerifiedEntries int    `json:"verified_entries"`
	FirstInvalidIdx int    `json:"first_invalid_index,omitempty"`
	ErrorDetail     string `json:"error_detail,omitempty"`
}

// Verify verifies a chain of audit entries and returns a detailed result.
func (v *ChainVerifier) Verify(entries []*AuditEntry) VerificationResult {
	if len(entries) == 0 {
		return VerificationResult{Valid: true, TotalEntries: 0, VerifiedEntries: 0}
	}

	valid, invalidIdx := v.hasher.VerifyChain(entries)
	if valid {
		return VerificationResult{
			Valid:           true,
			TotalEntries:    len(entries),
			VerifiedEntries: len(entries),
		}
	}

	detail := fmt.Sprintf("chain break at index %d", invalidIdx)
	if invalidIdx < len(entries) {
		entry := entries[invalidIdx]
		detail = fmt.Sprintf("chain break at index %d (entry_id=%s, tenant=%s, user=%s, time=%s)",
			invalidIdx, entry.ID, entry.TenantID, entry.UserID, entry.Timestamp.Format(time.RFC3339))
	}

	return VerificationResult{
		Valid:           false,
		TotalEntries:    len(entries),
		VerifiedEntries: invalidIdx,
		FirstInvalidIdx: invalidIdx,
		ErrorDetail:     detail,
	}
}
