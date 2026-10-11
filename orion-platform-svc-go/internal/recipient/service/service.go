package service

import (
	"context"
	"errors"
	"time"

	"go.uber.org/zap"

	"orion/platform-svc-go/internal/recipient/models"
	"orion/platform-svc-go/internal/recipient/resolver"
)

// 服务层错误（供 handler 分类）。
var (
	ErrSpecInvalid     = errors.New("E_RECIP_SPEC_INVALID: spec is invalid")
	ErrKindUnknown     = errors.New("E_RECIP_KIND_UNKNOWN: unknown kind")
	ErrParamMissing    = errors.New("E_RECIP_PARAM_MISSING: required parameter missing")
	ErrRefNotFound     = errors.New("E_RECIP_REF_NOT_FOUND: referenced object not found")
	ErrResolveConflict = errors.New("E_RECIP_RESOLVE_CONFLICT: resolve conflict")
	ErrResolverTimeout = errors.New("E_RECIP_RESOLVER_TIMEOUT: resolver timed out")
)

// ResolveTimeout 是解析操作的硬超时。
const ResolveTimeout = 10 * time.Second

// Service 编排 recipient 解析逻辑。
type Service struct {
	registry *resolver.Registry
	log      *zap.Logger
}

// NewService 创建新的 Service。
func NewService(registry *resolver.Registry, log *zap.Logger) *Service {
	if log == nil {
		log = zap.NewNop()
	}
	return &Service{registry: registry, log: log}
}

// Validate 校验 RecipientSpec 是否合法。
func (s *Service) Validate(spec *models.RecipientSpec) error {
	if spec == nil {
		return ErrSpecInvalid
	}
	if spec.Kind == "" {
		return ErrSpecInvalid
	}
	if spec.TenantID == "" {
		return ErrParamMissing
	}
	if _, ok := s.registry.Get(spec.Kind); !ok {
		return ErrKindUnknown
	}
	return nil
}

// Resolve 解析 RecipientSpec 为具体接收人列表。
func (s *Service) Resolve(ctx context.Context, spec *models.RecipientSpec) (*models.ResolveResult, error) {
	if err := s.Validate(spec); err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(ctx, ResolveTimeout)
	defer cancel()

	start := time.Now()
	users, err := s.registry.Resolve(ctx, *spec)
	if err != nil {
		// 传播底层错误码前缀
		if errors.Is(err, context.DeadlineExceeded) {
			s.log.Warn("resolver timeout",
				zap.String("kind", string(spec.Kind)),
				zap.String("tenant_id", spec.TenantID),
				zap.Duration("elapsed", time.Since(start)))
			return nil, ErrResolverTimeout
		}
		s.log.Warn("resolver error",
			zap.String("kind", string(spec.Kind)),
			zap.String("tenant_id", spec.TenantID),
			zap.Error(err))
		return nil, err
	}

	result := &models.ResolveResult{
		ResolvedAt:    time.Now(),
		SpecKind:      spec.Kind,
		ResolvedUsers: users,
		CacheHit:      false,
		TTLSeconds:    3600,
	}

	s.log.Info("recipient resolved",
		zap.String("kind", string(spec.Kind)),
		zap.String("tenant_id", spec.TenantID),
		zap.Int("user_count", len(users)),
		zap.Duration("elapsed", time.Since(start)))

	return result, nil
}

// Kinds 返回所有已注册的 Kind（供 /recipient-resolvers GET 使用）。
func (s *Service) Kinds() []models.Kind {
	return s.registry.Kinds()
}
