// Package handler provides the CMDB attribute value handler service.
// It manages a registry of per-type AttributeValueHandlers and exposes CRUD
// operations backed by the repository.
package handler

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"orion/platform-svc-go/internal/cmdb-attr-handler/valhandlers"
	"orion/platform-svc-go/internal/cmdb-attr-handler/models"
	"orion/platform-svc-go/internal/cmdb-attr-handler/repository"

	"go.uber.org/zap"
)

var (
	ErrUnknownType  = errors.New("unknown attribute type")
	ErrInvalidValue = errors.New("invalid attribute value")
	ErrNotFound     = repository.ErrNotFound
)

// Service is the CMDB attribute value handler service with a factory-registry
// of per-type handlers and repository-backed CRUD.
type Service struct {
	repo     *repository.Repository
	logger   *zap.Logger
	mu       sync.RWMutex
	handlers map[string]handlers.AttributeValueHandler
}

// NewService creates a Service with all built-in type handlers registered.
func NewService(repo *repository.Repository, logger *zap.Logger) *Service {
	s := &Service{
		repo:     repo,
		logger:   logger,
		handlers: make(map[string]handlers.AttributeValueHandler),
	}
	// Register the built-in type handlers
	s.Register(stringValueHandler)
	s.Register(numberValueHandler)
	s.Register(booleanValueHandler)
	s.Register(datetimeValueHandler)
	s.Register(enumValueHandler)
	s.Register(multiselectValueHandler)
	s.Register(referenceValueHandler)
	s.Register(jsonValueHandler)
	s.Register(arrayValueHandler)
	s.Register(binaryValueHandler)
	s.Register(passwordValueHandler)
	s.Register(ipValueHandler)
	s.Register(emailValueHandler)
	s.Register(urlValueHandler)
	s.Register(percentageValueHandler)
	s.Register(memoryValueHandler)
	s.Register(diskValueHandler)
	s.Register(cpuValueHandler)
	s.Register(versionValueHandler)
	s.Register(macValueHandler)
	s.Register(uuidValueHandler)
	s.Register(tagsValueHandler)
	s.Register(dateValueHandler)
	return s
}

// Register adds a custom type handler (useful for extensions).
func (s *Service) Register(h handlers.AttributeValueHandler) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.handlers[h.Type()] = h
}

// GetHandlerInfo returns info about a registered type handler.
func (s *Service) GetHandlerInfo(attrType string) (*models.HandlerInfo, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if _, ok := s.handlers[attrType]; !ok {
		return nil, fmt.Errorf("%w: %s", ErrUnknownType, attrType)
	}
	return &models.HandlerInfo{
		Type:        attrType,
		Description: attrType + " attribute value handler",
	}, nil
}

// ListHandlerInfos returns all registered handlers.
func (s *Service) ListHandlerInfos() []models.HandlerInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	info := make([]models.HandlerInfo, 0, len(s.handlers))
	for t, h := range s.handlers {
		info = append(info, models.HandlerInfo{
			Type:        t,
			Description: h.Type() + " attribute value handler",
		})
	}
	return info
}

// GetHandler returns the handler for a given type.
func (s *Service) GetHandler(attrType string) (handlers.AttributeValueHandler, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	h, ok := s.handlers[attrType]
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrUnknownType, attrType)
	}
	return h, nil
}

// Validate validates a value against its type handler.
func (s *Service) Validate(ctx context.Context, tenantID, ciID, attrID, attrType, value string) error {
	if tenantID == "" {
		return fmt.Errorf("tenant_id is required")
	}
	if ciID == "" {
		return fmt.Errorf("ci_id is required")
	}
	if attrID == "" {
		return fmt.Errorf("attribute_id is required")
	}
	if attrType == "" {
		return fmt.Errorf("attribute type is required")
	}

	h, err := s.GetHandler(attrType)
	if err != nil {
		return err
	}

	if err := h.Validate(value); err != nil {
		return fmt.Errorf("%w for type %s: %w", ErrInvalidValue, attrType, err)
	}

	s.logger.Info("validated attribute value",
		zap.String("tenant_id", tenantID),
		zap.String("ci_id", ciID),
		zap.String("attribute_id", attrID),
		zap.String("type", attrType),
	)

	return nil
}

// SetValue sets (or upserts) an attribute value for a CI.
func (s *Service) SetValue(ctx context.Context, tenantID, ciID, attrID, attrType, value string) (*models.CMDBAttributeValue, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	if ciID == "" {
		return nil, fmt.Errorf("ci_id is required")
	}
	if attrID == "" {
		return nil, fmt.Errorf("attribute_id is required")
	}
	if attrType == "" {
		return nil, fmt.Errorf("attribute type is required")
	}

	// Validate
	h, err := s.GetHandler(attrType)
	if err != nil {
		return nil, err
	}
	if err := h.Validate(value); err != nil {
		return nil, fmt.Errorf("%w for type %s: %w", ErrInvalidValue, attrType, err)
	}

	// Upsert
	if err := s.repo.Upsert(ctx, tenantID, ciID, attrID, value, attrType); err != nil {
		return nil, fmt.Errorf("upsert attribute value failed: %w", err)
	}

	attr, err := s.repo.Get(ctx, tenantID, ciID, attrID)
	if err != nil {
		return nil, err
	}

	s.logger.Info("set attribute value",
		zap.String("tenant_id", tenantID),
		zap.String("ci_id", ciID),
		zap.String("attribute_id", attrID),
		zap.String("type", attrType),
	)

	return attr, nil
}

