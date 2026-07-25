package handlers

import (
	"fmt"
	"strconv"
	"strings"
)

// ---------------------------------------------------------------------------
// number parsing helpers
// ---------------------------------------------------------------------------

// parseJSONNumberInt tries to parse a JSON-ish number as int64.
func parseJSONNumberInt(value string) (int64, error) {
	v := strings.TrimSpace(value)
	if v == "" {
		return 0, fmt.Errorf("empty value")
	}
	// Strip trailing .0 for integers encoded as floats
	if strings.HasSuffix(v, ".0") && !strings.Contains(v[:len(v)-2], ".") {
		v = v[:len(v)-2]
	}
	return strconv.ParseInt(v, 10, 64)
}

// parseJSONNumberFloat parses a JSON-ish number as float64.
func parseJSONNumberFloat(value string) (float64, error) {
	v := strings.TrimSpace(value)
	if v == "" {
		return 0, fmt.Errorf("empty value")
	}
	return strconv.ParseFloat(v, 64)
}

// ---------------------------------------------------------------------------
// resource size parsing helpers (memory, disk)
// ---------------------------------------------------------------------------

// parseResourceSize parses a human-readable size string into bytes.
// Accepts: "1GB", "512MB", "256", "100 KiB", etc.
func parseResourceSize(value string) (uint64, error) {
	v := strings.TrimSpace(value)
	if v == "" {
		return 0, nil
	}
	// Strip spaces
	v = strings.ReplaceAll(v, " ", "")
	lower := strings.ToLower(v)

	var multiplier uint64 = 1
	vv := v
	for _, unit := range []string{"tib", "t", "gib", "g", "mib", "m", "kib", "k"} {
		if strings.HasSuffix(lower, unit) {
			switch {
			case unit == "tib":
				multiplier = 1024 * 1024 * 1024 * 1024
			case unit == "t":
				multiplier = 1000 * 1000 * 1000 * 1000
			case unit == "gib":
				multiplier = 1024 * 1024 * 1024
			case unit == "g":
				multiplier = 1000 * 1000 * 1000
			case unit == "mib":
				multiplier = 1024 * 1024
			case unit == "m":
				multiplier = 1000 * 1000
			case unit == "kib":
				multiplier = 1024
			case unit == "k":
				multiplier = 1000
			}
			vv = strings.TrimSuffix(v, v[len(v)-len(unit):])
			break
		}
	}
	if vv == "" {
		return 0, fmt.Errorf("invalid resource size: %q", value)
	}
	// Try int64 first for big values, fallback to float
	i, err := strconv.ParseInt(vv, 10, 64)
	if err != nil {
		f, err := strconv.ParseFloat(vv, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid resource size number: %q", vv)
		}
		return uint64(f * float64(multiplier)), nil
	}
	return uint64(i) * multiplier, nil
}

// ---------------------------------------------------------------------------
// human-readable size formatter
// ---------------------------------------------------------------------------

// formatHumanSize converts bytes to a human-readable string (e.g. "1.5 GiB").
func formatHumanSize(bytes uint64) string {
	const (
		_ = 1
		ki = 1024
		mi = 1024 * ki
		gi = 1024 * mi
		ti = 1024 * gi
	)
	if bytes >= ti {
		return fmt.Sprintf("%.1f TiB", float64(bytes)/float64(ti))
	}
	if bytes >= gi {
		return fmt.Sprintf("%d GiB", bytes/gi)
	}
	if bytes >= mi {
		return fmt.Sprintf("%d MiB", bytes/mi)
	}
	if bytes >= ki {
		return fmt.Sprintf("%d KiB", bytes/ki)
	}
	return fmt.Sprintf("%d B", bytes)
}

// ---------------------------------------------------------------------------
// version parsing helpers
// ---------------------------------------------------------------------------

// parseSemanticVersion splits a version string into major.minor.patch components.
func parseSemanticVersion(value string) (int, int, int, error) {
	v := strings.TrimSpace(value)
	// Strip leading 'v' or 'V'
	v = strings.TrimPrefix(v, "v")
	v = strings.TrimPrefix(v, "V")
	parts := strings.Split(v, ".")
	if len(parts) < 3 {
		// Pad with zeros
		for len(parts) < 3 {
			parts = append(parts, "0")
		}
	}
	major, err := strconv.Atoi(parts[0])
	if err != nil {
		return 0, 0, 0, fmt.Errorf("invalid major version: %q", parts[0])
	}
	minor, err := strconv.Atoi(parts[1])
	if err != nil {
		return 0, 0, 0, fmt.Errorf("invalid minor version: %q", parts[1])
	}
	patch, err := strconv.Atoi(parts[2])
	if err != nil {
		return 0, 0, 0, fmt.Errorf("invalid patch version: %q", parts[2])
	}
	return major, minor, patch, nil
}

// ---------------------------------------------------------------------------
// percentage parsing helpers
// ---------------------------------------------------------------------------

// parsePercentage parses a percentage string and returns a float in [0,100].
// Accepts: "50%", "0.5", "75"
func parsePercentage(value string) (float64, error) {
	v := strings.TrimSpace(value)
	if v == "" {
		return 0, nil
	}
	hasPercent := strings.HasSuffix(v, "%")
	if hasPercent {
		v = strings.TrimSuffix(v, "%")
	}
	f, err := strconv.ParseFloat(strings.TrimSpace(v), 64)
	if err != nil {
		return 0, fmt.Errorf("invalid percentage value: %q", value)
	}
	// If no % sign, treat as a 0-100 value (or clamp 0-1 -> multiply 100)
	if !hasPercent && f >= 0 && f <= 1 {
		f = f * 100
	}
	if f < 0 || f > 100 {
		return 0, fmt.Errorf("percentage out of range [0,100]: %.2f", f)
	}
	return f, nil
}
