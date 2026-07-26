package sso

import (
	"context"
	"fmt"
	"math"
	"net"
	"sync"
	"time"
)

// GeoLoginDetector detects unusual login locations and triggers alerts.
type GeoLoginDetector struct {
	store    GeoLoginStore
	notifier GeoAlertNotifier
	config   GeoLoginConfig
	mu       sync.RWMutex
	// In-memory cache of recent login locations per user (for fast lookup)
	recentLogins map[string][]*LoginLocation // key: tenantID:userID
}

// GeoLoginConfig holds geo-login detection configuration.
type GeoLoginConfig struct {
	// MaxDistanceKm is the maximum travel distance (km) between logins within TimeWindow.
	// Default: 500km.
	MaxDistanceKm float64 `json:"max_distance_km"`
	// TimeWindow is the time window for impossible travel detection. Default: 1 hour.
	TimeWindow time.Duration `json:"time_window"`
	// AlertOnNewCountry alerts when login is from a new country. Default: true.
	AlertOnNewCountry bool `json:"alert_on_new_country"`
	// AlertOnNewCity alerts when login is from a new city. Default: false.
	AlertOnNewCity bool `json:"alert_on_new_city"`
	// BlockedCountries is a list of country codes to block. Default: empty.
	BlockedCountries []string `json:"blocked_countries,omitempty"`
	// AllowedCountries restricts logins to these countries. Default: empty (all allowed).
	AllowedCountries []string `json:"allowed_countries,omitempty"`
	// HistorySize is how many recent logins to keep per user. Default: 50.
	HistorySize int `json:"history_size"`
}

// GeoLoginStore provides persistence for login locations.
type GeoLoginStore interface {
	RecordLogin(ctx context.Context, loc *LoginLocation) error
	GetRecentLogins(ctx context.Context, tenantID, userID string, since time.Time) ([]*LoginLocation, error)
	GetUserCountries(ctx context.Context, tenantID, userID string) ([]string, error)
}

// GeoAlertNotifier sends alerts for suspicious logins.
type GeoAlertNotifier interface {
	NotifySuspiciousLogin(ctx context.Context, alert *GeoAlert) error
}

// LoginLocation represents a login event with geographic information.
type LoginLocation struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	IPAddress string    `json:"ip_address" db:"ip_address"`
	Country   string    `json:"country" db:"country"`
	City      string    `json:"city" db:"city"`
	Latitude  float64   `json:"latitude" db:"latitude"`
	Longitude float64   `json:"longitude" db:"longitude"`
	ISP       string    `json:"isp" db:"isp"`
	UserAgent string    `json:"user_agent" db:"user_agent"`
	LoginAt   time.Time `json:"login_at" db:"login_at"`
}

// GeoAlert represents a suspicious login alert.
type GeoAlert struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenant_id"`
	UserID      string    `json:"user_id"`
	AlertType   string    `json:"alert_type"`
	Severity    string    `json:"severity"`
	Description string    `json:"description"`
	CurrentLoc  *LoginLocation `json:"current_location"`
	PreviousLoc *LoginLocation `json:"previous_location,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// GeoIPResolver resolves IP addresses to geographic locations.
type GeoIPResolver interface {
	Resolve(ctx context.Context, ip string) (*GeoIPResult, error)
}

// GeoIPResult represents the result of a GeoIP lookup.
type GeoIPResult struct {
	Country   string  `json:"country"`
	City      string  `json:"city"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	ISP       string  `json:"isp"`
}

// NewGeoLoginDetector creates a new geo-login detector.
func NewGeoLoginDetector(store GeoLoginStore, notifier GeoAlertNotifier, config GeoLoginConfig) *GeoLoginDetector {
	if config.MaxDistanceKm == 0 {
		config.MaxDistanceKm = 500
	}
	if config.TimeWindow == 0 {
		config.TimeWindow = 1 * time.Hour
	}
	if config.HistorySize == 0 {
		config.HistorySize = 50
	}
	config.AlertOnNewCountry = true // default

	return &GeoLoginDetector{
		store:        store,
		notifier:     notifier,
		config:       config,
		recentLogins: make(map[string][]*LoginLocation),
	}
}

