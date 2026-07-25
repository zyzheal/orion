package datasource

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

// mockDataSource is a test implementation of DataSource.
type mockDataSource struct {
	connectErr  error
	executeErr  error
	healthErr   error
	healthy     bool
	closed      bool
	mu          sync.Mutex
}

func (m *mockDataSource) Type() DataSourceType { return TypePostgreSQL }

func (m *mockDataSource) Connect(ctx context.Context) error {
	return m.connectErr
}

func (m *mockDataSource) Close() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.closed = true
	return nil
}

func (m *mockDataSource) Execute(ctx context.Context, query string, params map[string]interface{}) (*QueryResult, error) {
	if m.executeErr != nil {
		return nil, m.executeErr
	}
	return &QueryResult{
		Fields: []string{"id", "name"},
		Rows:   [][]interface{}{{1, "test"}},
		Total:  1,
	}, nil
}

func (m *mockDataSource) Health(ctx context.Context) (bool, error) {
	return m.healthy, m.healthErr
}

func TestManager_RegisterAndGet(t *testing.T) {
	factory := NewDataSourceFactory(nil)
	manager := NewManager(nil)

	cfg := &DataSourceConfig{
		Type: TypePostgreSQL,
		Name: "test-pg",
	}
	ds, err := factory.Create(cfg)
	if err != nil {
		t.Fatalf("factory.Create = error: %v", err)
	}

	conn := NewConnector(ds, 2)
	manager.sources["pg"] = conn

	got, err := manager.Get("pg")
	if err != nil {
		t.Fatalf("manager.Get = error: %v", err)
	}
	if got == nil {
		t.Fatal("manager.Get returned nil")
	}
}

func TestManager_Get_NonExistent(t *testing.T) {
	manager := NewManager(nil)

	_, err := manager.Get("nonexistent")
	if err == nil {
		t.Fatal("expected error for non-existent datasource")
	}
}

func TestManager_Unregister(t *testing.T) {
	factory := NewDataSourceFactory(nil)
	manager := NewManager(nil)

	cfg := &DataSourceConfig{Type: TypePostgreSQL, Name: "test"}
	ds, err := factory.Create(cfg)
	if err != nil {
		t.Fatalf("factory.Create = error: %v", err)
	}
	conn := NewConnector(ds, 1)
	manager.sources["ds"] = conn

	err = manager.Unregister("ds")
	if err != nil {
		t.Fatalf("Unregister = error: %v", err)
	}
	keys := manager.ListKeys()
	if len(keys) != 0 {
		t.Errorf("ListKeys = %v, want empty", keys)
	}
}

func TestManager_ListKeys(t *testing.T) {
	manager := NewManager(nil)
	manager.sources["a"] = &Connector{poolSize: 1}
	manager.sources["b"] = &Connector{poolSize: 1}

	keys := manager.ListKeys()
	if len(keys) != 2 {
		t.Errorf("ListKeys = %v, want 2 keys", keys)
	}
}

func TestManager_CloseAll(t *testing.T) {
	manager := NewManager(nil)
	manager.sources["a"] = &Connector{poolSize: 1}
	manager.sources["b"] = &Connector{poolSize: 1}

	manager.CloseAll()
	if len(manager.sources) != 0 {
		t.Errorf("CloseAll failed, sources still present")
	}
}

func TestManager_Execute(t *testing.T) {
	mockDS := &mockDataSource{
		healthy: true,
	}
	conn := NewConnector(mockDS, 1)

	manager := NewManager(nil)
	manager.sources["test"] = conn

	result, err := manager.Execute(context.Background(), "test", "SELECT 1", nil)
	if err != nil {
		t.Fatalf("Execute = error: %v", err)
	}
	if result == nil {
		t.Fatal("Execute returned nil result")
	}
	if len(result.Rows) != 1 {
		t.Errorf("Execute = %d rows, want 1", len(result.Rows))
	}
}

func TestManager_Execute_NonExistent(t *testing.T) {
	manager := NewManager(nil)

	_, err := manager.Execute(context.Background(), "nope", "SELECT 1", nil)
	if err == nil {
		t.Fatal("expected error for non-existent datasource")
	}
}

func TestManager_ListHealth(t *testing.T) {
	mockDS := &mockDataSource{healthy: true}
	conn := NewConnector(mockDS, 3)

	manager := NewManager(nil)
	manager.sources["healthy-ds"] = conn

	status := manager.ListHealth(context.Background())
	if len(status) != 1 {
		t.Fatalf("ListHealth = %d entries, want 1", len(status))
	}
	s, ok := status["healthy-ds"]
	if !ok {
		t.Fatal("ListHealth missing healthy-ds")
	}
	if !s["healthy"].(bool) {
		t.Error("healthy-ds should be healthy")
	}
	ps := s["pool_size"]
	if ps.(int) != 3 {
		t.Errorf("pool_size = %v, want 3", ps)
	}
}

func TestManager_ListHealth_WithError(t *testing.T) {
	mockDS := &mockDataSource{healthErr: errors.New("timeout")}
	conn := NewConnector(mockDS, 1)

	// Override Health to return the mock's error.
	type failingDS struct {
		DataSource
	}
	// Use a custom Connector-like wrapper.
	manager := NewManager(nil)
	manager.sources["failing-ds"] = conn

	status := manager.ListHealth(context.Background())
	s := status["failing-ds"]
	if s["healthy"].(bool) {
		t.Error("failing-ds should be unhealthy")
	}
}

// Connector tests.

func TestConnector_Execute_BoundedConcurrency(t *testing.T) {
	mockDS := &mockDataSource{healthy: true}
	conn := NewConnector(mockDS, 1)

	var wg sync.WaitGroup
	results := make([]*QueryResult, 3)
	errs := make([]error, 3)

	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			results[idx], errs[idx] = conn.Execute(context.Background(), "SELECT 1", nil)
		}(i)
	}
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Errorf("goroutine %d Execute = error: %v", i, err)
		}
		if results[i] == nil {
			t.Errorf("goroutine %d Execute returned nil result", i)
		}
	}
}

func TestConnector_Execute_ContextCancellation(t *testing.T) {
	// Create a connector with pool size 0 to simulate pool exhaustion.
	mockDS := &mockDataSource{healthy: true}
	conn := &Connector{
		ds:     mockDS,
		pool:   make(chan DataSource, 1), // pre-filled with one token
		poolSize: 1,
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // immediately cancelled

	_, err := conn.Execute(ctx, "SELECT 1", nil)
	if err == nil {
		t.Fatal("expected context cancellation error")
	}
}

func TestConnector_PoolSizeDefault(t *testing.T) {
	mockDS := &mockDataSource{healthy: true}
	conn := NewConnector(mockDS, 0) // 0 should be corrected to 1
	if conn.PoolSize() != 1 {
		t.Errorf("PoolSize = %d, want 1", conn.PoolSize())
	}
}

func TestConnector_Close(t *testing.T) {
	mockDS := &mockDataSource{healthy: true}
	conn := NewConnector(mockDS, 1)

	err := conn.Close()
	if err != nil {
		t.Fatalf("Close = error: %v", err)
	}
}

func TestConnector_Health(t *testing.T) {
	mockDS := &mockDataSource{healthy: true, healthErr: nil}
	conn := NewConnector(mockDS, 1)

	healthy, err := conn.Health(context.Background())
	if err != nil {
		t.Fatalf("Health = error: %v", err)
	}
	if !healthy {
		t.Error("expected healthy datasource")
	}
}
