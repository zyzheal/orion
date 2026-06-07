package audit

import (
	"fmt"
	"testing"
	"time"
)

func TestChainHasher_ComputeHash(t *testing.T) {
	hasher := NewChainHasher()

	entry := &AuditEntry{
		ID:        "entry-1",
		TenantID:  "tenant-1",
		UserID:    "user-1",
		Resource:  "pipeline",
		Action:    "read",
		Decision:  "allow",
		Timestamp: time.Date(2026, 6, 7, 12, 0, 0, 0, time.UTC),
	}

	hash := hasher.ComputeHash(entry)
	if hash == "" {
		t.Fatal("hash should not be empty")
	}
	if len(hash) != 64 { // SHA-256 hex = 64 chars
		t.Errorf("expected 64 char hash, got %d", len(hash))
	}

	// Same input should produce same hash
	hash2 := hasher.ComputeHash(entry)
	if hash != hash2 {
		t.Error("same input should produce same hash")
	}

	// Different timestamp should produce different hash
	entry2 := *entry
	entry2.Timestamp = time.Date(2026, 6, 7, 13, 0, 0, 0, time.UTC)
	hash3 := hasher.ComputeHash(&entry2)
	if hash == hash3 {
		t.Error("different timestamp should produce different hash")
	}
}

func TestChainHasher_SealEntry(t *testing.T) {
	hasher := NewChainHasher()

	entry := &AuditEntry{
		ID:        "entry-1",
		TenantID:  "tenant-1",
		UserID:    "user-1",
		Resource:  "pipeline",
		Action:    "read",
		Decision:  "allow",
		Timestamp: time.Now().UTC(),
	}

	hasher.SealEntry(entry)
	if entry.Hash == "" {
		t.Fatal("SealEntry should set Hash")
	}
}

func TestChainHasher_VerifyEntry(t *testing.T) {
	hasher := NewChainHasher()

	entry := &AuditEntry{
		ID:        "entry-1",
		TenantID:  "tenant-1",
		UserID:    "user-1",
		Resource:  "pipeline",
		Action:    "read",
		Decision:  "allow",
		Timestamp: time.Now().UTC(),
	}

	hasher.SealEntry(entry)
	if !hasher.VerifyEntry(entry) {
		t.Error("sealed entry should verify")
	}

	// Tamper with the entry
	entry.Action = "write"
	if hasher.VerifyEntry(entry) {
		t.Error("tampered entry should not verify")
	}
}

func TestChainHasher_VerifyChain(t *testing.T) {
	hasher := NewChainHasher()

	entries := make([]*AuditEntry, 5)
	for i := range entries {
		entries[i] = &AuditEntry{
			ID:        fmt.Sprintf("entry-%d", i),
			TenantID:  "tenant-1",
			UserID:    "user-1",
			Resource:  "pipeline",
			Action:    "read",
			Decision:  "allow",
			Timestamp: time.Now().Add(time.Duration(i) * time.Second).UTC(),
		}
		if i > 0 {
			entries[i].PrevHash = entries[i-1].Hash
		}
		hasher.SealEntry(entries[i])
	}

	// Valid chain
	valid, idx := hasher.VerifyChain(entries)
	if !valid {
		t.Errorf("valid chain should pass, failed at index %d", idx)
	}

	// Tamper with middle entry
	entries[2].Action = "delete"
	valid, idx = hasher.VerifyChain(entries)
	if valid {
		t.Error("tampered chain should fail")
	}
	if idx != 2 {
		t.Errorf("expected failure at index 2, got %d", idx)
	}
}

func TestChainHasher_VerifyChain_BrokenLink(t *testing.T) {
	hasher := NewChainHasher()

	entries := make([]*AuditEntry, 3)
	for i := range entries {
		entries[i] = &AuditEntry{
			ID:        fmt.Sprintf("entry-%d", i),
			TenantID:  "tenant-1",
			UserID:    "user-1",
			Resource:  "pipeline",
			Action:    "read",
			Decision:  "allow",
			Timestamp: time.Now().Add(time.Duration(i) * time.Second).UTC(),
		}
		if i > 0 {
			entries[i].PrevHash = entries[i-1].Hash
		}
		hasher.SealEntry(entries[i])
	}

	// Break the chain link: tamper entry[1].PrevHash and re-seal
	entries[1].PrevHash = "tampered_prev_hash"
	hasher.SealEntry(entries[1])
	// entry[1].Hash changes after re-seal, but entry[2].PrevHash still points to old hash
	// Verification should fail at index 2 because PrevHash link is broken
	valid, idx := hasher.VerifyChain(entries)
	if valid {
		t.Error("broken chain link should fail")
	}
	// Fails at index 1 because PrevHash doesn't match entry[0].Hash
	if idx != 1 {
		t.Errorf("expected failure at index 1, got %d", idx)
	}
}

func TestChainVerifier_Verify(t *testing.T) {
	hasher := NewChainHasher()
	verifier := NewChainVerifier()

	// Empty chain
	result := verifier.Verify(nil)
	if !result.Valid {
		t.Error("empty chain should be valid")
	}

	// Valid chain
	entries := make([]*AuditEntry, 3)
	for i := range entries {
		entries[i] = &AuditEntry{
			ID:        fmt.Sprintf("entry-%d", i),
			TenantID:  "tenant-1",
			UserID:    "user-1",
			Resource:  "pipeline",
			Action:    "read",
			Decision:  "allow",
			Timestamp: time.Now().Add(time.Duration(i) * time.Second).UTC(),
		}
		if i > 0 {
			entries[i].PrevHash = entries[i-1].Hash
		}
		hasher.SealEntry(entries[i])
	}

	result = verifier.Verify(entries)
	if !result.Valid {
		t.Errorf("valid chain should pass: %s", result.ErrorDetail)
	}
	if result.TotalEntries != 3 {
		t.Errorf("expected 3 entries, got %d", result.TotalEntries)
	}
	if result.VerifiedEntries != 3 {
		t.Errorf("expected 3 verified, got %d", result.VerifiedEntries)
	}
}

func TestChainVerifier_Verify_Invalid(t *testing.T) {
	hasher := NewChainHasher()
	verifier := NewChainVerifier()

	entries := make([]*AuditEntry, 3)
	for i := range entries {
		entries[i] = &AuditEntry{
			ID:        fmt.Sprintf("entry-%d", i),
			TenantID:  "tenant-1",
			UserID:    "user-1",
			Resource:  "pipeline",
			Action:    "read",
			Decision:  "allow",
			Timestamp: time.Now().Add(time.Duration(i) * time.Second).UTC(),
		}
		if i > 0 {
			entries[i].PrevHash = entries[i-1].Hash
		}
		hasher.SealEntry(entries[i])
	}

	// Tamper with entry 1
	entries[1].Decision = "deny"

	result := verifier.Verify(entries)
	if result.Valid {
		t.Error("tampered chain should fail")
	}
	if result.VerifiedEntries != 1 {
		t.Errorf("expected 1 verified before break, got %d", result.VerifiedEntries)
	}
	if result.ErrorDetail == "" {
		t.Error("error detail should be set")
	}
}
