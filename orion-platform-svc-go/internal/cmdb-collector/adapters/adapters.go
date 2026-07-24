// Package adapters provides the built-in vendor stub adapters for CMDB
// collector.
//
// Five vendors ship with the package: Cisco SNMP, Huawei SNMP, MySQL JDBC,
// PostgreSQL JDBC, and a generic Linux server via SSH.  Each is a _stub_:
// rather than opening a real network session it returns synthetic data shaped
// like what the real adapter would return.  Production deployments swap the
// stub bodies for actual SNMP/SSH/JDBC calls — the surrounding service,
// repository, handler and scheduler layers never change.
//
// Design decisions:
//   - Every adapter struct is value-typed (no pointers inside), so they are
//     safe to register by value in init().
//   - Init(config) is a no-op stub — production adapters use it to cache a
//     community string, credential bundle, or DB pool.
//   - ConfigSchema() documents the fields a real adapter expects.
package adapters

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/cmdb-collector/interfaces"
	"orion/platform-svc-go/internal/cmdb-collector/models"
	"orion/platform-svc-go/internal/cmdb-collector/registry"
)

// ---------- helper: register an adapter at init() ----------

// register is a shared helper used by each vendor's init() to add itself to
// the default registry.  It panics only on programming errors (e.g. duplicate
// registration would already be handled by Registry.Replace semantics).
func register(a interfaces.Adapter) {
	registry.Default().Register(a)
}

// ---------- Cisco SNMP ----------

// ciscoSNMP is the stub SNMP collector for Cisco IOS / NX-OS devices.
type ciscoSNMP struct{}

func (c ciscoSNMP) Name() string         { return "cisco-snmp" }
func (c ciscoSNMP) Type() string         { return models.TypeNetwork }
func (c ciscoSNMP) ConfigSchema() map[string]interface{} {
	return map[string]interface{}{
		"host":         "string, required — SNMP target IP",
		"port":         "int, default 161",
		"community":    "string, required — SNMP community string",
		"version":      "string, one of [1, 2c, 3]",
		"security_level": "string, for SNMPv3: noAuthNoPriv | authNoPriv | authPriv",
	}
}

func (c ciscoSNMP) Discover(ctx context.Context, target *models.Target) ([]*models.Device, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	// Stub: return one synthetic Cisco switch discovered on the target host.
	return []*models.Device{
		{
			DeviceID:     "cisco-" + target.ID,
			Name:         fmt.Sprintf("cisco-sw-%s", target.Host),
			DeviceType:   models.TypeNetwork,
			Vendor:       "Cisco",
			Model:        "Catalyst 9300",
			IP:           target.Host,
			SerialNumber: fmt.Sprintf("FCW%s", target.ID),
			TargetID:     &target.ID,
			Adapter:      "cisco-snmp",
			Status:       "active",
			Attributes: map[string]interface{}{
				"sysObjectID": ".1.3.6.1.4.1.9.1.1217",
				"uptime":      "45d12h",
			},
		},
	}, nil
}

func (c ciscoSNMP) Collect(ctx context.Context, device *models.Device) (*models.Collection, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	attrs := map[string]interface{}{
		"cpu.usage.percent":          23.4,
		"memory.used.percent":        61.0,
		"interfaces.total":           48,
		"interfaces.up":              44,
		"interfaces.down":            4,
		"power.supply.status":        "ok",
		"fan.status":                 "ok",
		"uptime.seconds":             int64(3916800),
	}
	return &models.Collection{
		Collector:    "cisco-snmp",
		DeviceID:     &device.ID,
		Status:       models.CollectionSuccess,
		Attributes:   attrs,
		AttributeCount: len(attrs),
		DurationMs:   120,
		CreatedAt:    time.Now().UTC(),
	}, nil
}

func (c ciscoSNMP) HealthCheck(ctx context.Context, target *models.Target) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	// Stub: any target with a host is reachable.
	if target.Host == "" {
		return errors.New("cisco-snmp: target host is empty")
	}
	return nil
}

