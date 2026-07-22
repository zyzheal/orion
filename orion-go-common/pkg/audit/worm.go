package audit

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
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

// ──────────────────────────────────────────────────────────────────────────────
// S3 Object Lock WORM Storage
// ──────────────────────────────────────────────────────────────────────────────

// S3API defines the minimal S3 operations needed for WORM storage.
// Implement with github.com/aws/aws-sdk-go-v2/service/s3.Client.
type S3API interface {
	PutObject(ctx context.Context, input *S3PutObjectInput) (*S3PutObjectOutput, error)
	GetObject(ctx context.Context, input *S3GetObjectInput) (*S3GetObjectOutput, error)
	ListObjectsV2(ctx context.Context, input *S3ListObjectsV2Input) (*S3ListObjectsV2Output, error)
}

// S3PutObjectInput represents a PutObject request.
type S3PutObjectInput struct {
	Bucket               string
	Key                  string
	Body                 []byte
	ContentType          string
	ObjectLockMode       string     // "GOVERNANCE" or "COMPLIANCE"
	ObjectLockRetainDate *time.Time // Retention until this date
}

// S3PutObjectOutput represents a PutObject response.
type S3PutObjectOutput struct {
	ETag string
}

// S3GetObjectInput represents a GetObject request.
type S3GetObjectInput struct {
	Bucket string
	Key    string
}

// S3GetObjectOutput represents a GetObject response.
type S3GetObjectOutput struct {
	Body        []byte
	ContentType string
	ETag        string
}

// S3ListObjectsV2Input represents a ListObjectsV2 request.
type S3ListObjectsV2Input struct {
	Bucket  string
	Prefix  string
	MaxKeys int32
}

// S3ListObjectsV2Output represents a ListObjectsV2 response.
type S3ListObjectsV2Output struct {
	Contents []S3Object
}

// S3Object represents an object summary in S3.
type S3Object struct {
	Key          string
	Size         int64
	LastModified time.Time
	ETag         string
}

// S3WORMConfig configures the S3-based WORM storage.
type S3WORMConfig struct {
	Bucket          string        // S3 bucket name
	Prefix          string        // Key prefix (e.g., "audit-logs/")
	RetentionPeriod time.Duration // Object Lock retention period
	LockMode        string        // "GOVERNANCE" or "COMPLIANCE" (default: COMPLIANCE)
}

// S3WORMStorage implements WORM storage using S3 Object Lock.
// Once an entry is written with Object Lock, it cannot be modified or deleted
// until the retention period expires.
//
// To use with AWS SDK v2, implement the S3API interface:
//
//	import (
//	    "github.com/aws/aws-sdk-go-v2/config"
//	    "github.com/aws/aws-sdk-go-v2/service/s3"
//	)
//	type S3Adapter struct { client *s3.Client }
//	func (a *S3Adapter) PutObject(ctx, input) (*S3PutObjectOutput, error) { ... }
//	storage := NewS3WORMStorage(adapter, config)
type S3WORMStorage struct {
	client S3API
	config S3WORMConfig
	hasher *ChainHasher
	mu     sync.Mutex // protects hasher state for concurrent Store calls
}

// NewS3WORMStorage creates a new S3-based WORM storage.
func NewS3WORMStorage(client S3API, config S3WORMConfig) *S3WORMStorage {
	if config.LockMode == "" {
		config.LockMode = "COMPLIANCE"
	}
	if config.RetentionPeriod == 0 {
		config.RetentionPeriod = 365 * 24 * time.Hour // 1 year default
	}
	if config.Prefix != "" && config.Prefix[len(config.Prefix)-1] != '/' {
		config.Prefix += "/"
	}
	return &S3WORMStorage{
		client: client,
		config: config,
		hasher: NewChainHasher(),
	}
}

// Store writes audit entries to S3 with Object Lock enabled.
// Each entry is stored as a separate S3 object with the configured lock mode.
// Safe for concurrent use.
func (s *S3WORMStorage) Store(ctx context.Context, entries []AuditEntry) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range entries {
		entry := &entries[i]
		if entry.ID == "" {
			return fmt.Errorf("audit entry ID is required")
		}
		if entry.TenantID == "" {
			return fmt.Errorf("audit entry TenantID is required")
		}

		if entry.Timestamp.IsZero() {
			entry.Timestamp = time.Now().UTC()
		}

		// Compute chain hash
		s.hasher.SealEntry(entry)

		data, err := json.Marshal(entry)
		if err != nil {
			return fmt.Errorf("marshal entry %s: %w", entry.ID, err)
		}

		retainUntil := time.Now().Add(s.config.RetentionPeriod)
		key := s.objectKey(entry.TenantID, entry.ID)

		_, err = s.client.PutObject(ctx, &S3PutObjectInput{
			Bucket:               s.config.Bucket,
			Key:                  key,
			Body:                 data,
			ContentType:          "application/json",
			ObjectLockMode:       s.config.LockMode,
			ObjectLockRetainDate: &retainUntil,
		})
		if err != nil {
			return fmt.Errorf("put object %s: %w", key, err)
		}
	}
	return nil
}

// Verify checks that an entry stored in S3 has not been tampered with.
// It retrieves the entry and verifies its chain hash integrity.
func (s *S3WORMStorage) Verify(ctx context.Context, tenantID, entryID string) (bool, error) {
	key := s.objectKey(tenantID, entryID)

	out, err := s.client.GetObject(ctx, &S3GetObjectInput{
		Bucket: s.config.Bucket,
		Key:    key,
	})
	if err != nil {
		return false, fmt.Errorf("get object %s: %w", key, err)
	}

	var entry AuditEntry
	if err := json.Unmarshal(out.Body, &entry); err != nil {
		return false, fmt.Errorf("unmarshal entry: %w", err)
	}

	return s.hasher.VerifyEntry(&entry), nil
}

// List retrieves audit entries for a tenant within a time range from S3.
func (s *S3WORMStorage) List(ctx context.Context, tenantID string, startTime, endTime time.Time) ([]AuditEntry, error) {
	prefix := s.config.Prefix + tenantID + "/"

	result, err := s.client.ListObjectsV2(ctx, &S3ListObjectsV2Input{
		Bucket:  s.config.Bucket,
		Prefix:  prefix,
		MaxKeys: 10000,
	})
	if err != nil {
		return nil, fmt.Errorf("list objects: %w", err)
	}

	var entries []AuditEntry
	for _, obj := range result.Contents {
		out, err := s.client.GetObject(ctx, &S3GetObjectInput{
			Bucket: s.config.Bucket,
			Key:    obj.Key,
		})
		if err != nil {
			continue
		}

		var entry AuditEntry
		if err := json.Unmarshal(out.Body, &entry); err != nil {
			continue
		}

		if !startTime.IsZero() && entry.Timestamp.Before(startTime) {
			continue
		}
		if !endTime.IsZero() && entry.Timestamp.After(endTime) {
			continue
		}

		entries = append(entries, entry)
	}

	return entries, nil
}

// objectKey builds the S3 object key for an audit entry.
func (s *S3WORMStorage) objectKey(tenantID, entryID string) string {
	return fmt.Sprintf("%s%s/%s.json", s.config.Prefix, tenantID, entryID)
}
