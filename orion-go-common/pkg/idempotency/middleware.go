package idempotency

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// Middleware 配置
type Middleware struct {
	checker *Checker
	// TTLResolver 根据路径和方法返回 TTL（秒）
	TTLResolver func(path, method string) int64
	// RequireKey 是否要求必须提供幂等键（默认 false，不提供则跳过）
	RequireKey bool
	// SkipMethods 跳过的 HTTP 方法（默认只处理 POST/PUT/PATCH）
	SkipMethods []string
	// KeyHeader 幂等键请求头名（默认 Idempotency-Key）
	KeyHeader string
	// FailOpen 存储不可用时是否跳过幂等检查（默认 true，避免阻断业务）
	FailOpen bool
	logger   *zap.Logger
}

// Option 中间件配置选项
type Option func(*Middleware)

// WithTTLResolver 设置 TTL 解析器
func WithTTLResolver(resolver func(path, method string) int64) Option {
	return func(m *Middleware) {
		m.TTLResolver = resolver
	}
}

// WithRequireKey 要求必须提供幂等键
func WithRequireKey() Option {
	return func(m *Middleware) {
		m.RequireKey = true
	}
}

// WithSkipMethods 设置跳过的 HTTP 方法
func WithSkipMethods(methods []string) Option {
	return func(m *Middleware) {
		m.SkipMethods = methods
	}
}

// WithKeyHeader 设置幂等键请求头名
func WithKeyHeader(header string) Option {
	return func(m *Middleware) {
		m.KeyHeader = header
	}
}

// WithFailOpen 设置存储不可用时的策略
func WithFailOpen(failOpen bool) Option {
	return func(m *Middleware) {
		m.FailOpen = failOpen
	}
}

// WithLogger 设置日志
func WithLogger(logger *zap.Logger) Option {
	return func(m *Middleware) {
		m.logger = logger
	}
}

// NewMiddleware 创建幂等中间件
func NewMiddleware(checker *Checker, opts ...Option) *Middleware {
	m := &Middleware{
		checker:   checker,
		FailOpen:  true,
		KeyHeader: "Idempotency-Key",
		SkipMethods: []string{"GET", "HEAD", "OPTIONS", "DELETE"},
		TTLResolver: func(path, method string) int64 {
			// 默认 5 分钟
			return 300
		},
		logger: zap.NewNop(),
	}
	for _, opt := range opts {
		opt(m)
	}
	return m
}

// Handle 中间件处理函数
func (m *Middleware) Handle() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 跳过不需要处理的方法
		if m.shouldSkip(c.Request.Method) {
			c.Next()
			return
		}

		// 获取幂等键
		keyID := c.GetHeader(m.KeyHeader)
		if keyID == "" {
			if m.RequireKey {
				c.JSON(http.StatusBadRequest, gin.H{
					"success": false,
					"code":    "IDEMPOTENCY_KEY_REQUIRED",
					"message": "该接口需要幂等键，请在请求头中包含 " + m.KeyHeader,
				})
				c.Abort()
				return
			}
			// 不提供则跳过幂等检查
			c.Next()
			return
		}

		// 读取请求体（用于哈希）
		body, err := io.ReadAll(c.Request.Body)
		if err != nil {
			if m.FailOpen {
				c.Next()
				return
			}
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"code":    "BAD_REQUEST",
				"message": "无法读取请求体",
			})
			c.Abort()
			return
		}
		payloadHash := sha256.Sum256(body)
		hashStr := hex.EncodeToString(payloadHash[:])

		// 恢复请求体
		c.Request.Body = io.NopCloser(bytes.NewBuffer(body))

		// 构建幂等键
		idemKey := Key{
			ID:          keyID,
			Path:        c.Request.URL.Path,
			Method:      c.Request.Method,
			TenantID:    c.GetString("tenant_id"),
			UserID:      c.GetString("user_id"),
			PayloadHash: hashStr,
			TTL:         m.TTLResolver(c.Request.URL.Path, c.Request.Method),
		}

		ctx := c.Request.Context()

		// 检查并锁定
		result, err := m.checker.CheckAndLock(ctx, idemKey)
		if err != nil {
			if m.FailOpen {
				m.logger.Warn("idempotency check failed, falling through",
					zap.Error(err),
					zap.String("key", keyID))
				c.Next()
				return
			}
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"success": false,
				"code":    "IDEMPOTENCY_UNAVAILABLE",
				"message": "幂等服务暂时不可用",
			})
			c.Abort()
			return
		}

		// 已处理过，直接返回缓存响应
		if result.IsProcessed {
			// 设置响应头
			for k, v := range result.ResponseHeaders {
				c.Header(k, v)
			}
			c.Data(result.ResponseCode, c.ContentType(), result.ResponseBody)
			c.Abort()
			return
		}

		// 新请求，继续处理
		c.Next()

		// 请求处理完成后，存储响应
		if c.Writer.Status() >= 200 && c.Writer.Status() < 500 {
			// 记录到日志，由调用方手动 Complete
			m.logger.Info("idempotency: request completed, call Complete to store response",
				zap.String("key", keyID),
				zap.Int("status", c.Writer.Status()))
		}
	}
}

// shouldSkip 检查是否应该跳过
func (m *Middleware) shouldSkip(method string) bool {
	for _, skipMethod := range m.SkipMethods {
		if strings.ToUpper(method) == strings.ToUpper(skipMethod) {
			return true
		}
	}
	return false
}