// ciscoSNMPAdapter wraps the collector with an Init hook.
type ciscoSNMPAdapter struct {
	collector ciscoSNMP
}

func (a ciscoSNMPAdapter) Name() string             { return a.collector.Name() }
func (a ciscoSNMPAdapter) Init(_ map[string]interface{}) error { return nil } // stub
func (a ciscoSNMPAdapter) Collector() interfaces.Collector { return a.collector }

func init() { register(ciscoSNMPAdapter{collector: ciscoSNMP{}}) }

// ---------- Huawei SNMP ----------

type huaweiSNMP struct{}

func (c huaweiSNMP) Name() string         { return "huawei-snmp" }
func (c huaweiSNMP) Type() string         { return models.TypeNetwork }
func (c huaweiSNMP) ConfigSchema() map[string]interface{} {
	return map[string]interface{}{
		"host":      "string, required — SNMP target IP",
		"port":      "int, default 161",
		"community": "string, required",
		"version":   "string, one of [1, 2c, 3]",
	}
}

func (c huaweiSNMP) Discover(ctx context.Context, target *models.Target) ([]*models.Device, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	return []*models.Device{
		{
			DeviceID:     "huawei-" + target.ID,
			Name:         fmt.Sprintf("huawei-sw-%s", target.Host),
			DeviceType:   models.TypeNetwork,
			Vendor:       "Huawei",
			Model:        "S5735-S48T4S",
			IP:           target.Host,
			SerialNumber: fmt.Sprintf("2102%s", target.ID),
			TargetID:     &target.ID,
			Adapter:      "huawei-snmp",
			Status:       "active",
			Attributes: map[string]interface{}{
				"sysObjectID": ".1.3.6.1.4.1.2011.5.25.31.1",
				"uptime":      "12d4h",
			},
		},
	}, nil
}

func (c huaweiSNMP) Collect(ctx context.Context, device *models.Device) (*models.Collection, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	attrs := map[string]interface{}{
		"cpu.usage.percent":          18.7,
		"memory.used.percent":        54.2,
		"interfaces.total":           52,
		"interfaces.up":              48,
		"interfaces.down":            4,
		"power.supply.status":        "ok",
		"fan.status":                 "ok",
		"uptime.seconds":             int64(1065600),
	}
	return &models.Collection{
		Collector:    "huawei-snmp",
		DeviceID:     &device.ID,
		Status:       models.CollectionSuccess,
		Attributes:   attrs,
		AttributeCount: len(attrs),
		DurationMs:   95,
		CreatedAt:    time.Now().UTC(),
	}, nil
}

func (c huaweiSNMP) HealthCheck(ctx context.Context, target *models.Target) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	if target.Host == "" {
		return errors.New("huawei-snmp: target host is empty")
	}
	return nil
}

type huaweiSNMPAdapter struct{ collector huaweiSNMP }

func (a huaweiSNMPAdapter) Name() string                { return a.collector.Name() }
func (a huaweiSNMPAdapter) Init(_ map[string]interface{}) error { return nil }
func (a huaweiSNMPAdapter) Collector() interfaces.Collector { return a.collector }

func init() { register(huaweiSNMPAdapter{collector: huaweiSNMP{}}) }

// ---------- MySQL JDBC ----------

type mysqlJDBC struct{}

func (c mysqlJDBC) Name() string         { return "mysql-jdbc" }
func (c mysqlJDBC) Type() string         { return models.TypeDatabase }
func (c mysqlJDBC) ConfigSchema() map[string]interface{} {
	return map[string]interface{}{
		"host":        "string, required — MySQL host",
		"port":        "int, default 3306",
		"username":    "string, required",
		"password":    "string, required",
		"database":    "string, optional — target database (default: information_schema)",
		"ssl_mode":    "string, one of [disabled, preferred, required]",
		"pool.size":   "int, connection pool size (default 5)",
	}
}

