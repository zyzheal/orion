package audit

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"
)

// mockS3API implements S3API for testing.
type mockS3API struct {
	objects map[string][]byte // key -> body
	puts    int
	gets    int
	lists   int
	putErr  error
	getErr  error
	listErr error
}

func newMockS3API() *mockS3API {
	return &mockS3API{
		objects: make(map[string][]byte),
	}
}

func (m *mockS3API) PutObject(ctx context.Context, input *S3PutObjectInput) (*S3PutObjectOutput, error) {
	if m.putErr != nil {
		return nil, m.putErr
	}
	m.puts++
	m.objects[input.Key] = input.Body
	return &S3PutObjectOutput{ETag: `"test-etag"`}, nil
}

func (m *mockS3API) GetObject(ctx context.Context, input *S3GetObjectInput) (*S3GetObjectOutput, error) {
	if m.getErr != nil {
		return nil, m.getErr
	}
	m.gets++
	body, ok := m.objects[input.Key]
	if !ok {
		return nil, fmt.Errorf("NoSuchKey: %s", input.Key)
	}
	return &S3GetObjectOutput{Body: body, ContentType: "application/json"}, nil
}

func (m *mockS3API) ListObjectsV2(ctx context.Context, input *S3ListObjectsV2Input) (*S3ListObjectsV2Output, error) {
	if m.listErr != nil {
		return nil, m.listErr
	}
	m.lists++
	var contents []S3Object
	for key := range m.objects {
		if input.Prefix != "" && len(key) >= len(input.Prefix) && key[:len(input.Prefix)] == input.Prefix {
			contents = append(contents, S3Object{Key: key, Size: int64(len(m.objects[key]))})
		}
	}
	return &S3ListObjectsV2Output{Contents: contents}, nil
}

func TestS3WORMStorage_Store(t *testing.T) {
	mock := newMockS3API()
	storage := NewS3WORMStorage(mock, S3WORMConfig{
		Bucket:          "test-bucket",
		Prefix:          "audit-logs/",
		RetentionPeriod: 24 * time.Hour,
		LockMode:        "COMPLIANCE",
	})

	entries := []AuditEntry{
		{
			ID:       "entry-1",
			TenantID: "tenant-1",
			UserID:   "user-1",
			Resource: "pipeline",
			Action:   "read",
			Decision: "allow",
		},
		{
			ID:       "entry-2",
			TenantID: "tenant-1",
			UserID:   "user-1",
			Resource: "pipeline",
			Action:   "write",
			Decision: "deny",
		},
	}

	err := storage.Store(context.Background(), entries)
	if err != nil {
		t.Fatalf("Store failed: %v", err)
	}

	if mock.puts != 2 {
		t.Errorf("expected 2 PutObject calls, got %d", mock.puts)
	}

	// Verify entries were stored with correct keys
	for _, key := range []string{"audit-logs/tenant-1/entry-1.json", "audit-logs/tenant-1/entry-2.json"} {
		if _, ok := mock.objects[key]; !ok {
			t.Errorf("expected object at key %s", key)
		}
	}

	// Verify stored data is valid JSON with chain hash
	var stored AuditEntry
	if err := json.Unmarshal(mock.objects["audit-logs/tenant-1/entry-1.json"], &stored); err != nil {
		t.Fatalf("unmarshal stored entry: %v", err)
	}
	if stored.Hash == "" {
		t.Error("stored entry should have chain hash computed")
	}
	if stored.Timestamp.IsZero() {
		t.Error("stored entry should have timestamp set")
	}
}

func TestS3WORMStorage_Store_Validation(t *testing.T) {
	mock := newMockS3API()
	storage := NewS3WORMStorage(mock, S3WORMConfig{Bucket: "test-bucket"})

	// Missing ID
	err := storage.Store(context.Background(), []AuditEntry{{TenantID: "t1"}})
	if err == nil {
		t.Error("expected error for missing ID")
	}

	// Missing TenantID
	err = storage.Store(context.Background(), []AuditEntry{{ID: "e1"}})
	if err == nil {
		t.Error("expected error for missing TenantID")
	}
}

func TestS3WORMStorage_Store_PutError(t *testing.T) {
	mock := newMockS3API()
	mock.putErr = fmt.Errorf("access denied")
	storage := NewS3WORMStorage(mock, S3WORMConfig{Bucket: "test-bucket"})

	err := storage.Store(context.Background(), []AuditEntry{
		{ID: "e1", TenantID: "t1"},
	})
	if err == nil {
		t.Error("expected error from PutObject failure")
	}
}

