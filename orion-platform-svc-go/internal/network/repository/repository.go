package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/network/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// RepositoryInterface defines the data access contract for the network module.
type RepositoryInterface interface {
	// VPC
	CreateVPC(ctx context.Context, vpc *models.VPC) error
	GetVPCByID(ctx context.Context, tenantID, id string) (*models.VPC, error)
	ListVPCs(ctx context.Context, tenantID string) ([]models.VPC, error)
	UpdateVPC(ctx context.Context, vpc *models.VPC, tenantID string) (*models.VPC, error)
	DeleteVPC(ctx context.Context, tenantID, id string) (bool, error)

	// Subnet
	CreateSubnet(ctx context.Context, subnet *models.Subnet) error
	GetSubnetByID(ctx context.Context, tenantID, id string) (*models.Subnet, error)
	ListSubnets(ctx context.Context, tenantID string) ([]models.Subnet, error)
	ListSubnetsByVPC(ctx context.Context, tenantID, vpcID string) ([]models.Subnet, error)
	UpdateSubnet(ctx context.Context, subnet *models.Subnet, tenantID string) (*models.Subnet, error)
	DeleteSubnet(ctx context.Context, tenantID, id string) (bool, error)

	// FirewallRule
	CreateFirewallRule(ctx context.Context, rule *models.FirewallRule) error
	GetFirewallRuleByID(ctx context.Context, tenantID, id string) (*models.FirewallRule, error)
	ListFirewallRules(ctx context.Context, tenantID string) ([]models.FirewallRule, error)
	ListFirewallRulesByVPC(ctx context.Context, tenantID, vpcID string) ([]models.FirewallRule, error)
	UpdateFirewallRule(ctx context.Context, rule *models.FirewallRule, tenantID string) (*models.FirewallRule, error)
	DeleteFirewallRule(ctx context.Context, tenantID, id string) (bool, error)

	// LoadBalancer
	CreateLoadBalancer(ctx context.Context, lb *models.LoadBalancer) error
	GetLoadBalancerByID(ctx context.Context, tenantID, id string) (*models.LoadBalancer, error)
	ListLoadBalancers(ctx context.Context, tenantID string) ([]models.LoadBalancer, error)
	UpdateLoadBalancer(ctx context.Context, lb *models.LoadBalancer, tenantID string) (*models.LoadBalancer, error)
	DeleteLoadBalancer(ctx context.Context, tenantID, id string) (bool, error)

	// DNSRecord
	CreateDNSRecord(ctx context.Context, record *models.DNSRecord) error
	GetDNSRecordByID(ctx context.Context, tenantID, id string) (*models.DNSRecord, error)
	ListDNSRecords(ctx context.Context, tenantID string) ([]models.DNSRecord, error)
	ListDNSRecordsByZone(ctx context.Context, tenantID, zoneID string) ([]models.DNSRecord, error)
	UpdateDNSRecord(ctx context.Context, record *models.DNSRecord, tenantID string) (*models.DNSRecord, error)
	DeleteDNSRecord(ctx context.Context, tenantID, id string) (bool, error)
}

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)

// ---------- VPC ----------

func (r *Repository) CreateVPC(ctx context.Context, vpc *models.VPC) error {
	vpc.ID = uuid.New().String()
	vpc.Status = "active"
	vpc.CreatedAt = time.Now().UTC()
	vpc.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO vpcs (id, tenant_id, name, cidr, region, status, created_at, updated_at)
		 VALUES (:id, :tenant_id, :name, :cidr, :region, :status, :created_at, :updated_at)`,
		vpc)
	return err
}

func (r *Repository) GetVPCByID(ctx context.Context, tenantID, id string) (*models.VPC, error) {
	var vpc models.VPC
	err := r.db.GetContext(ctx, &vpc,
		`SELECT * FROM vpcs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &vpc, nil
}

func (r *Repository) ListVPCs(ctx context.Context, tenantID string) ([]models.VPC, error) {
	var vpcs []models.VPC
	err := r.db.SelectContext(ctx, &vpcs,
		`SELECT * FROM vpcs WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return vpcs, err
}

func (r *Repository) UpdateVPC(ctx context.Context, vpc *models.VPC, tenantID string) (*models.VPC, error) {
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE vpcs SET name=:name, cidr=:cidr, region=:region, status=:status, updated_at=:updated_at
		 WHERE id=:id AND tenant_id=:tenant_id`,
		vpc)
	if err != nil {
		return nil, err
	}
	return r.GetVPCByID(ctx, tenantID, vpc.ID)
}

