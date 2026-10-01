package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// DeviceInfo holds the raw inputs for fingerprint generation.
type DeviceInfo struct {
	UserAgent string
	IP        string
	DeviceID  string
}

// DeviceFingerprintData is the stored fingerprint record.
type DeviceFingerprintData struct {
	Fingerprint string    `json:"fingerprint"`
	UserAgent   string    `json:"userAgent"`
	IPPrefix    string    `json:"ipPrefix"`
	DeviceID    string    `json:"deviceId,omitempty"`
	CreatedAt   int64     `json:"createdAt"`
	LastSeenAt  int64     `json:"lastSeenAt"`
	Location    string    `json:"location,omitempty"`
}

// AnomalousLoginEvent describes a suspicious login from a different location.
type AnomalousLoginEvent struct {
	UserID          string `json:"userId"`
	DeviceID        string `json:"deviceId"`
	Fingerprint     string `json:"fingerprint"`
	PreviousIP      string `json:"previousIp"`
	CurrentIP       string `json:"currentIp"`
	PreviousLocation string `json:"previousLocation,omitempty"`
	CurrentLocation  string `json:"currentLocation,omitempty"`
	Timestamp       int64  `json:"timestamp"`
}

// DeviceFingerprintService generates and validates device fingerprints.
type DeviceFingerprintService struct {
	redis *redis.Client
	ttl   time.Duration
}

// NewDeviceFingerprintService creates a device fingerprint service.
func NewDeviceFingerprintService(rdb *redis.Client) *DeviceFingerprintService {
	return &DeviceFingerprintService{
		redis: rdb,
		ttl:   30 * 24 * time.Hour,
	}
}

// extractIPPrefix returns the /24 prefix for IPv4 or /64 for IPv6.
func extractIPPrefix(ip string) string {
	if strings.Contains(ip, ".") {
		parts := strings.Split(ip, ".")
		if len(parts) >= 3 {
			return fmt.Sprintf("%s.%s.%s.0/24", parts[0], parts[1], parts[2])
		}
	}
	if strings.Contains(ip, ":") {
		parts := strings.Split(ip, ":")
		if len(parts) >= 4 {
			return strings.Join(parts[:4], ":") + "::/64"
		}
	}
	return ip
}

// GenerateFingerprint creates a SHA256-based fingerprint from device info.
func (s *DeviceFingerprintService) GenerateFingerprint(info DeviceInfo) string {
	ipPrefix := extractIPPrefix(info.IP)
	data := fmt.Sprintf("%s:%s:%s", info.UserAgent, ipPrefix, info.DeviceID)
	h := sha256.Sum256([]byte(data))
	return hex.EncodeToString(h[:])[:32]
}

// StoreFingerprint saves a fingerprint for a user in Redis.
func (s *DeviceFingerprintService) StoreFingerprint(ctx context.Context, userID, fingerprint string, info DeviceInfo) error {
	if s.redis == nil {
		return nil
	}
	now := time.Now().UnixMilli()
	data := DeviceFingerprintData{
		Fingerprint: fingerprint,
		UserAgent:   info.UserAgent,
		IPPrefix:    extractIPPrefix(info.IP),
		DeviceID:    info.DeviceID,
		CreatedAt:   now,
		LastSeenAt:  now,
	}
	encoded, _ := json.Marshal(data)
	key := fmt.Sprintf("device_fingerprint:%s:%s", userID, fingerprint)
	if err := s.redis.Set(ctx, key, encoded, s.ttl).Err(); err != nil {
		return err
	}
	userDevicesKey := fmt.Sprintf("user_devices:%s", userID)
	s.redis.SAdd(ctx, userDevicesKey, fingerprint)
	s.redis.Expire(ctx, userDevicesKey, s.ttl)
	return nil
}

