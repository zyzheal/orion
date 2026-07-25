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

// ===========================================================================
// linuxServer — Linux server resource discovery via SSH.
// ===========================================================================

// linuxServer is the stub collector for Linux servers.  In production it
// connects via SSH and runs standard probes (lscpu, free -m, df -h, uptime,
// systemctl list-units).
type linuxServer struct{}

func (c linuxServer) Name() string     { return "linux-server" }
func (c linuxServer) Type() string     { return models.TypeServer }
func (c linuxServer) ConfigSchema() map[string]interface{} {
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

func (c linuxServer) Discover(ctx context.Context, target *models.Target) ([]*models.Device, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	return []*models.Device{
		{
			DeviceID:     "linux-" + target.ID,
			Name:         fmt.Sprintf("linux-srv-%s", target.Host),
			DeviceType:   models.TypeServer,
			Vendor:       "Linux",
			Model:        "Ubuntu 22.04 LTS",
			IP:           target.Host,
			SerialNumber: fmt.Sprintf("LINUX-%s", target.ID),
			TargetID:     &target.ID,
			Adapter:      "linux-server",
			Status:       "active",
			Attributes: map[string]interface{}{
				"os.release":    "22.04",
				"kernel":        "5.15.0-91-generic",
				"arch":          "x86_64",
				"hostname":      fmt.Sprintf("srv-%s.local", target.Host),
				"cpu.cores":     8,
				"memory.gb":     32,
				"disk.total_gb": 1000,
			},
		},
	}, nil
}

func (c linuxServer) Collect(ctx context.Context, device *models.Device) (*models.Collection, error) {
	_ = device
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	attrs := map[string]interface{}{
		"cpu.usage.percent":         35.2,
		"memory.used.percent":       58.0,
		"memory.used.gb":            18.6,
		"memory.total.gb":           32.0,
		"disk.used.percent":         44.0,
		"disk.total.bytes":          int64(1099511627776),
		"disk.used.bytes":           int64(483183820800),
		"load.average.1m":           1.24,
		"load.average.5m":           0.98,
		"load.average.15m":          0.72,
		"processes.total":           245,
		"processes.running":         8,
		"net.io.read.bytes":         int64(2147483648),
		"net.io.write.bytes":        int64(1073741824),
		"uptime.seconds":            int64(345600),
		"cpu.cores":                 8,
		"disk.filesystem.count":     5,
		"systemd.units.active":      187,
		"network.interfaces":        4,
	}
	return &models.Collection{
		Collector:      "linux-server",
		Status:         models.CollectionSuccess,
		Attributes:     attrs,
		AttributeCount: len(attrs),
		DurationMs:     340,
		CreatedAt:      time.Now().UTC(),
	}, nil
}

func (c linuxServer) HealthCheck(ctx context.Context, target *models.Target) error {
	select {
		case <-ctx.Done():
			return ctx.Err()
		default:
	}
	if target.Host == "" {
		return errors.New("linux-server: target host is empty")
	}
	return nil
}

type linuxServerAdapter struct {
	collector linuxServer
}

func (a linuxServerAdapter) Name() string                 { return a.collector.Name() }
func (a linuxServerAdapter) Init(_ map[string]interface{}) error { return nil }
func (a linuxServerAdapter) Collector() interfaces.Collector { return a.collector }

func init() { registry.Default().Register(linuxServerAdapter{collector: linuxServer{}}) }
