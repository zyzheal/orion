package datasource

import (
	"context"
	"fmt"
)

// DefaultPoolSize is the default number of concurrent connections per data source.
const DefaultPoolSize = 5

// Manager manages a collection of registered data sources with connection pooling.
type Manager struct {
	sources map[string]*Connector
	logger  Logger
}

// NewManager creates a new data source Manager.
func NewManager(logger Logger) *Manager {
	return &Manager{
		sources: make(map[string]*Connector),
		logger:  logger,
	}
}

// Register registers a data source with the given key.
func (m *Manager) Register(key string, cfg *DataSourceConfig, factory *DataSourceFactory) error {
	if m.sources == nil {
		m.sources = make(map[string]*Connector)
	}
	ds, err := factory.Create(cfg)
	if err != nil {
		return fmt.Errorf("failed to create datasource %q: %w", key, err)
	}

	poolSize := DefaultPoolSize
	if cfg.Config["pool_size"] != nil {
		if ps, ok := cfg.Config["pool_size"].(float64); ok && ps >= 1 {
			poolSize = int(ps)
		}
	}

	conn := NewConnector(ds, poolSize)
	m.sources[key] = conn

	if m.logger != nil {
		m.logger.Info("datasource registered", "key", key, "type", cfg.Type, "pool_size", poolSize)
	}
	return nil
}

// Unregister removes a data source from the manager.
func (m *Manager) Unregister(key string) error {
	conn, ok := m.sources[key]
	if !ok {
		return fmt.Errorf("datasource %q not found", key)
	}
	if err := conn.Close(); err != nil {
		return fmt.Errorf("failed to close datasource %q: %w", key, err)
	}
	delete(m.sources, key)
	if m.logger != nil {
		m.logger.Info("datasource unregistered", "key", key)
	}
	return nil
}

// Get retrieves a registered data source by key.
func (m *Manager) Get(key string) (*Connector, error) {
	conn, ok := m.sources[key]
	if !ok {
		return nil, fmt.Errorf("datasource %q not found", key)
	}
	return conn, nil
}

// ListKeys returns all registered data source keys.
func (m *Manager) ListKeys() []string {
	keys := make([]string, 0, len(m.sources))
	for k := range m.sources {
		keys = append(keys, k)
	}
	return keys
}

// Execute retrieves a connector by key and executes a query.
func (m *Manager) Execute(ctx context.Context, key string, query string, params map[string]interface{}) (*QueryResult, error) {
	conn, err := m.Get(key)
	if err != nil {
		return nil, err
	}
	return conn.Execute(ctx, query, params)
}

// CloseAll closes all registered data sources.
func (m *Manager) CloseAll() {
	for key, conn := range m.sources {
		if err := conn.Close(); err != nil && m.logger != nil {
			m.logger.Error("failed to close datasource", "key", key, "error", err.Error())
		}
	}
	m.sources = make(map[string]*Connector)
}

// ListHealth returns the health status of all registered data sources.
func (m *Manager) ListHealth(ctx context.Context) map[string]map[string]interface{} {
	status := make(map[string]map[string]interface{})
	for key := range m.sources {
		conn, ok := m.sources[key]
		if !ok {
			status[key] = map[string]interface{}{
				"healthy": false,
				"error":   "datasource not found",
			}
			continue
		}
		healthy, err := conn.Health(ctx)
		if err != nil {
			status[key] = map[string]interface{}{
				"healthy": false,
				"error":   err.Error(),
			}
		} else {
			status[key] = map[string]interface{}{
				"healthy":   healthy,
				"pool_size": conn.PoolSize(),
			}
		}
	}
	return status
}