// ValidateFingerprint checks if a fingerprint exists and updates last seen.
func (s *DeviceFingerprintService) ValidateFingerprint(ctx context.Context, userID, fingerprint string) (bool, error) {
	if s.redis == nil {
		return true, nil
	}
	key := fmt.Sprintf("device_fingerprint:%s:%s", userID, fingerprint)
	data, err := s.redis.Get(ctx, key).Result()
	if err != nil {
		return false, nil
	}
	var fd DeviceFingerprintData
	if err := json.Unmarshal([]byte(data), &fd); err != nil {
		return false, nil
	}
	fd.LastSeenAt = time.Now().UnixMilli()
	updated, _ := json.Marshal(fd)
	s.redis.Set(ctx, key, updated, s.ttl)
	return true, nil
}

// IsNewDevice returns true if the fingerprint is not known for the user.
func (s *DeviceFingerprintService) IsNewDevice(ctx context.Context, userID, fingerprint string) (bool, error) {
	if s.redis == nil {
		return false, nil
	}
	key := fmt.Sprintf("device_fingerprint:%s:%s", userID, fingerprint)
	exists, err := s.redis.Exists(ctx, key).Result()
	if err != nil {
		return false, err
	}
	return exists == 0, nil
}

// GetUserDevices returns all known devices for a user.
func (s *DeviceFingerprintService) GetUserDevices(ctx context.Context, userID string) ([]DeviceFingerprintData, error) {
	if s.redis == nil {
		return nil, nil
	}
	userDevicesKey := fmt.Sprintf("user_devices:%s", userID)
	fingerprints, err := s.redis.SMembers(ctx, userDevicesKey).Result()
	if err != nil {
		return nil, err
	}
	var devices []DeviceFingerprintData
	for _, fp := range fingerprints {
		key := fmt.Sprintf("device_fingerprint:%s:%s", userID, fp)
		data, err := s.redis.Get(ctx, key).Result()
		if err != nil {
			continue
		}
		var fd DeviceFingerprintData
		if json.Unmarshal([]byte(data), &fd) == nil {
			devices = append(devices, fd)
		}
	}
	return devices, nil
}

// DetectAnomalousLogin checks if a login is from a new location.
func (s *DeviceFingerprintService) DetectAnomalousLogin(ctx context.Context, userID, currentFingerprint, currentIP string) (*AnomalousLoginEvent, error) {
	if s.redis == nil {
		return nil, nil
	}
	devices, err := s.GetUserDevices(ctx, userID)
	if err != nil || len(devices) == 0 {
		return nil, nil
	}

	for _, d := range devices {
		if d.Fingerprint == currentFingerprint {
			return nil, nil // Known device
		}
	}

	currentIPPrefix := extractIPPrefix(currentIP)
	for _, d := range devices {
		if d.IPPrefix == currentIPPrefix {
			return nil, nil // Same subnet, not anomalous
		}
	}

	prev := devices[0]
	return &AnomalousLoginEvent{
		UserID:      userID,
		DeviceID:    currentFingerprint,
		Fingerprint: currentFingerprint,
		PreviousIP:  prev.IPPrefix,
		CurrentIP:   currentIP,
		Timestamp:   time.Now().UnixMilli(),
	}, nil
}

// RemoveFingerprint deletes a device fingerprint.
func (s *DeviceFingerprintService) RemoveFingerprint(ctx context.Context, userID, fingerprint string) error {
	if s.redis == nil {
		return nil
	}
	key := fmt.Sprintf("device_fingerprint:%s:%s", userID, fingerprint)
	s.redis.Del(ctx, key)
	userDevicesKey := fmt.Sprintf("user_devices:%s", userID)
	s.redis.SRem(ctx, userDevicesKey, fingerprint)
	return nil
}

// RemoveAllDevices removes all devices for a user.
func (s *DeviceFingerprintService) RemoveAllDevices(ctx context.Context, userID string) error {
	devices, err := s.GetUserDevices(ctx, userID)
	if err != nil {
		return err
	}
	for _, d := range devices {
		s.RemoveFingerprint(ctx, userID, d.Fingerprint)
	}
	return nil
}

// GetDeviceCount returns the number of registered devices for a user.
func (s *DeviceFingerprintService) GetDeviceCount(ctx context.Context, userID string) (int64, error) {
	if s.redis == nil {
		return 0, nil
	}
	userDevicesKey := fmt.Sprintf("user_devices:%s", userID)
	return s.redis.SCard(ctx, userDevicesKey).Result()
}
