package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"orion/platform-svc-go/internal/job-source/models"

	"database/sql"

	"go.uber.org/zap"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, m *models.JobSource) error
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.JobSource, error)
	List(ctx context.Context, tenantID string, limit, offset int) ([]models.JobSource, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	UpdatePartial(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	CreateEvent(ctx context.Context, e *models.JobSourceEvent) error
	UpdateEventStatus(ctx context.Context, tenantID, id string, status string, jobID string, err string) error
	ListEvents(ctx context.Context, tenantID, sourceID string, limit, offset int) ([]models.JobSourceEvent, error)
}

// IJobSource is the SPI every job source implementation must satisfy.
type IJobSource interface {
	Name() string
	Type() string
	Initialize(ctx context.Context, config map[string]string) error
	StartListening(ctx context.Context, handler func(map[string]interface{})) error
	Stop() error
}

// IJobSourceAdapter extends IJobSource with typed event handling and lifecycle.
// Adapters (WebhookAdapter, CronAdapter, EventAdapter, APIAdapter) implement
// this interface. The typed EventHandler replaces the raw map callback.
type IJobSourceAdapter interface {
	Name() string
	Type() string
	Initialize(ctx context.Context, config map[string]string) error
	// StartListening begins receiving events. The typed handler dispatches
	// structured EventPayload records to downstream processors.
	StartListening(ctx context.Context, handler EventHandler) error
	Stop() error
}

// AdapterFactory creates a new adapter instance for a given source type.
type AdapterFactory func(logger *zap.Logger, config models.SourceConfig) IJobSourceAdapter

// Service manages job sources and dispatches events.
type Service struct {
	repo  RepositoryInterface
	mgr   *JobSourceManager
	logger *zap.Logger
}

// NewService creates a new Service with the given repository and logger.
func NewService(repo RepositoryInterface, logger *zap.Logger) *Service {
	return &Service{
		repo:  repo,
		mgr:   NewJobSourceManager(repo, logger),
		logger: logger,
	}
}

// RegisterSource registers a custom job source implementation.
func (s *Service) RegisterSource(src IJobSource) {
	s.mgr.Register(src)
}

// CreateSource creates a new job source.
func (s *Service) CreateSource(ctx context.Context, tenantID string, req models.CreateJobSourceRequest) (*models.JobSource, error) {
	cfg, err := repository.MarshalJSONConfig(req.Config)
	if err != nil {
		return nil, err
	}
	m := &models.JobSource{
		TenantID: tenantID,
		Name:     req.Name,
		Type:     req.Type,
		Config:   cfg,
		Enabled:  true,
	}
	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	s.logger.Info("job source created", zap.String("id", m.ID), zap.String("type", req.Type))
	return m, nil
}

// GetSource returns a job source by ID.
func (s *Service) GetSource(ctx context.Context, tenantID, id string) (*models.JobSource, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// ListSources lists job sources.
func (s *Service) ListSources(ctx context.Context, tenantID string, limit, offset int) ([]models.JobSource, error) {
	return s.repo.List(ctx, tenantID, limit, offset)
}

// UpdateSource updates a job source.
func (s *Service) UpdateSource(ctx context.Context, tenantID, id string, req models.UpdateJobSourceRequest) (*models.JobSource, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Type != nil {
		updates["type"] = *req.Type
	}
	if req.Config != nil {
		cfg, err := repository.MarshalJSONConfig(*req.Config)
		if err != nil {
			return nil, err
		}
		updates["config"] = cfg
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
		if *req.Enabled {
			updates["status"] = "active"
		} else {
			updates["status"] = "disabled"
		}
	}
	if len(updates) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}
	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

// DeleteSource deletes a job source.
func (s *Service) DeleteSource(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// TriggerSource manually triggers a job source.
func (s *Service) TriggerSource(ctx context.Context, tenantID, id string, payload map[string]interface{}) (*models.JobSourceEvent, error) {
	src, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if !src.Enabled {
		return nil, fmt.Errorf("source %s is disabled", id)
	}
	ps, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	event := &models.JobSourceEvent{
		TenantID:   tenantID,
		SourceID:   id,
		Payload:    string(ps),
		Status:     "received",
		ReceivedAt: time.Now().UTC(),
	}
	if err := s.repo.CreateEvent(ctx, event); err != nil {
		return nil, err
	}
	s.logger.Info("job source triggered", zap.String("source_id", id), zap.String("event_id", event.ID))
	return event, nil
}

// GetSourceEvents lists events for a source.
func (s *Service) GetSourceEvents(ctx context.Context, tenantID, sourceID string, limit, offset int) ([]models.JobSourceEvent, error) {
	return s.repo.ListEvents(ctx, tenantID, sourceID, limit, offset)
}

// Repository is the package-level alias for the repository package to access helpers.
var repository = repoAlias{}

type repoAlias struct{}

func (repoAlias) MarshalJSONConfig(cfg map[string]string) (string, error) {
	if cfg == nil {
		return "{}", nil
	}
	data, err := json.Marshal(cfg)
	if err != nil {
		return "", fmt.Errorf("failed to marshal config: %w", err)
	}
	return string(data), nil
}

// NewNullTime creates a sql.NullTime from a pointer or nil.
func NewNullTime(t *time.Time) *sql.NullTime {
	if t == nil {
		return (*sql.NullTime)(nil)
	}
	return &sql.NullTime{Time: *t, Valid: true}
}

// =============================================================================
// JobSourceManager
// =============================================================================

// JobSourceManager holds a registry of IJobSource implementations.
type JobSourceManager struct {
	sources map[string]IJobSource
	mu      sync.RWMutex
	logger  *zap.Logger
	repo    RepositoryInterface
}

func NewJobSourceManager(repo RepositoryInterface, logger *zap.Logger) *JobSourceManager {
	m := &JobSourceManager{
		sources: make(map[string]IJobSource),
		repo:    repo,
		logger:  logger,
	}
	m.Register(&ManualSource{})
	m.Register(&ScheduleSource{})
	m.Register(&WebhookSource{})
	m.Register(&EventTriggerSource{})
	return m
}

func (m *JobSourceManager) Register(s IJobSource) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sources[s.Type()] = s
	m.logger.Info("job source registered", zap.String("type", s.Type()), zap.String("name", s.Name()))
}

func (m *JobSourceManager) Get(stype string) (IJobSource, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	s, ok := m.sources[stype]
	return s, ok
}

// =============================================================================
// Source implementations
// =============================================================================

// ManualSource is triggered via explicit API call.
type ManualSource struct{}

func (s *ManualSource) Name() string      { return "manual" }
func (s *ManualSource) Type() string      { return "manual" }
func (s *ManualSource) Initialize(ctx context.Context, config map[string]string) error { return nil }
func (s *ManualSource) StartListening(ctx context.Context, handler func(map[string]interface{})) error { return nil }
func (s *ManualSource) Stop() error { return nil }

// ScheduleSource fires based on a cron schedule.
type ScheduleSource struct {
	cronExpr string
	ticker   *time.Ticker
	stopCh   chan struct{}
	handler  func(map[string]interface{})
}

func (s *ScheduleSource) Name() string      { return "schedule" }
func (s *ScheduleSource) Type() string      { return "schedule" }
func (s *ScheduleSource) Initialize(ctx context.Context, config map[string]string) error {
	s.cronExpr = config["cron_expr"]
	if s.cronExpr == "" {
		return fmt.Errorf("cron_expr required for schedule source")
	}
	return nil
}
func (s *ScheduleSource) StartListening(ctx context.Context, handler func(map[string]interface{})) error {
	s.handler = handler
	s.stopCh = make(chan struct{})
	// Simple interval fallback: every hour (full cron parsing deferred to cron module)
	s.ticker = time.NewTicker(1 * time.Hour)
	go func() {
		for {
			select {
			case <-s.ticker.C:
				if s.handler != nil {
					s.handler(map[string]interface{}{"type": "schedule", "cron_expr": s.cronExpr})
				}
			case <-s.stopCh:
				return
			case <-ctx.Done():
				return
			}
		}
	}()
	return nil
}
func (s *ScheduleSource) Stop() error {
	if s.ticker != nil {
		s.ticker.Stop()
	}
	close(s.stopCh)
	return nil
}

// WebhookSource listens for incoming HTTP webhook payloads.
type WebhookSource struct {
	port    string
	stopCh  chan struct{}
	handler func(map[string]interface{})
}

func (s *WebhookSource) Name() string      { return "webhook" }
func (s *WebhookSource) Type() string      { return "webhook" }
func (s *WebhookSource) Initialize(ctx context.Context, config map[string]string) error {
	s.port = config["port"]
	if s.port == "" {
		s.port = "0"
	}
	s.stopCh = make(chan struct{})
	return nil
}
func (s *WebhookSource) StartListening(ctx context.Context, handler func(map[string]interface{})) error {
	s.handler = handler
	go func() {
		// Webhook listener placeholder: real implementation would start an HTTP server.
		<-ctx.Done()
	}()
	return nil
}
func (s *WebhookSource) Stop() error {
	close(s.stopCh)
	return nil
}

// EventTriggerSource subscribes to internal event bus.
type EventTriggerSource struct {
	eventType string
	stopCh    chan struct{}
	handler   func(map[string]interface{})
}

func (s *EventTriggerSource) Name() string      { return "event_trigger" }
func (s *EventTriggerSource) Type() string      { return "event_trigger" }
func (s *EventTriggerSource) Initialize(ctx context.Context, config map[string]string) error {
	s.eventType = config["event_type"]
	if s.eventType == "" {
		return fmt.Errorf("event_type required for event_trigger source")
	}
	s.stopCh = make(chan struct{})
	return nil
}
func (s *EventTriggerSource) StartListening(ctx context.Context, handler func(map[string]interface{})) error {
	s.handler = handler
	go func() {
		<-ctx.Done()
	}()
	return nil
}
func (s *EventTriggerSource) Stop() error {
	close(s.stopCh)
	return nil
}

// =============================================================================
// Service tests (compile-time interface check)
// =============================================================================

var _ IJobSource = (*ManualSource)(nil)
var _ IJobSource = (*ScheduleSource)(nil)
var _ IJobSource = (*WebhookSource)(nil)
var _ IJobSource = (*EventTriggerSource)(nil)