func (c mysqlJDBC) Discover(ctx context.Context, target *models.Target) ([]*models.Device, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	return []*models.Device{
		{
			DeviceID:     "mysql-" + target.ID,
			Name:         fmt.Sprintf("mysql-%s", target.Host),
			DeviceType:   models.TypeDatabase,
			Vendor:       "MySQL",
			Model:        "MySQL 8.0",
			IP:           target.Host,
			SerialNumber: fmt.Sprintf("MYSQL-%s", target.ID),
			TargetID:     &target.ID,
			Adapter:      "mysql-jdbc",
			Status:       "active",
			Attributes: map[string]interface{}{
				"version": "8.0.35",
			},
		},
	}, nil
}

func (c mysqlJDBC) Collect(ctx context.Context, device *models.Device) (*models.Collection, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	attrs := map[string]interface{}{
		"cpu.usage.percent":          42.1,
		"memory.used.percent":        70.5,
		"connections.active":         128,
		"connections.max":            500,
		"threads.running":            12,
		"queries.per.second":         1250.0,
		"slow.queries":               3,
		"innodb.buffer.pool.hit.ratio": 99.2,
		"tables.count":               340,
		"uptime.seconds":             int64(864000),
	}
	return &models.Collection{
		Collector:    "mysql-jdbc",
		DeviceID:     &device.ID,
		Status:       models.CollectionSuccess,
		Attributes:   attrs,
		AttributeCount: len(attrs),
		DurationMs:   210,
		CreatedAt:    time.Now().UTC(),
	}, nil
}

func (c mysqlJDBC) HealthCheck(ctx context.Context, target *models.Target) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	if target.Host == "" {
		return errors.New("mysql-jdbc: target host is empty")
	}
	return nil
}

type mysqlJDBCAdapter struct{ collector mysqlJDBC }

func (a mysqlJDBCAdapter) Name() string                { return a.collector.Name() }
func (a mysqlJDBCAdapter) Init(_ map[string]interface{}) error { return nil }
func (a mysqlJDBCAdapter) Collector() interfaces.Collector { return a.collector }

func init() { register(mysqlJDBCAdapter{collector: mysqlJDBC{}}) }

// ---------- PostgreSQL JDBC ----------

type postgresqlJDBC struct{}

func (c postgresqlJDBC) Name() string         { return "postgresql-jdbc" }
func (c postgresqlJDBC) Type() string         { return models.TypeDatabase }
func (c postgresqlJDBC) ConfigSchema() map[string]interface{} {
	return map[string]interface{}{
		"host":        "string, required — PostgreSQL host",
		"port":        "int, default 5432",
		"username":    "string, required",
		"password":    "string, required",
		"database":    "string, optional — default postgres",
		"sslmode":     "string, one of [disable, require, verify-ca, verify-full]",
	}
}

func (c postgresqlJDBC) Discover(ctx context.Context, target *models.Target) ([]*models.Device, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	return []*models.Device{
		{
			DeviceID:     "pgsql-" + target.ID,
			Name:         fmt.Sprintf("postgresql-%s", target.Host),
			DeviceType:   models.TypeDatabase,
			Vendor:       "PostgreSQL",
			Model:        "PostgreSQL 16",
			IP:           target.Host,
			SerialNumber: fmt.Sprintf("PGSQL-%s", target.ID),
			TargetID:     &target.ID,
			Adapter:      "postgresql-jdbc",
			Status:       "active",
			Attributes: map[string]interface{}{
				"version": "16.2",
			},
		},
	}, nil
}

func (c postgresqlJDBC) Collect(ctx context.Context, device *models.Device) (*models.Collection, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	attrs := map[string]interface{}{
		"cpu.usage.percent":          31.0,
		"memory.used.percent":        65.8,
		"connections.active":         84,
		"connections.max":            200,
		"buffers.hit.ratio":          98.7,
		"queries.per.second":         890.0,
		"replication.lag.bytes":      1234,
		"tables.count":               220,
		"indexes.count":              540,
		"uptime.seconds":             int64(1728000),
	}
	return &models.Collection{
		Collector:    "postgresql-jdbc",
		DeviceID:     &device.ID,
		Status:       models.CollectionSuccess,
		Attributes:   attrs,
		AttributeCount: len(attrs),
		DurationMs:   175,
		CreatedAt:    time.Now().UTC(),
	}, nil
}

