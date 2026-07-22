package sso

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"
)

// DeviceManager manages user devices and trust relationships.
type DeviceManager struct {
	store DeviceStore
}

// DeviceStore provides persistence for device management.
type DeviceStore interface {
	RegisterDevice(ctx context.Context, device *Device) error
	GetDevice(ctx context.Context, tenantID, deviceID string) (*Device, error)
	GetDeviceByFingerprint(ctx context.Context, tenantID, userID, fingerprint string) (*Device, error)
	ListUserDevices(ctx context.Context, tenantID, userID string) ([]*Device, error)
	TrustDevice(ctx context.Context, tenantID, deviceID string) error
	RevokeTrust(ctx context.Context, tenantID, deviceID string) error
	UpdateLastSeen(ctx context.Context, tenantID, deviceID string) error
	DeleteDevice(ctx context.Context, tenantID, deviceID string) error
}

// Device represents a user device.
type Device struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenant_id" db:"tenant_id"`
	UserID       string    `json:"user_id" db:"user_id"`
	Fingerprint  string    `json:"fingerprint" db:"fingerprint"`
	Name         string    `json:"name" db:"name"`
	DeviceType   string    `json:"device_type" db:"device_type"` // "browser", "mobile", "desktop"
	UserAgent    string    `json:"user_agent" db:"user_agent"`
	IPAddress    string    `json:"ip_address" db:"ip_address"`
	IsTrusted    bool      `json:"is_trusted" db:"is_trusted"`
	TrustedAt    *time.Time `json:"trusted_at" db:"trusted_at"`
	LastSeenAt   time.Time  `json:"last_seen_at" db:"last_seen_at"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
}

// NewDeviceManager creates a new device manager.
func NewDeviceManager(store DeviceStore) *DeviceManager {
	return &DeviceManager{store: store}
}

// IdentifyOrCreate identifies a device by fingerprint or creates a new one.
func (m *DeviceManager) IdentifyOrCreate(ctx context.Context, tenantID, userID, fingerprint, name, deviceType, userAgent, ip string) (*Device, error) {
	// Try to find existing device
	device, err := m.store.GetDeviceByFingerprint(ctx, tenantID, userID, fingerprint)
	if err == nil {
		// Update last seen
		_ = m.store.UpdateLastSeen(ctx, tenantID, device.ID)
		device.LastSeenAt = time.Now()
		return device, nil
	}

	// Register new device
	device = &Device{
		ID:          fmt.Sprintf("dev_%s_%d", tenantID, time.Now().UnixNano()),
		TenantID:    tenantID,
		UserID:      userID,
		Fingerprint: fingerprint,
		Name:        name,
		DeviceType:  deviceType,
		UserAgent:   userAgent,
		IPAddress:   ip,
		IsTrusted:   false,
		LastSeenAt:  time.Now(),
		CreatedAt:   time.Now(),
	}

	if err := m.store.RegisterDevice(ctx, device); err != nil {
		return nil, fmt.Errorf("register device: %w", err)
	}

	return device, nil
}

// Trust marks a device as trusted.
func (m *DeviceManager) Trust(ctx context.Context, tenantID, deviceID string) error {
	return m.store.TrustDevice(ctx, tenantID, deviceID)
}

// RevokeTrust removes trust from a device.
func (m *DeviceManager) RevokeTrust(ctx context.Context, tenantID, deviceID string) error {
	return m.store.RevokeTrust(ctx, tenantID, deviceID)
}

// IsTrusted checks if a device is trusted.
func (m *DeviceManager) IsTrusted(ctx context.Context, tenantID, userID, fingerprint string) bool {
	device, err := m.store.GetDeviceByFingerprint(ctx, tenantID, userID, fingerprint)
	if err != nil {
		return false
	}
	return device.IsTrusted
}

// ListDevices returns all devices for a user.
func (m *DeviceManager) ListDevices(ctx context.Context, tenantID, userID string) ([]*Device, error) {
	return m.store.ListUserDevices(ctx, tenantID, userID)
}

// RemoveDevice removes a device.
func (m *DeviceManager) RemoveDevice(ctx context.Context, tenantID, deviceID string) error {
	return m.store.DeleteDevice(ctx, tenantID, deviceID)
}

// GenerateFingerprint generates a device fingerprint from user agent and other attributes.
func GenerateFingerprint(userAgent, ip, additionalData string) string {
	h := sha256.New()
	h.Write([]byte(userAgent))
	h.Write([]byte("|"))
	h.Write([]byte(ip))
	if additionalData != "" {
		h.Write([]byte("|"))
		h.Write([]byte(additionalData))
	}
	return hex.EncodeToString(h.Sum(nil))
}
