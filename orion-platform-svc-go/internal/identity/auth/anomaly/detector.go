package anomaly

import (
	"fmt"
	"sync"
	"time"
)

// AnomalyReport describes a single detected anomaly.
type AnomalyReport struct {
	Type     string
	Severity string
	Detail   string
}

const (
	TypeNewDevice   = "new_device"
	TypeGeoShift    = "geo_shift"
	TypeOffHours    = "off_hours"
	TypeRapidFail   = "rapid_failure"
	SeverityLow     = "low"
	SeverityMedium  = "medium"
	SeverityHigh    = "high"
)

const (
	offHourStart = 2
	offHourEnd   = 5
	rapidThreshold = 3
	rapidWindow    = 5 * time.Minute
)

type loginRecord struct {
	UserAgent string
	IP        string
	Success   bool
	Ts        time.Time
}

type userState struct {
	logins   []loginRecord
	devices  map[string]time.Time // userAgent -> last seen
	geoCache map[string]time.Time // ip prefix -> last seen
	failureMu sync.Mutex
}

// Detector tracks login attempts and surfaces anomalies.
type Detector struct {
	tenants map[string]map[string]*userState
	mu      sync.Mutex
	nowFn   func() time.Time
}

// NewDetector creates a Detector. Pass nil for nowFn to use real time.
func NewDetector(nowFn func() time.Time) *Detector {
	d := &Detector{
		tenants: make(map[string]map[string]*userState),
		nowFn:   nowFn,
	}
	if d.nowFn == nil {
		d.nowFn = time.Now
	}
	return d
}

func (d *Detector) now() time.Time {
	return d.nowFn()
}

func ipPrefix(ip string) string {
	for i, c := range ip {
		if c == '.' {
			return ip[:i]
		}
		if i >= 3 {
			return ip[:3]
		}
	}
	return ip
}

// RecordLogin records a login attempt.
func (d *Detector) RecordLogin(tenantID, username, userAgent, ip string, success bool, ts time.Time) {
	d.mu.Lock()
	defer d.mu.Unlock()
	td, ok := d.tenants[tenantID]
	if !ok {
		td = make(map[string]*userState)
		d.tenants[tenantID] = td
	}
	us, ok := td[username]
	if !ok {
		us = &userState{devices: make(map[string]time.Time), geoCache: make(map[string]time.Time)}
		td[username] = us
	}
	us.logins = append(us.logins, loginRecord{UserAgent: userAgent, IP: ip, Success: success, Ts: ts})
	if userAgent != "" {
		us.devices[userAgent] = ts
	}
	if ip != "" {
		us.geoCache[ipPrefix(ip)] = ts
	}
	// prune old logins (>24h)
	cutoff := ts.Add(-24 * time.Hour)
	idx := 0
	for idx < len(us.logins) && us.logins[idx].Ts.Before(cutoff) {
		idx++
	}
	if idx > 0 {
		us.logins = us.logins[idx:]
	}
}

// DetectAnomalies analyses recorded history for a user.
func (d *Detector) DetectAnomalies(tenantID, username string, window time.Duration) []AnomalyReport {
	d.mu.Lock()
	defer d.mu.Unlock()
	td, ok := d.tenants[tenantID]
	if !ok {
		return nil
	}
	us, ok := td[username]
	if !ok {
		return nil
	}
	now := d.now()
	cutoff := now.Add(-window)
	var reports []AnomalyReport

	// 1. new_device: any UA not seen in last 30 days
	for ua, lastSeen := range us.devices {
		if lastSeen.Before(now.Add(-30 * 24 * time.Hour)) {
			reports = append(reports, AnomalyReport{Type: TypeNewDevice, Severity: SeverityMedium, Detail: "Device not seen in 30 days: " + ua})
		}
	}

	// 2. geo_shift: different IP prefix within 1 hour
	var firstEntry *loginRecord
	for _, rec := range us.logins {
		if rec.Ts.After(cutoff) {
			if firstEntry == nil {
				firstEntry = &rec
			} else if rec.IP != "" && firstEntry.IP != "" && ipPrefix(rec.IP) != ipPrefix(firstEntry.IP) && rec.Ts.Sub(firstEntry.Ts) < time.Hour {
				reports = append(reports, AnomalyReport{Type: TypeGeoShift, Severity: SeverityHigh, Detail: "IP prefix changed within 1h"})
				break
			}
		}
	}

	// 3. off_hours: login between 02:00-05:00 UTC
	for _, rec := range us.logins {
		if rec.Ts.After(cutoff) {
			h := rec.Ts.Hour()
			if h >= offHourStart && h < offHourEnd {
				reports = append(reports, AnomalyReport{Type: TypeOffHours, Severity: SeverityLow, Detail: fmt.Sprintf("Login during off-hours (02:00-05:00 UTC): %s", rec.Ts.Format(time.RFC3339))})
				break
			}
		}
	}

	// 4. rapid_failure: 3+ failures within 5 min
	failCutoff := now.Add(-rapidWindow)
	failures := 0
	for _, rec := range us.logins {
		if !rec.Success && rec.Ts.After(failCutoff) {
			failures++
		}
	}
	if failures >= rapidThreshold {
		reports = append(reports, AnomalyReport{Type: TypeRapidFail, Severity: SeverityHigh, Detail: fmt.Sprintf("%d failed login attempts within 5 minutes", failures)})
	}

	return reports
}