func (r *Repository) DeleteVPC(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM vpcs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// ---------- Subnet ----------

func (r *Repository) CreateSubnet(ctx context.Context, subnet *models.Subnet) error {
	subnet.ID = uuid.New().String()
	subnet.Status = "available"
	subnet.CreatedAt = time.Now().UTC()
	subnet.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO subnets (id, tenant_id, vpc_id, name, cidr, availability_zone, status, created_at, updated_at)
		 VALUES (:id, :tenant_id, :vpc_id, :name, :cidr, :availability_zone, :status, :created_at, :updated_at)`,
		subnet)
	return err
}

func (r *Repository) GetSubnetByID(ctx context.Context, tenantID, id string) (*models.Subnet, error) {
	var subnet models.Subnet
	err := r.db.GetContext(ctx, &subnet,
		`SELECT * FROM subnets WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &subnet, nil
}

func (r *Repository) ListSubnets(ctx context.Context, tenantID string) ([]models.Subnet, error) {
	var subnets []models.Subnet
	err := r.db.SelectContext(ctx, &subnets,
		`SELECT * FROM subnets WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return subnets, err
}

func (r *Repository) ListSubnetsByVPC(ctx context.Context, tenantID, vpcID string) ([]models.Subnet, error) {
	var subnets []models.Subnet
	err := r.db.SelectContext(ctx, &subnets,
		`SELECT * FROM subnets WHERE tenant_id=$1 AND vpc_id=$2 ORDER BY created_at DESC`, tenantID, vpcID)
	return subnets, err
}

func (r *Repository) UpdateSubnet(ctx context.Context, subnet *models.Subnet, tenantID string) (*models.Subnet, error) {
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE subnets SET name=:name, cidr=:cidr, availability_zone=:availability_zone, status=:status, updated_at=:updated_at
		 WHERE id=:id AND tenant_id=:tenant_id`,
		subnet)
	if err != nil {
		return nil, err
	}
	return r.GetSubnetByID(ctx, tenantID, subnet.ID)
}

func (r *Repository) DeleteSubnet(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM subnets WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// ---------- FirewallRule ----------

func (r *Repository) CreateFirewallRule(ctx context.Context, rule *models.FirewallRule) error {
	rule.ID = uuid.New().String()
	if rule.SourceCIDR == "" {
		rule.SourceCIDR = "0.0.0.0/0"
	}
	if rule.DestCIDR == "" {
		rule.DestCIDR = "0.0.0.0/0"
	}
	if rule.Priority == 0 {
		rule.Priority = 100
	}
	rule.Enabled = true
	rule.CreatedAt = time.Now().UTC()
	rule.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO firewall_rules (id, tenant_id, vpc_id, name, protocol, direction, source_cidr, dest_cidr, port_from, port_to, action, priority, enabled, created_at, updated_at)
		 VALUES (:id, :tenant_id, :vpc_id, :name, :protocol, :direction, :source_cidr, :dest_cidr, :port_from, :port_to, :action, :priority, :enabled, :created_at, :updated_at)`,
		rule)
	return err
}

func (r *Repository) GetFirewallRuleByID(ctx context.Context, tenantID, id string) (*models.FirewallRule, error) {
	var rule models.FirewallRule
	err := r.db.GetContext(ctx, &rule,
		`SELECT * FROM firewall_rules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &rule, nil
}

func (r *Repository) ListFirewallRules(ctx context.Context, tenantID string) ([]models.FirewallRule, error) {
	var rules []models.FirewallRule
	err := r.db.SelectContext(ctx, &rules,
		`SELECT * FROM firewall_rules WHERE tenant_id=$1 ORDER BY priority ASC`, tenantID)
	return rules, err
}

func (r *Repository) ListFirewallRulesByVPC(ctx context.Context, tenantID, vpcID string) ([]models.FirewallRule, error) {
	// Fetch the VPC first to verify tenant ownership
	_, err := r.GetVPCByID(ctx, tenantID, vpcID)
	if err != nil {
		return nil, err
	}
	var rules []models.FirewallRule
	err = r.db.SelectContext(ctx, &rules,
		`SELECT * FROM firewall_rules WHERE tenant_id=$1 AND vpc_id=$2 ORDER BY priority ASC`, tenantID, vpcID)
	return rules, err
}

func (r *Repository) UpdateFirewallRule(ctx context.Context, rule *models.FirewallRule, tenantID string) (*models.FirewallRule, error) {
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE firewall_rules SET name=:name, protocol=:protocol, direction=:direction, source_cidr=:source_cidr, dest_cidr=:dest_cidr, port_from=:port_from, port_to=:port_to, action=:action, priority=:priority, enabled=:enabled, updated_at=:updated_at
		 WHERE id=:id AND tenant_id=:tenant_id`,
		rule)
	if err != nil {
		return nil, err
	}
	return r.GetFirewallRuleByID(ctx, tenantID, rule.ID)
}

func (r *Repository) DeleteFirewallRule(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM firewall_rules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// ---------- LoadBalancer ----------

func (r *Repository) CreateLoadBalancer(ctx context.Context, lb *models.LoadBalancer) error {
	lb.ID = uuid.New().String()
	if lb.Scheme == "" {
		lb.Scheme = "internet-facing"
	}
	if lb.Type == "" {
		lb.Type = "nlb"
	}
	lb.Status = "provisioning"
	lb.CreatedAt = time.Now().UTC()
	lb.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO load_balancers (id, tenant_id, name, vpc_id, scheme, type, dns_name, status, created_at, updated_at)
		 VALUES (:id, :tenant_id, :name, :vpc_id, :scheme, :type, :dns_name, :status, :created_at, :updated_at)`,
		lb)
	return err
}

func (r *Repository) GetLoadBalancerByID(ctx context.Context, tenantID, id string) (*models.LoadBalancer, error) {
	var lb models.LoadBalancer
	err := r.db.GetContext(ctx, &lb,
		`SELECT * FROM load_balancers WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &lb, nil
}

func (r *Repository) ListLoadBalancers(ctx context.Context, tenantID string) ([]models.LoadBalancer, error) {
	var lbs []models.LoadBalancer
	err := r.db.SelectContext(ctx, &lbs,
		`SELECT * FROM load_balancers WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return lbs, err
}

func (r *Repository) UpdateLoadBalancer(ctx context.Context, lb *models.LoadBalancer, tenantID string) (*models.LoadBalancer, error) {
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE load_balancers SET name=:name, scheme=:scheme, type=:type, dns_name=:dns_name, status=:status, updated_at=:updated_at
		 WHERE id=:id AND tenant_id=:tenant_id`,
		lb)
	if err != nil {
		return nil, err
	}
	return r.GetLoadBalancerByID(ctx, tenantID, lb.ID)
}

func (r *Repository) DeleteLoadBalancer(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM load_balancers WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// ---------- DNSRecord ----------

func (r *Repository) CreateDNSRecord(ctx context.Context, record *models.DNSRecord) error {
	record.ID = uuid.New().String()
	if record.TTL == 0 {
		record.TTL = 300
	}
	record.Enabled = true
	record.CreatedAt = time.Now().UTC()
	record.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO dns_records (id, tenant_id, zone_id, name, type, value, ttl, priority, enabled, created_at, updated_at)
		 VALUES (:id, :tenant_id, :zone_id, :name, :type, :value, :ttl, :priority, :enabled, :created_at, :updated_at)`,
		record)
	return err
}

func (r *Repository) GetDNSRecordByID(ctx context.Context, tenantID, id string) (*models.DNSRecord, error) {
	var record models.DNSRecord
	err := r.db.GetContext(ctx, &record,
		`SELECT * FROM dns_records WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &record, nil
}

func (r *Repository) ListDNSRecords(ctx context.Context, tenantID string) ([]models.DNSRecord, error) {
	var records []models.DNSRecord
	err := r.db.SelectContext(ctx, &records,
		`SELECT * FROM dns_records WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return records, err
}

func (r *Repository) ListDNSRecordsByZone(ctx context.Context, tenantID, zoneID string) ([]models.DNSRecord, error) {
	var records []models.DNSRecord
	err := r.db.SelectContext(ctx, &records,
		`SELECT * FROM dns_records WHERE tenant_id=$1 AND zone_id=$2 ORDER BY name, type`, tenantID, zoneID)
	return records, err
}

func (r *Repository) UpdateDNSRecord(ctx context.Context, record *models.DNSRecord, tenantID string) (*models.DNSRecord, error) {
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE dns_records SET name=:name, type=:type, value=:value, ttl=:ttl, priority=:priority, enabled=:enabled, updated_at=:updated_at
		 WHERE id=:id AND tenant_id=:tenant_id`,
		record)
	if err != nil {
		return nil, err
	}
	return r.GetDNSRecordByID(ctx, tenantID, record.ID)
}

func (r *Repository) DeleteDNSRecord(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM dns_records WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}
