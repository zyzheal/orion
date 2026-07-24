// Package interfaces defines the SPI (Service Provider Interface) for vendor
// adapters in the CMDB Collector.
//
// Two complementary interfaces are exposed:
//
//   Collector — the operational contract.  Every vendor adapter implements
//     Discover() (find new devices on a target) and Collect() (gather
//     attributes from a known device).  The interface is transport-agnostic:
//     SNMP, SSH, JDBC, WMI, and API adapters all share it.
//
//   Adapter — the wiring contract.  Wraps a Collector with an Init() call so
//     each adapter instance can be initialised with runtime configuration
//     (credentials, connection pools) before it is used.
//
// Design decisions:
//   1. Stub collectors emit synthetic data.  Production adapters swap in real
//     network calls without changing the service / handler / repository layers.
//   2. Collectors are stateless after Init().  Each Collect/Discover call
//     receives a fresh context and config map, making them safe for concurrent
//     use by the scheduler.
//   3. ConfigSchema() exposes each adapter's required fields as a JSON-schema-
//     shaped map so the API layer can validate inbound payloads.

package interfaces

import (
	"context"

	"orion/platform-svc-go/internal/cmdb-collector/models"
)

// Collector is the SPI every vendor adapter must implement.
//
// Name()    — unique adapter identifier, e.g. "cisco-snmp", "mysql-jdbc".
// Type()    — asset class: "network" | "server" | "database" | "middleware" | "cloud".
// Discover  — probe a Target and return a slice of newly-found Devices.
// Collect   — gather the current attribute set from a known Device.
// HealthCheck — lightweight probe to decide whether a target is reachable
//   before a full Discover or Collect is launched.
// ConfigSchema — the set of config keys this adapter requires, keyed by the
//   config map field name.
type Collector interface {
	Name() string
	Type() string

	Discover(ctx context.Context, target *models.Target) ([]*models.Device, error)
	Collect(ctx context.Context, device *models.Device) (*models.Collection, error)
	HealthCheck(ctx context.Context, target *models.Target) error
	ConfigSchema() map[string]interface{}
}

// Adapter wraps a Collector with an Init() hook so runtime config (shared
// pools, secrets) is applied once at startup.
type Adapter interface {
	Name() string
	Init(config map[string]interface{}) error
	Collector() Collector
}
