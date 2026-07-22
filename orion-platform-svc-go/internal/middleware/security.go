// Package middleware provides Orion-platform-specific Gin middleware.
package middleware

import (
	"github.com/gin-gonic/gin"
)

// ---------------------------------------------------------------------------
// Security Headers
// ---------------------------------------------------------------------------

// DefaultCSP defines the default Content-Security-Policy directive.
// Restricts resource loading to same origin to prevent XSS and data exfiltration.
const DefaultCSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"

// SecurityHeaders returns a Gin middleware that adds standard security
// headers to every HTTP response.
//
// Headers applied:
//   - X-Frame-Options: DENY (prevent clickjacking)
//   - X-Content-Type-Options: nosniff (prevent MIME sniffing)
//   - X-XSS-Protection: 1; mode=block (legacy XSS filter)
//   - Referrer-Policy: strict-origin-when-cross-origin
//   - Content-Security-Policy: restrictive default-src 'self'
//   - Strict-Transport-Security: 1 year with subdomains
//   - Permissions-Policy: disable non-essential browser features
//
// Also removes X-Powered-By to avoid leaking framework information.
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("X-Frame-Options", "DENY")
		c.Writer.Header().Set("X-Content-Type-Options", "nosniff")
		c.Writer.Header().Set("X-XSS-Protection", "1; mode=block")
		c.Writer.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Writer.Header().Set("Content-Security-Policy", DefaultCSP)
		c.Writer.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		c.Writer.Header().Set("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()")
		c.Writer.Header().Del("X-Powered-By")

		c.Next()
	}
}

// CORSForSecurity is a convenience alias providing the default CSP string
// for use in documentation or external configuration.
func DefaultContentSecurityPolicy() string {
	return DefaultCSP
}
