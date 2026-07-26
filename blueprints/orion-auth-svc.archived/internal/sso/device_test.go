package sso

import (
	"context"
	"fmt"
	"testing"
	"time"
)

// mockDeviceStore implements DeviceStore for testing.
type mockDeviceStore struct {
	devices map[string]*Device // key: tenantID:deviceID
	byFP    map[string]*Device // key: tenantID:userID:fingerprint
}

func newMockDeviceStore() *mockDeviceStore {
	return &mockDeviceStore{
		devices: make(map[string]*Device),
		byFP:    make(map[string]*Device),
	}
}

func (s *mockDeviceStore) RegisterDevice(ctx context.Context, device *Device) error {
	key := device.TenantID + ":" + device.ID
	s.devices[key] = device
	fpKey := device.TenantID + ":" + device.UserID + ":" + device.Fingerprint
	s.byFP[fpKey] = device
	return nil
}

func (s *mockDeviceStore) GetDevice(ctx context.Context, tenantID, deviceID string) (*Device, error) {
	key := tenantID + ":" + deviceID
	if d, ok := s.devices[key]; ok {
		return d, nil
	}
	return nil, fmt.Errorf("not found")
}

func (s *mockDeviceStore) GetDeviceByFingerprint(ctx context.Context, tenantID, userID, fingerprint string) (*Device, error) {
	key := tenantID + ":" + userID + ":" + fingerprint
	if d, ok := s.byFP[key]; ok {
		return d, nil
	}
	return nil, fmt.Errorf("not found")
}

func (s *mockDeviceStore) ListUserDevices(ctx context.Context, tenantID, userID string) ([]*Device, error) {
	var result []*Device
	for _, d := range s.devices {
		if d.TenantID == tenantID && d.UserID == userID {
			result = append(result, d)
		}
	}
	return result, nil
}

func (s *mockDeviceStore) TrustDevice(ctx context.Context, tenantID, deviceID string) error {
	key := tenantID + ":" + deviceID
	if d, ok := s.devices[key]; ok {
		d.IsTrusted = true
		now := time.Now()
		d.TrustedAt = &now
	}
	return nil
}

func (s *mockDeviceStore) RevokeTrust(ctx context.Context, tenantID, deviceID string) error {
	key := tenantID + ":" + deviceID
	if d, ok := s.devices[key]; ok {
		d.IsTrusted = false
		d.TrustedAt = nil
	}
	return nil
}

func (s *mockDeviceStore) UpdateLastSeen(ctx context.Context, tenantID, deviceID string) error {
	key := tenantID + ":" + deviceID
	if d, ok := s.devices[key]; ok {
		d.LastSeenAt = time.Now()
	}
	return nil
}

func (s *mockDeviceStore) DeleteDevice(ctx context.Context, tenantID, deviceID string) error {
	key := tenantID + ":" + deviceID
	if d, ok := s.devices[key]; ok {
		fpKey := d.TenantID + ":" + d.UserID + ":" + d.Fingerprint
		delete(s.byFP, fpKey)
		delete(s.devices, key)
	}
	return nil
}

func TestDeviceManager_IdentifyOrCreate_NewDevice(t *testing.T) {
	store := newMockDeviceStore()
	mgr := NewDeviceManager(store)

	device, err := mgr.IdentifyOrCreate(context.Background(), "t1", "u1", "fp-123", "Chrome", "browser", "Mozilla/5.0", "1.2.3.4")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if device.Fingerprint != "fp-123" {
		t.Errorf("expected fingerprint=fp-123, got %s", device.Fingerprint)
	}
	if device.IsTrusted {
		t.Error("new device should not be trusted")
	}
	if device.Name != "Chrome" {
		t.Errorf("expected name=Chrome, got %s", device.Name)
	}
}

func TestDeviceManager_IdentifyOrCreate_ExistingDevice(t *testing.T) {
	store := newMockDeviceStore()
	mgr := NewDeviceManager(store)

	// First call creates device
	device1, err := mgr.IdentifyOrCreate(context.Background(), "t1", "u1", "fp-123", "Chrome", "browser", "Mozilla/5.0", "1.2.3.4")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Second call should find existing device
	device2, err := mgr.IdentifyOrCreate(context.Background(), "t1", "u1", "fp-123", "Chrome", "browser", "Mozilla/5.0", "1.2.3.4")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if device1.ID != device2.ID {
		t.Errorf("expected same device ID, got %s vs %s", device1.ID, device2.ID)
	}
}

