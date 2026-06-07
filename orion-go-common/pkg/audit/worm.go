package audit

import (
	"context"
	"fmt"
	"time"
)

// WORMStore defines the interface for Write-Once-Read-Many storage.
// Once an entry is written, it cannot be modified or deleted.
type WORMStore interface {
	// Write stores an audit entry. Must fail if an entry with the same ID already exists.
	Write(ctx context.Context, entry *AuditEntry) error

	// Read retrieves an audit entry by ID.
	Read(ctx context.Context, id string) (*AuditEntry, error)

	// List returns audit entries for a tenant, ordered by timestamp.
	List(ctx context.Context, tenantID string, limit, offset int) ([]*AuditEntry, error)

	// ListByTimeRange returns audit entries within a time range.
	ListByTimeRange(ctx context.Context, tenantID string, from, to time.Time) ([]*AuditEntry, error)

	// Count returns the total number of entries for a tenant.
	Count(ctx context.Context, tenantID string) (int, error)

	// VerifyIntegrity checks that the stored chain is intact.
	// Returns the verification result without modifying any data.
	VerifyIntegrity(ctx context.Context, tenantID string) (*VerificationResult, error)
}

// PostgresWORMStore implements WORMStore using PostgreSQL.
// WORM semantics are enforced by:
// 1. INSERT only (no UPDATE/DELETE on permission_audit_logs)
// 2. Application-level immutability (no update/delete methods exposed)
// 3. RLS + restricted DB user (audit logs table has no UPDATE/DELETE policy)
type PostgresWORMStore struct {
	repo   WORMRepo
	hasher *ChainHasher
}

// WORMRepo defines the database operations needed by PostgresWORMStore.
// This is the minimal interface to decouple from the full RBACRepository.
type WORMRepo interface {
	CreateAuditLog(ctx context.Context, entry *AuditEntry) error
	GetAuditLogByID(ctx context.Context, id string) (*AuditEntry, error)
	ListAuditLogsByTenant(ctx context.Context, tenantID string, limit, offset int) ([]*AuditEntry, error)
	ListAuditLogsByTimeRange(ctx context.Context, tenantID string, from, to time.Time) ([]*AuditEntry, error)
	CountAuditLogsByTenant(ctx context.Context, tenantID string) (int, error)
	GetAuditLogChain(ctx context.Context, tenantID string, limit int) ([]*AuditEntry, error)
}

// NewPostgresWORMStore creates a new PostgresWORMStore.
func NewPostgresWORMStore(repo WORMRepo) *PostgresWORMStore {
	return &PostgresWORMStore{
		repo:   repo,
		hasher: NewChainHasher(),
	}
}

// Write stores an audit entry with chain hash computation.
func (s *PostgresWORMStore) Write(ctx context.Context, entry *AuditEntry) error {
	if entry.ID == "" {
		return fmt.Errorf("audit entry ID is required")
	}
	if entry.TenantID == "" {
		return fmt.Errorf("audit entry TenantID is required")
	}

	// Set timestamp if not set
	if entry.Timestamp.IsZero() {
		entry.Timestamp = time.Now().UTC()
	}

	// Get the previous entry's hash for chaining
	if entry.PrevHash == "" {
		lastHash, err := s.repo.GetAuditLogChain(ctx, entry.TenantID, 1)
		if err == nil && len(lastHash) > 0 {
			entry.PrevHash = lastHash[0].Hash
		}
	}

	// Compute and seal the hash
	s.hasher.SealEntry(entry)

	// Write to database (INSERT only — WORM semantics)
	return s.repo.CreateAuditLog(ctx, entry)
}

// Read retrieves an audit entry by ID.
func (s *PostgresWORMStore) Read(ctx context.Context, id string) (*AuditEntry, error) {
	return s.repo.GetAuditLogByID(ctx, id)
}

// List returns audit entries for a tenant.
func (s *PostgresWORMStore) List(ctx context.Context, tenantID string, limit, offset int) ([]*AuditEntry, error) {
	return s.repo.ListAuditLogsByTenant(ctx, tenantID, limit, offset)
}

// ListByTimeRange returns audit entries within a time range.
func (s *PostgresWORMStore) ListByTimeRange(ctx context.Context, tenantID string, from, to time.Time) ([]*AuditEntry, error) {
	return s.repo.ListAuditLogsByTimeRange(ctx, tenantID, from, to)
}

// Count returns the total number of entries for a tenant.
func (s *PostgresWORMStore) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountAuditLogsByTenant(ctx, tenantID)
}

// VerifyIntegrity checks the chain integrity of stored audit entries.
// Retrieves the most recent entries and verifies the chain hash links.
func (s *PostgresWORMStore) VerifyIntegrity(ctx context.Context, tenantID string) (*VerificationResult, error) {
	// Get recent entries for verification (up to 1000)
	entries, err := s.repo.GetAuditLogChain(ctx, tenantID, 1000)
	if err != nil {
		return nil, fmt.Errorf("get audit chain: %w", err)
	}

	verifier := NewChainVerifier()
	result := verifier.Verify(entries)
	return &result, nil
}
