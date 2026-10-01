package util

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"regexp"
	"strconv"
	"time"
)

// GenerateID returns a random hex ID (16 bytes / 32 hex chars).
func GenerateID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// Sleep blocks for the given duration (convenience for porting TS sleep).
func Sleep(d time.Duration) {
	time.Sleep(d)
}

// RetryFn calls fn up to maxRetries+1 times with exponential backoff.
// onRetry is called before each retry with the error and attempt number.
func RetryFn(fn func() error, maxRetries int, initialDelay, maxDelay time.Duration, onRetry func(err error, attempt int)) error {
	var lastErr error
	currentDelay := initialDelay

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if err := fn(); err == nil {
			return nil
		} else {
			lastErr = err
			if attempt < maxRetries {
				if onRetry != nil {
					onRetry(err, attempt+1)
				}
				time.Sleep(currentDelay)
				currentDelay *= 2
				if currentDelay > maxDelay {
					currentDelay = maxDelay
				}
			}
		}
	}
	return lastErr
}

var durationRegex = regexp.MustCompile(`^(\d+)(ms|s|m|h|d)$`)

// ParseDuration parses a duration string like "1h", "30m", "300s", "500ms", "2d".
func ParseDuration(s string) time.Duration {
	matches := durationRegex.FindStringSubmatch(s)
	if matches == nil {
		return 0
	}
	value, _ := strconv.ParseInt(matches[1], 10, 64)
	unit := matches[2]

	var mult time.Duration
	switch unit {
	case "ms":
		mult = time.Millisecond
	case "s":
		mult = time.Second
	case "m":
		mult = time.Minute
	case "h":
		mult = time.Hour
	case "d":
		mult = 24 * time.Hour
	}
	return time.Duration(value) * mult
}

// FormatTimestamp returns a RFC3339 timestamp for the current time.
func FormatTimestamp() string {
	return time.Now().UTC().Format(time.RFC3339)
}

// RetryConfig holds options for RetryFn.
type RetryConfig struct {
	MaxRetries   int
	InitialDelay time.Duration
	MaxDelay     time.Duration
}

// DefaultRetryConfig returns sensible retry defaults.
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxRetries:   3,
		InitialDelay: 1 * time.Second,
		MaxDelay:     30 * time.Second,
	}
}

// StringOrEmpty returns s or "" if empty.
func StringOrEmpty(s string) string {
	if s == "" {
		return ""
	}
	return s
}

// Coalesce returns the first non-empty string.
func Coalesce(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

// MaskString masks a string, showing only the first and last n chars.
func MaskString(s string, visibleChars int) string {
	if len(s) <= visibleChars*2 {
		return fmt.Sprintf("%s***", s[:0])
	}
	return s[:visibleChars] + "***" + s[len(s)-visibleChars:]
}
