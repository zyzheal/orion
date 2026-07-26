package sso

import (
	"context"
	"testing"
	"time"
)

// mockGeoLoginStore implements GeoLoginStore for testing.
type mockGeoLoginStore struct {
	logins    []*LoginLocation
	countries map[string][]string // tenantID:userID -> countries
}

func newMockGeoLoginStore() *mockGeoLoginStore {
	return &mockGeoLoginStore{
		logins:    []*LoginLocation{},
		countries: make(map[string][]string),
	}
}

func (s *mockGeoLoginStore) RecordLogin(ctx context.Context, loc *LoginLocation) error {
	s.logins = append(s.logins, loc)
	key := loc.TenantID + ":" + loc.UserID
	if !contains(s.countries[key], loc.Country) {
		s.countries[key] = append(s.countries[key], loc.Country)
	}
	return nil
}

func (s *mockGeoLoginStore) GetRecentLogins(ctx context.Context, tenantID, userID string, since time.Time) ([]*LoginLocation, error) {
	var result []*LoginLocation
	for _, l := range s.logins {
		if l.TenantID == tenantID && l.UserID == userID && l.LoginAt.After(since) {
			result = append(result, l)
		}
	}
	return result, nil
}

func (s *mockGeoLoginStore) GetUserCountries(ctx context.Context, tenantID, userID string) ([]string, error) {
	key := tenantID + ":" + userID
	return s.countries[key], nil
}

// mockGeoAlertNotifier implements GeoAlertNotifier for testing.
type mockGeoAlertNotifier struct {
	alerts []*GeoAlert
}

func (n *mockGeoAlertNotifier) NotifySuspiciousLogin(ctx context.Context, alert *GeoAlert) error {
	n.alerts = append(n.alerts, alert)
	return nil
}

func TestGeoLoginDetector_NormalLogin(t *testing.T) {
	store := newMockGeoLoginStore()
	notifier := &mockGeoAlertNotifier{}
	detector := NewGeoLoginDetector(store, notifier, GeoLoginConfig{})

	loc := &LoginLocation{
		TenantID:  "t1",
		UserID:    "u1",
		IPAddress: "1.2.3.4",
		Country:   "CN",
		City:      "Shanghai",
		Latitude:  31.23,
		Longitude: 121.47,
		LoginAt:   time.Now(),
	}

	alerts, err := detector.CheckLogin(context.Background(), loc)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// First login should not trigger alerts
	if len(alerts) != 0 {
		t.Errorf("expected 0 alerts for first login, got %d", len(alerts))
	}

	if len(store.logins) != 1 {
		t.Errorf("expected 1 recorded login, got %d", len(store.logins))
	}
}

func TestGeoLoginDetector_ImpossibleTravel(t *testing.T) {
	store := newMockGeoLoginStore()
	notifier := &mockGeoAlertNotifier{}
	detector := NewGeoLoginDetector(store, notifier, GeoLoginConfig{
		MaxDistanceKm: 500,
		TimeWindow:    1 * time.Hour,
	})

	ctx := context.Background()

	// First login: Shanghai
	loc1 := &LoginLocation{
		TenantID:  "t1",
		UserID:    "u1",
		IPAddress: "1.2.3.4",
		Country:   "CN",
		City:      "Shanghai",
		Latitude:  31.23,
		Longitude: 121.47,
		LoginAt:   time.Now().Add(-30 * time.Minute),
	}
	_, _ = detector.CheckLogin(ctx, loc1)

	// Second login: New York (impossible travel in 30 minutes)
	loc2 := &LoginLocation{
		TenantID:  "t1",
		UserID:    "u1",
		IPAddress: "5.6.7.8",
		Country:   "US",
		City:      "New York",
		Latitude:  40.71,
		Longitude: -74.01,
		LoginAt:   time.Now(),
	}
	alerts, err := detector.CheckLogin(ctx, loc2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Should have new-country + impossible-travel alerts
	foundImpossible := false
	for _, a := range alerts {
		if a.AlertType == "impossible-travel" {
			foundImpossible = true
		}
	}
	if !foundImpossible {
		t.Error("expected impossible-travel alert")
	}
}

func TestGeoLoginDetector_BlockedCountry(t *testing.T) {
	store := newMockGeoLoginStore()
	notifier := &mockGeoAlertNotifier{}
	detector := NewGeoLoginDetector(store, notifier, GeoLoginConfig{
		BlockedCountries: []string{"KP", "IR"},
	})

	loc := &LoginLocation{
		TenantID:  "t1",
		UserID:    "u1",
		IPAddress: "10.0.0.1",
		Country:   "KP",
		City:      "Pyongyang",
		LoginAt:   time.Now(),
	}

	alerts, err := detector.CheckLogin(context.Background(), loc)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	foundBlocked := false
	for _, a := range alerts {
		if a.AlertType == "blocked-country" {
			foundBlocked = true
			if a.Severity != "critical" {
				t.Errorf("expected critical severity, got %s", a.Severity)
			}
		}
	}
	if !foundBlocked {
		t.Error("expected blocked-country alert")
	}
}

func TestGeoLoginDetector_AllowedCountries(t *testing.T) {
	store := newMockGeoLoginStore()
	notifier := &mockGeoAlertNotifier{}
	detector := NewGeoLoginDetector(store, notifier, GeoLoginConfig{
		AllowedCountries: []string{"CN", "US"},
	})

	loc := &LoginLocation{
		TenantID:  "t1",
		UserID:    "u1",
		IPAddress: "10.0.0.1",
		Country:   "RU",
		City:      "Moscow",
		LoginAt:   time.Now(),
	}

	alerts, err := detector.CheckLogin(context.Background(), loc)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	foundDisallowed := false
	for _, a := range alerts {
		if a.AlertType == "disallowed-country" {
			foundDisallowed = true
		}
	}
	if !foundDisallowed {
		t.Error("expected disallowed-country alert")
	}
}

func TestHaversineDistance(t *testing.T) {
	// Shanghai to Beijing ~1068 km
	dist := HaversineDistance(31.23, 121.47, 39.90, 116.40)
	if dist < 1000 || dist > 1200 {
		t.Errorf("expected ~1068km, got %.0fkm", dist)
	}

	// Same point should be 0
	dist = HaversineDistance(31.23, 121.47, 31.23, 121.47)
	if dist > 0.01 {
		t.Errorf("expected 0km for same point, got %.4fkm", dist)
	}
}