func TestS3WORMStorage_Verify(t *testing.T) {
	mock := newMockS3API()
	storage := NewS3WORMStorage(mock, S3WORMConfig{
		Bucket: "test-bucket",
		Prefix: "audit-logs/",
	})

	// Store an entry first
	entry := AuditEntry{
		ID:       "entry-1",
		TenantID: "tenant-1",
		UserID:   "user-1",
		Resource: "pipeline",
		Action:   "read",
		Decision: "allow",
	}
	err := storage.Store(context.Background(), []AuditEntry{entry})
	if err != nil {
		t.Fatalf("Store failed: %v", err)
	}

	// Verify the entry
	valid, err := storage.Verify(context.Background(), "tenant-1", "entry-1")
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}
	if !valid {
		t.Error("entry should be valid")
	}

	// Tamper with the stored data
	storedData := mock.objects["audit-logs/tenant-1/entry-1.json"]
	var tampered AuditEntry
	json.Unmarshal(storedData, &tampered)
	tampered.Action = "delete"
	tamperedData, _ := json.Marshal(tampered)
	mock.objects["audit-logs/tenant-1/entry-1.json"] = tamperedData

	// Verify should fail
	valid, err = storage.Verify(context.Background(), "tenant-1", "entry-1")
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}
	if valid {
		t.Error("tampered entry should not be valid")
	}
}

func TestS3WORMStorage_Verify_NotFound(t *testing.T) {
	mock := newMockS3API()
	storage := NewS3WORMStorage(mock, S3WORMConfig{Bucket: "test-bucket"})

	_, err := storage.Verify(context.Background(), "tenant-1", "nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent entry")
	}
}

func TestS3WORMStorage_List(t *testing.T) {
	mock := newMockS3API()
	storage := NewS3WORMStorage(mock, S3WORMConfig{
		Bucket: "test-bucket",
		Prefix: "audit-logs/",
	})

	now := time.Now()
	entries := []AuditEntry{
		{ID: "e1", TenantID: "t1", UserID: "u1", Timestamp: now.Add(-2 * time.Hour)},
		{ID: "e2", TenantID: "t1", UserID: "u1", Timestamp: now.Add(-1 * time.Hour)},
		{ID: "e3", TenantID: "t1", UserID: "u1", Timestamp: now},
		{ID: "e4", TenantID: "t2", UserID: "u2", Timestamp: now}, // different tenant
	}

	if err := storage.Store(context.Background(), entries); err != nil {
		t.Fatalf("Store failed: %v", err)
	}

	// List all for tenant-1
	result, err := storage.List(context.Background(), "t1", time.Time{}, time.Time{})
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}
	if len(result) != 3 {
		t.Errorf("expected 3 entries for tenant-1, got %d", len(result))
	}

	// List with time range (last 90 minutes)
	result, err = storage.List(context.Background(), "t1", now.Add(-90*time.Minute), time.Time{})
	if err != nil {
		t.Fatalf("List with time range failed: %v", err)
	}
	if len(result) != 2 {
		t.Errorf("expected 2 entries in last 90min, got %d", len(result))
	}

	// List different tenant
	result, err = storage.List(context.Background(), "t2", time.Time{}, time.Time{})
	if err != nil {
		t.Fatalf("List for t2 failed: %v", err)
	}
	if len(result) != 1 {
		t.Errorf("expected 1 entry for tenant-2, got %d", len(result))
	}
}

func TestS3WORMStorage_List_Error(t *testing.T) {
	mock := newMockS3API()
	mock.listErr = fmt.Errorf("access denied")
	storage := NewS3WORMStorage(mock, S3WORMConfig{Bucket: "test-bucket"})

	_, err := storage.List(context.Background(), "t1", time.Time{}, time.Time{})
	if err == nil {
		t.Error("expected error from ListObjects failure")
	}
}

func TestS3WORMStorage_DefaultConfig(t *testing.T) {
	mock := newMockS3API()
	storage := NewS3WORMStorage(mock, S3WORMConfig{
		Bucket: "test-bucket",
	})

	if storage.config.LockMode != "COMPLIANCE" {
		t.Errorf("expected default lock mode COMPLIANCE, got %s", storage.config.LockMode)
	}
	if storage.config.RetentionPeriod != 365*24*time.Hour {
		t.Errorf("expected default retention 365 days, got %v", storage.config.RetentionPeriod)
	}
}

func TestS3WORMStorage_ObjectKey(t *testing.T) {
	mock := newMockS3API()
	storage := NewS3WORMStorage(mock, S3WORMConfig{
		Bucket: "test-bucket",
		Prefix: "audit-logs",
	})

	key := storage.objectKey("tenant-1", "entry-1")
	if key != "audit-logs/tenant-1/entry-1.json" {
		t.Errorf("unexpected key: %s", key)
	}
}
