package idempotency

import (
	"crypto/md5"
	"encoding/hex"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Gin middleware that enforces HTTP-level idempotency.  Clients send an
// `Idempotency-Key` header; the first request is executed normally and
// its response is cached.  Subsequent requests with the same key are
// replayed from cache without invoking the handler.

const (
	// DefaultIdempotencyKeyHeader is the header name the middleware
	// looks for.
	DefaultIdempotencyKeyHeader = "Idempotency-Key"

	// IdempotencyReplayHeader is added to replayed responses to let
	// clients know they are receiving a cached response.
	IdempotencyReplayHeader = "X-Idempotency-Replay"
)

// MiddlewareOption configures the Gin middleware.
type MiddlewareOption func(*middlewareOpts)

type middlewareOpts struct {
	store          Store
	ttl            time.Duration
	keyExtractor   func(c *gin.Context) string
	methods        map[string]bool
	excludePaths   map[string]bool
	requiredHeader bool // return 400 if key header is missing
}

func defaultMiddlewareOpts() *middlewareOpts {
	methods := map[string]bool{
		http.MethodPost:   true,
		http.MethodPut:    true,
		http.MethodDelete: true,
	}
	return &middlewareOpts{
		store:          NewMemoryStore(),
		ttl:            24 * time.Hour,
		keyExtractor:   nil,
		methods:        methods,
		excludePaths:   map[string]bool{},
		requiredHeader: false,
	}
}

// WithStore sets the backing store.  Defaults to MemoryStore.
func WithStore(store Store) MiddlewareOption {
	return func(o *middlewareOpts) { o.store = store }
}

// WithTTL sets the cache TTL.  Defaults to 24 hours.
func WithTTL(ttl time.Duration) MiddlewareOption {
	return func(o *middlewareOpts) { o.ttl = ttl }
}

// WithKeyExtractor overrides how the idempotency key is derived from the
// request.  The default behaviour is: header value → fallback to MD5
// digest of Method+URI+Body.
func WithKeyExtractor(extractor func(c *gin.Context) string) MiddlewareOption {
	return func(o *middlewareOpts) { o.keyExtractor = extractor }
}

// WithMethods restricts idempotency to the given HTTP methods.  Defaults
// to POST, PUT, DELETE.
func WithMethods(methods ...string) MiddlewareOption {
	return func(o *middlewareOpts) {
		m := make(map[string]bool, len(methods))
		for _, v := range methods {
			m[v] = true
		}
		o.methods = m
	}
}

// WithExcludePaths skips idempotency for the given path prefixes.
func WithExcludePaths(paths ...string) MiddlewareOption {
	return func(o *middlewareOpts) {
		for _, p := range paths {
			o.excludePaths[p] = true
		}
	}
}

// WithRequiredHeader returns a 400 Bad Request when the Idempotency-Key
// header is missing for an in-scope method.
func WithRequiredHeader() MiddlewareOption {
	return func(o *middlewareOpts) { o.requiredHeader = true }
}

// Middleware returns a Gin handler function that implements idempotency.
func Middleware(opts ...MiddlewareOption) gin.HandlerFunc {
	o := defaultMiddlewareOpts()
	for _, fn := range opts {
		fn(o)
	}

	return func(c *gin.Context) {
		if !o.methods[c.Request.Method] {
			c.Next()
			return
		}
		if o.shouldSkip(c.Request.URL.Path) {
			c.Next()
			return
		}

		key := o.resolveKey(c)
		if key == "" {
			if o.requiredHeader {
				c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
					"error":   "idempotency_key_required",
					"message": "Header " + DefaultIdempotencyKeyHeader + " is required for this method",
				})
				return
			}
			c.Next()
			return
		}

		// Check cache.
		payload, err := o.store.Get(IdempotencyKey(key))
		if err == nil {
			// Replay cached response.
			o.replayResponse(c, payload)
			c.Abort()
			return
		}

		// First request: execute handler, then cache.
		cacheWriter := &responseCapture{ResponseWriter: c.Writer, body: nil}
		c.Writer = cacheWriter

		c.Next()

		// Only cache successful responses (2xx / 3xx).
		status := c.Writer.Status()
		if status >= 200 && status < 400 {
			_ = o.store.Set(IdempotencyKey(key), &ResponsePayload{
				StatusCode:  status,
				Headers:     cacheWriter.headers,
				Body:        cacheWriter.body,
				ContentType: c.Writer.Header().Get("Content-Type"),
			}, o.ttl)
		}
	}
}

func (o *middlewareOpts) shouldSkip(path string) bool {
	for prefix := range o.excludePaths {
		if len(path) >= len(prefix) && path[:len(prefix)] == prefix {
			return true
		}
	}
	return false
}

func (o *middlewareOpts) resolveKey(c *gin.Context) string {
	if o.keyExtractor != nil {
		return o.keyExtractor(c)
	}

	// Prefer explicit header.
	header := c.GetHeader(DefaultIdempotencyKeyHeader)
	if header != "" {
		return header
	}


	// When requiredHeader is set, do NOT fall back — caller returns 400.
	if o.requiredHeader {
		return ""
	}
	// Fallback: deterministic digest of method + URI + body.
	bodyBytes, _ := c.GetRawData()
	c.Request.Body = newBodyReader(bodyBytes)

	digest := md5.New()
	digest.Write([]byte(c.Request.Method))
	digest.Write([]byte(c.Request.RequestURI))
	digest.Write(bodyBytes)
	return "auto:" + hex.EncodeToString(digest.Sum(nil))
}

func (o *middlewareOpts) replayResponse(c *gin.Context, p *ResponsePayload) {
	c.Writer.WriteHeader(p.StatusCode)
	for k, vals := range p.Headers {
		for _, v := range vals {
			c.Writer.Header().Set(k, v)
		}
	}
	if p.ContentType != "" {
		c.Writer.Header().Set("Content-Type", p.ContentType)
	}
	c.Writer.Header().Set(IdempotencyReplayHeader, "true")
	c.Writer.Write(p.Body)
}

// ---- responseCapture proxies gin.ResponseWriter so we can capture
// ---- the body written by the handler.

type responseCapture struct {
	gin.ResponseWriter
	body    []byte
	headers map[string][]string
}

func (rc *responseCapture) Write(b []byte) (int, error) {
	rc.body = append(rc.body, b...)
	return rc.ResponseWriter.Write(b)
}

func (rc *responseCapture) WriteHeader(code int) {
	if rc.headers == nil {
		rc.headers = make(map[string][]string)
	}
	for k, vals := range rc.ResponseWriter.Header() {
		rc.headers[k] = vals
	}
	rc.ResponseWriter.WriteHeader(code)
}

// newBodyReader wraps a []byte into an io.ReadCloser for body replay.
type bodyReader struct {
	data []byte
	pos  int
}

func newBodyReader(data []byte) *bodyReader {
	return &bodyReader{data: data}
}

func (r *bodyReader) Read(p []byte) (int, error) {
	if r.pos >= len(r.data) {
		return 0, io.EOF
	}
	n := copy(p, r.data[r.pos:])
	r.pos += n
	return n, nil
}

func (r *bodyReader) Close() error {
	return nil
}
