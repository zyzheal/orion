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
// awsCloud — AWS cloud resource discovery (EC2, RDS, S3).
// ===========================================================================

// awsCloud is the stub collector for AWS.  In production it would use the
// AWS SDK (session → EC2 / RDS / S3 Describe calls).  The stub returns
// synthetic data shaped like a real multi-service sweep.
type awsCloud struct{}

func (c awsCloud) Name() string     { return "aws-cloud" }
func (c awsCloud) Type() string     { return models.TypeCloud }
func (c awsCloud) ConfigSchema() map[string]interface{} {
	return map[string]interface{}{
		"access_key_id":     "string, required — AWS access key",
		"secret_access_key": "string, required — AWS secret key",
		"region":            "string, required — AWS region (e.g. us-east-1)",
		"profile":           "string, optional — named profile from ~/.aws/credentials",
		"role_arn":          "string, optional — STS role to assume",
		"services":          "string, comma-separated: ec2,rds,s3 (default: all)",
	}
}

func (c awsCloud) Discover(ctx context.Context, target *models.Target) ([]*models.Device, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	return []*models.Device{
		{
			DeviceID:     "ec2-" + target.ID,
			Name:         "aws-ec2-instance-001",
			DeviceType:   models.TypeCloud,
			Vendor:       "AWS",
			Model:        "t3.medium",
			IP:           "10.0.1.42",
			SerialNumber: fmt.Sprintf("i-%s", target.ID),
			TargetID:     &target.ID,
			Adapter:      "aws-cloud",
			Status:       "active",
			Attributes: map[string]interface{}{
				"service":       "ec2",
				"region":        "us-east-1",
				"instance_type": "t3.medium",
				"state":         "running",
				"private_ip":    "10.0.1.42",
				"public_ip":     "52.1.2.3",
				"availability_zone": "us-east-1a",
				"launch_time":   "2026-06-01T00:00:00Z",
			},
		},
		{
			DeviceID:     "rds-" + target.ID,
			Name:         "aws-rds-mysql-001",
			DeviceType:   models.TypeCloud,
			Vendor:       "AWS",
			Model:        "db.r5.large",
			IP:           "10.0.2.10",
			SerialNumber: fmt.Sprintf("rds-%s", target.ID),
			TargetID:     &target.ID,
			Adapter:      "aws-cloud",
			Status:       "active",
			Attributes: map[string]interface{}{
				"service":        "rds",
				"engine":         "mysql",
				"engine_version": "8.0.35",
				"instance_class": "db.r5.large",
				"status":         "available",
				"storage_gb":     200,
				"multi_az":       true,
			},
		},
		{
			DeviceID:     "s3-" + target.ID,
			Name:         "aws-s3-bucket-001",
			DeviceType:   models.TypeCloud,
			Vendor:       "AWS",
			Model:        "s3",
			SerialNumber: fmt.Sprintf("s3-%s", target.ID),
			TargetID:     &target.ID,
			Adapter:      "aws-cloud",
			Status:       "active",
			Attributes: map[string]interface{}{
				"service":      "s3",
				"region":       "us-east-1",
				"storage_gb":   150,
				"object_count": 42310,
				"versioning":   "Enabled",
				"encryption":   "AES256",
			},
		},
	}, nil
}

func (c awsCloud) Collect(ctx context.Context, device *models.Device) (*models.Collection, error) {
	_ = device
	select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
	}
	attrs := map[string]interface{}{
		"cpu.usage.percent":   28.0,
		"memory.used.percent": 55.0,
		"network.in.bytes":    int64(512000000),
		"network.out.bytes":   int64(1024000000),
		"disk.read_ops":       1250,
		"disk.write_ops":      890,
		"uptime.seconds":      int64(1728000),
	}
	return &models.Collection{
		Collector:      "aws-cloud",
		Status:         models.CollectionSuccess,
		Attributes:     attrs,
		AttributeCount: len(attrs),
		DurationMs:     450,
		CreatedAt:      time.Now().UTC(),
	}, nil
}

func (c awsCloud) HealthCheck(ctx context.Context, target *models.Target) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	if target.Host == "" {
		return errors.New("aws-cloud: target host is empty")
	}
	return nil
}

type awsCloudAdapter struct {
	collector awsCloud
}

func (a awsCloudAdapter) Name() string                 { return a.collector.Name() }
func (a awsCloudAdapter) Init(_ map[string]interface{}) error { return nil }
func (a awsCloudAdapter) Collector() interfaces.Collector { return a.collector }

func init() { registry.Default().Register(awsCloudAdapter{collector: awsCloud{}}) }