func (c postgresqlJDBC) HealthCheck(ctx context.Context, target *models.Target) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	if target.Host == "" {
		return errors.New("postgresql-jdbc: target host is empty")
	}
	return nil
}

type postgresqlJDBCAdapter struct{ collector postgresqlJDBC }

func (a postgresqlJDBCAdapter) Name() string                { return a.collector.Name() }
func (a postgresqlJDBCAdapter) Init(_ map[string]interface{}) error { return nil }
func (a postgresqlJDBCAdapter) Collector() interfaces.Collector { return a.collector }

func init() { register(postgresqlJDBCAdapter{collector: postgresqlJDBC{}}) }

// ---------- Generic Linux server via SSH ----------

type sshServer struct{}

func (c sshServer) Name() string         { return "ssh-server" }
func (c sshServer) Type() string         { return models.TypeServer }
func (c sshServer) ConfigSchema() map[string]interface{} {
	return map[string]interface{}{
		"host":        "string, required — server IP or hostname",
		"port":        "int, default 22",
		"username":    "string, required",
		"password":    "string, required (alternative to private_key)",
		"private_key": "string, optional — PEM private key",
		"sudo":        "bool, whether commands run as sudo (default false)",
		"timeout":     "int, connection timeout in seconds (default 10)",
	}
}

func (c sshServer) Discover(ctx context.Context, target *models.Target) ([]*models.Device, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	return []*models.Device{
		{
			DeviceID:     "ssh-" + target.ID,
			Name:         fmt.Sprintf("linux-srv-%s", target.Host),
			DeviceType:   models.TypeServer,
			Vendor:       "Linux",
			Model:        "Ubuntu 22.04 LTS",
			IP:           target.Host,
			SerialNumber: fmt.Sprintf("LINUX-%s", target.ID),
			TargetID:     &target.ID,
			Adapter:      "ssh-server",
			Status:       "active",
			Attributes: map[string]interface{}{
				"os.release":   "22.04",
				"kernel":       "5.15.0-91-generic",
				"arch":         "x86_64",
				"hostname":     fmt.Sprintf("srv-%s.local", target.Host),
			},
		},
	}, nil
}

func (c sshServer) Collect(ctx context.Context, device *models.Device) (*models.Collection, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	attrs := map[string]interface{}{
		"cpu.usage.percent":          35.2,
		"memory.used.percent":        58.0,
		"disk.used.percent":          44.0,
		"disk.total.bytes":           int64(1099511627776), // 1TB
		"disk.used.bytes":            int64(483183820800),  // ~450GB
		"load.average.1m":            1.24,
		"load.average.5m":            0.98,
		"load.average.15m":           0.72,
		"processes.total":            245,
		"processes.running":          8,
		"net.io.read.bytes":          int64(2147483648),
		"net.io.write.bytes":         int64(1073741824),
		"uptime.seconds":             int64(345600),
	}
	return &models.Collection{
		Collector:    "ssh-server",
		DeviceID:     &device.ID,
		Status:       models.CollectionSuccess,
		Attributes:   attrs,
		AttributeCount: len(attrs),
		DurationMs:   340,
		CreatedAt:    time.Now().UTC(),
	}, nil
}

func (c sshServer) HealthCheck(ctx context.Context, target *models.Target) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	if target.Host == "" {
		return errors.New("ssh-server: target host is empty")
	}
	return nil
}

type sshServerAdapter struct{ collector sshServer }

func (a sshServerAdapter) Name() string                { return a.collector.Name() }
func (a sshServerAdapter) Init(_ map[string]interface{}) error { return nil }
func (a sshServerAdapter) Collector() interfaces.Collector { return a.collector }

func init() { register(sshServerAdapter{collector: sshServer{}}) }