// GetValue retrieves an attribute value for a CI.
func (s *Service) GetValue(ctx context.Context, tenantID, ciID, attrID string) (*models.CMDBAttributeValue, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	if ciID == "" {
		return nil, fmt.Errorf("ci_id is required")
	}
	if attrID == "" {
		return nil, fmt.Errorf("attribute_id is required")
	}

	attr, err := s.repo.Get(ctx, tenantID, ciID, attrID)
	if err != nil {
		return nil, err
	}
	return attr, nil
}

// ListValues lists all attribute values for a CI, paginated.
func (s *Service) ListValues(ctx context.Context, tenantID, ciID string, offset, limit int) ([]models.CMDBAttributeValue, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	if ciID == "" {
		return nil, fmt.Errorf("ci_id is required")
	}
	return s.repo.ListByCI(ctx, tenantID, ciID, offset, limit)
}

// CountValues returns the number of attribute values for a CI.
func (s *Service) CountValues(ctx context.Context, tenantID, ciID string) (int, error) {
	if tenantID == "" {
		return 0, fmt.Errorf("tenant_id is required")
	}
	if ciID == "" {
		return 0, fmt.Errorf("ci_id is required")
	}
	return s.repo.CountByCI(ctx, tenantID, ciID)
}

// DeleteValue deletes an attribute value for a CI.
func (s *Service) DeleteValue(ctx context.Context, tenantID, ciID, attrID string) error {
	if tenantID == "" {
		return fmt.Errorf("tenant_id is required")
	}
	if ciID == "" {
		return fmt.Errorf("ci_id is required")
	}
	if attrID == "" {
		return fmt.Errorf("attribute_id is required")
	}

	attr, err := s.repo.Get(ctx, tenantID, ciID, attrID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil // silent success on already-deleted
		}
		return err
	}

	if err := s.repo.Delete(ctx, tenantID, ciID, attrID); err != nil {
		return fmt.Errorf("delete attribute value failed: %w", err)
	}

	s.logger.Info("deleted attribute value",
		zap.String("tenant_id", tenantID),
		zap.String("ci_id", ciID),
		zap.String("attribute_id", attrID),
		zap.String("type", attr.Type),
	)

	return nil
}

// ParseValue parses a raw string value using the type handler.
func (s *Service) ParseValue(attrType, value string) (interface{}, error) {
	h, err := s.GetHandler(attrType)
	if err != nil {
		return nil, err
	}
	return h.Parse(value)
}

// SerializeValue serialises a typed value using the type handler.
func (s *Service) SerializeValue(attrType string, v interface{}) (string, error) {
	h, err := s.GetHandler(attrType)
	if err != nil {
		return "", err
	}
	return h.Serialize(v), nil
}

// Built-in handler implementations (singleton values via public constructors).
var (
	stringValueHandler       = handlers.NewStringValueHandler()
	numberValueHandler       = handlers.NewNumberValueHandler()
	booleanValueHandler      = handlers.NewBooleanValueHandler()
	datetimeValueHandler     = handlers.NewDatetimeValueHandler()
	enumValueHandler         = handlers.NewEnumValueHandler()
	multiselectValueHandler  = handlers.NewMultiselectValueHandler()
	referenceValueHandler    = handlers.NewReferenceValueHandler()
	jsonValueHandler         = handlers.NewJsonValueHandler()
	arrayValueHandler        = handlers.NewArrayValueHandler()
	binaryValueHandler       = handlers.NewBinaryValueHandler()
	passwordValueHandler     = handlers.NewPasswordValueHandler()
	ipValueHandler           = handlers.NewIpValueHandler()
	emailValueHandler        = handlers.NewEmailValueHandler()
	urlValueHandler          = handlers.NewUrlValueHandler()
	percentageValueHandler   = handlers.NewPercentageValueHandler()
	memoryValueHandler       = handlers.NewMemoryValueHandler()
	diskValueHandler         = handlers.NewDiskValueHandler()
	cpuValueHandler          = handlers.NewCpuValueHandler()
	versionValueHandler      = handlers.NewVersionValueHandler()
	macValueHandler          = handlers.NewMacValueHandler()
	uuidValueHandler         = handlers.NewUuidValueHandler()
	tagsValueHandler         = handlers.NewTagsValueHandler()
	dateValueHandler         = handlers.NewDateValueHandler()
)
