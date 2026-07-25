package tenantutil

import "context"

type tenantKey struct{}

// WithContext adds the tenant ID to the context.
func WithContext(ctx context.Context, tenantID string) context.Context {
	return context.WithValue(ctx, tenantKey{}, tenantID)
}

// FromContext retrieves the tenant ID from the context.
// Returns empty string if not set or not a string.
func FromContext(ctx context.Context) string {
	if v, ok := ctx.Value(tenantKey{}).(string); ok {
		return v
	}
	return ""
}