// CheckLogin evaluates a login event for suspicious geographic patterns.
// Returns alerts if suspicious activity is detected.
func (d *GeoLoginDetector) CheckLogin(ctx context.Context, loc *LoginLocation) ([]*GeoAlert, error) {
	var alerts []*GeoAlert

	// 1. Check country blocklist
	if d.isCountryBlocked(loc.Country) {
		alert := &GeoAlert{
			ID:          fmt.Sprintf("geo_%s_%d", loc.UserID, time.Now().UnixNano()),
			TenantID:    loc.TenantID,
			UserID:      loc.UserID,
			AlertType:   "blocked-country",
			Severity:    "critical",
			Description: fmt.Sprintf("Login from blocked country: %s", loc.Country),
			CurrentLoc:  loc,
			CreatedAt:   time.Now(),
		}
		alerts = append(alerts, alert)
	}

	// 2. Check country allowlist
	if !d.isCountryAllowed(loc.Country) {
		alert := &GeoAlert{
			ID:          fmt.Sprintf("geo_%s_%d", loc.UserID, time.Now().UnixNano()),
			TenantID:    loc.TenantID,
			UserID:      loc.UserID,
			AlertType:   "disallowed-country",
			Severity:    "high",
			Description: fmt.Sprintf("Login from non-allowed country: %s", loc.Country),
			CurrentLoc:  loc,
			CreatedAt:   time.Now(),
		}
		alerts = append(alerts, alert)
	}

	// 3. Get recent logins for impossible travel detection
	since := time.Now().Add(-d.config.TimeWindow)
	recentLogins, err := d.store.GetRecentLogins(ctx, loc.TenantID, loc.UserID, since)
	if err != nil {
		return nil, fmt.Errorf("get recent logins: %w", err)
	}

	// 4. Check impossible travel
	for _, recent := range recentLogins {
		if recent.IPAddress == loc.IPAddress {
			continue // same IP, skip
		}

		distance := HaversineDistance(recent.Latitude, recent.Longitude, loc.Latitude, loc.Longitude)
		timeDiff := loc.LoginAt.Sub(recent.LoginAt).Hours()

		if timeDiff < 0 {
			timeDiff = -timeDiff
		}
		if timeDiff == 0 {
			timeDiff = 0.001 // avoid division by zero
		}

		// Speed in km/h (commercial flight ~900 km/h)
		speed := distance / timeDiff
		if distance > d.config.MaxDistanceKm && speed > 1000 {
			alert := &GeoAlert{
				ID:       fmt.Sprintf("geo_%s_%d", loc.UserID, time.Now().UnixNano()),
				TenantID: loc.TenantID,
				UserID:   loc.UserID,
				AlertType: "impossible-travel",
				Severity:  "critical",
				Description: fmt.Sprintf(
					"Impossible travel detected: %.0fkm in %.1f hours (%.0f km/h) from %s to %s",
					distance, timeDiff, speed, recent.City, loc.City,
				),
				CurrentLoc:  loc,
				PreviousLoc: recent,
				CreatedAt:   time.Now(),
			}
			alerts = append(alerts, alert)
			break // one impossible travel alert is enough
		}
	}

	// 5. Check new country
	if d.config.AlertOnNewCountry {
		knownCountries, err := d.store.GetUserCountries(ctx, loc.TenantID, loc.UserID)
		if err == nil && !contains(knownCountries, loc.Country) && len(knownCountries) > 0 {
			alert := &GeoAlert{
				ID:          fmt.Sprintf("geo_%s_%d", loc.UserID, time.Now().UnixNano()),
				TenantID:    loc.TenantID,
				UserID:      loc.UserID,
				AlertType:   "new-country",
				Severity:    "medium",
				Description: fmt.Sprintf("Login from new country: %s (previously seen in: %v)", loc.Country, knownCountries),
				CurrentLoc:  loc,
				CreatedAt:   time.Now(),
			}
			alerts = append(alerts, alert)
		}
	}

	// 6. Record the login
	if err := d.store.RecordLogin(ctx, loc); err != nil {
		return nil, fmt.Errorf("record login: %w", err)
	}

	// 7. Send alerts
	for _, alert := range alerts {
		if d.notifier != nil {
			_ = d.notifier.NotifySuspiciousLogin(ctx, alert)
		}
	}

	return alerts, nil
}

func (d *GeoLoginDetector) isCountryBlocked(country string) bool {
	for _, blocked := range d.config.BlockedCountries {
		if blocked == country {
			return true
		}
	}
	return false
}

func (d *GeoLoginDetector) isCountryAllowed(country string) bool {
	if len(d.config.AllowedCountries) == 0 {
		return true // all allowed
	}
	for _, allowed := range d.config.AllowedCountries {
		if allowed == country {
			return true
		}
	}
	return false
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// HaversineDistance calculates the great-circle distance between two points on Earth.
// Returns distance in kilometers.
func HaversineDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadiusKm = 6371.0

	dLat := toRadians(lat2 - lat1)
	dLon := toRadians(lon2 - lon1)

	lat1Rad := toRadians(lat1)
	lat2Rad := toRadians(lat2)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return earthRadiusKm * c
}

func toRadians(deg float64) float64 {
	return deg * math.Pi / 180
}

// StaticGeoIPResolver is a simple in-memory GeoIP resolver for testing.
// In production, use MaxMind GeoIP2 or similar.
type StaticGeoIPResolver struct {
	entries map[string]*GeoIPResult
}

// NewStaticGeoIPResolver creates a static GeoIP resolver.
func NewStaticGeoIPResolver() *StaticGeoIPResolver {
	return &StaticGeoIPResolver{
		entries: make(map[string]*GeoIPResult),
	}
}

// Add adds a static IP-to-location mapping.
func (r *StaticGeoIPResolver) Add(ip string, result *GeoIPResult) {
	r.entries[ip] = result
}

// Resolve resolves an IP to a geographic location.
func (r *StaticGeoIPResolver) Resolve(ctx context.Context, ip string) (*GeoIPResult, error) {
	if result, ok := r.entries[ip]; ok {
		return result, nil
	}
	// Check if it's a private IP
	if isPrivateIP(ip) {
		return &GeoIPResult{
			Country: "Private",
			City:    "Private Network",
		}, nil
	}
	return nil, fmt.Errorf("geo: no data for IP %s", ip)
}

func isPrivateIP(ipStr string) bool {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return false
	}
	privateRanges := []string{
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
		"127.0.0.0/8",
		"::1/128",
		"fc00::/7",
	}
	for _, cidr := range privateRanges {
		_, network, _ := net.ParseCIDR(cidr)
		if network != nil && network.Contains(ip) {
			return true
		}
	}
	return false
}