func TestDeviceManager_Trust(t *testing.T) {
	store := newMockDeviceStore()
	mgr := NewDeviceManager(store)

	device, _ := mgr.IdentifyOrCreate(context.Background(), "t1", "u1", "fp-123", "Chrome", "browser", "Mozilla/5.0", "1.2.3.4")

	if device.IsTrusted {
		t.Error("new device should not be trusted")
	}

	err := mgr.Trust(context.Background(), "t1", device.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	trusted := mgr.IsTrusted(context.Background(), "t1", "u1", "fp-123")
	if !trusted {
		t.Error("device should be trusted after Trust()")
	}
}

func TestDeviceManager_RevokeTrust(t *testing.T) {
	store := newMockDeviceStore()
	mgr := NewDeviceManager(store)

	device, _ := mgr.IdentifyOrCreate(context.Background(), "t1", "u1", "fp-123", "Chrome", "browser", "Mozilla/5.0", "1.2.3.4")
	_ = mgr.Trust(context.Background(), "t1", device.ID)

	err := mgr.RevokeTrust(context.Background(), "t1", device.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	trusted := mgr.IsTrusted(context.Background(), "t1", "u1", "fp-123")
	if trusted {
		t.Error("device should not be trusted after RevokeTrust()")
	}
}

func TestDeviceManager_IsTrusted_UnknownDevice(t *testing.T) {
	store := newMockDeviceStore()
	mgr := NewDeviceManager(store)

	trusted := mgr.IsTrusted(context.Background(), "t1", "u1", "unknown-fp")
	if trusted {
		t.Error("unknown device should not be trusted")
	}
}

func TestDeviceManager_ListDevices(t *testing.T) {
	store := newMockDeviceStore()
	mgr := NewDeviceManager(store)

	// Use pre-registered devices to avoid ID collision from time.Now().UnixNano()
	store.RegisterDevice(context.Background(), &Device{
		ID: "dev-1", TenantID: "t1", UserID: "u1", Fingerprint: "fp-1",
		Name: "Chrome", DeviceType: "browser", UserAgent: "UA1", IPAddress: "1.1.1.1",
		LastSeenAt: time.Now(), CreatedAt: time.Now(),
	})
	store.RegisterDevice(context.Background(), &Device{
		ID: "dev-2", TenantID: "t1", UserID: "u1", Fingerprint: "fp-2",
		Name: "Firefox", DeviceType: "browser", UserAgent: "UA2", IPAddress: "2.2.2.2",
		LastSeenAt: time.Now(), CreatedAt: time.Now(),
	})
	store.RegisterDevice(context.Background(), &Device{
		ID: "dev-3", TenantID: "t1", UserID: "u2", Fingerprint: "fp-3",
		Name: "Safari", DeviceType: "browser", UserAgent: "UA3", IPAddress: "3.3.3.3",
		LastSeenAt: time.Now(), CreatedAt: time.Now(),
	})

	devices, err := mgr.ListDevices(context.Background(), "t1", "u1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(devices) != 2 {
		t.Errorf("expected 2 devices for u1, got %d", len(devices))
	}
}

func TestDeviceManager_RemoveDevice(t *testing.T) {
	store := newMockDeviceStore()
	mgr := NewDeviceManager(store)

	device, _ := mgr.IdentifyOrCreate(context.Background(), "t1", "u1", "fp-123", "Chrome", "browser", "Mozilla/5.0", "1.2.3.4")

	err := mgr.RemoveDevice(context.Background(), "t1", device.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	devices, _ := mgr.ListDevices(context.Background(), "t1", "u1")
	if len(devices) != 0 {
		t.Errorf("expected 0 devices after removal, got %d", len(devices))
	}
}

func TestGenerateFingerprint(t *testing.T) {
	fp1 := GenerateFingerprint("Mozilla/5.0", "1.2.3.4", "")
	fp2 := GenerateFingerprint("Mozilla/5.0", "1.2.3.4", "")

	if fp1 != fp2 {
		t.Error("same inputs should produce same fingerprint")
	}
	if len(fp1) != 64 {
		t.Errorf("expected 64-char hex fingerprint, got %d chars", len(fp1))
	}

	fp3 := GenerateFingerprint("Chrome", "1.2.3.4", "")
	if fp1 == fp3 {
		t.Error("different user agents should produce different fingerprints")
	}

	fp4 := GenerateFingerprint("Mozilla/5.0", "1.2.3.4", "extra-data")
	if fp1 == fp4 {
		t.Error("additional data should change fingerprint")
	}
}
