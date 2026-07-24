package service

import (
	"context"
	"errors"
	"fmt"
	"net"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/network/models"
)

// RepositoryInterface defines the data access contract used by the service.
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

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// validateCIDR checks that a string is a valid CIDR notation.
func validateCIDR(cidr string) error {
	_, _, err := net.ParseCIDR(cidr)
	if err != nil {
		return fmt.Errorf("invalid CIDR: %w", err)
	}
	return nil
}

// ---------- VPC ----------

func (s *Service) CreateVPC(ctx context.Context, tenantID string, req *models.CreateVPCRequest) (*models.VPC, error) {
	if err := validateCIDR(req.CIDR); err != nil {
		return nil, err
	}
	vpc := &models.VPC{
		TenantID: tenantID,
		Name:     req.Name,
		CIDR:     req.CIDR,
		Region:   req.Region,
	}
	err := s.repo.CreateVPC(ctx, vpc)
	if err != nil {
		return nil, err
	}
	return s.repo.GetVPCByID(ctx, tenantID, vpc.ID)
}

func (s *Service) GetVPC(ctx context.Context, tenantID, id string) (*models.VPC, error) {
	return s.repo.GetVPCByID(ctx, tenantID, id)
}

func (s *Service) ListVPCs(ctx context.Context, tenantID string) ([]models.VPC, error) {
	return s.repo.ListVPCs(ctx, tenantID)
}

func (s *Service) UpdateVPC(ctx context.Context, tenantID, id string, req *models.UpdateVPCRequest) (*models.VPC, error) {
	vpc, err := s.repo.GetVPCByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		vpc.Name = *req.Name
	}
	if req.CIDR != nil {
		if err := validateCIDR(*req.CIDR); err != nil {
			return nil, err
		}
		vpc.CIDR = *req.CIDR
	}
	return s.repo.UpdateVPC(ctx, vpc, tenantID)
}

func (s *Service) DeleteVPC(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.DeleteVPC(ctx, tenantID, id)
}

// ---------- Subnet ----------

func (s *Service) CreateSubnet(ctx context.Context, tenantID string, req *models.CreateSubnetRequest) (*models.Subnet, error) {
	if err := validateCIDR(req.CIDR); err != nil {
		return nil, err
	}
	subnet := &models.Subnet{
		TenantID:         tenantID,
		VPCID:            req.VPCID,
		Name:             req.Name,
		CIDR:             req.CIDR,
		AvailabilityZone: req.AZ,
	}
	err := s.repo.CreateSubnet(ctx, subnet)
	if err != nil {
		return nil, err
	}
	return s.repo.GetSubnetByID(ctx, tenantID, subnet.ID)
}

func (s *Service) GetSubnet(ctx context.Context, tenantID, id string) (*models.Subnet, error) {
	return s.repo.GetSubnetByID(ctx, tenantID, id)
}

func (s *Service) ListSubnets(ctx context.Context, tenantID string) ([]models.Subnet, error) {
	return s.repo.ListSubnets(ctx, tenantID)
}

func (s *Service) ListSubnetsByVPC(ctx context.Context, tenantID, vpcID string) ([]models.Subnet, error) {
	return s.repo.ListSubnetsByVPC(ctx, tenantID, vpcID)
}

func (s *Service) UpdateSubnet(ctx context.Context, tenantID, id string, req *models.UpdateSubnetRequest) (*models.Subnet, error) {
	subnet, err := s.repo.GetSubnetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		subnet.Name = *req.Name
	}
	if req.CIDR != nil {
		if err := validateCIDR(*req.CIDR); err != nil {
			return nil, err
		}
		subnet.CIDR = *req.CIDR
	}
	if req.AZ != nil {
		subnet.AvailabilityZone = *req.AZ
	}
	return s.repo.UpdateSubnet(ctx, subnet, tenantID)
}

func (s *Service) DeleteSubnet(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.DeleteSubnet(ctx, tenantID, id)
}

// ---------- FirewallRule ----------

func (s *Service) CreateFirewallRule(ctx context.Context, tenantID string, req *models.CreateFirewallRuleRequest) (*models.FirewallRule, error) {
	if req.PortFrom < 0 || req.PortTo < 0 || req.PortFrom > 65535 || req.PortTo > 65535 {
		return nil, fmt.Errorf("invalid port range: port_from=%d port_to=%d", req.PortFrom, req.PortTo)
	}
	if req.PortTo != 0 && req.PortTo < req.PortFrom {
		return nil, fmt.Errorf("invalid port range: port_to < port_from")
	}

	if req.SourceCIDR != "" {
		if err := validateCIDR(req.SourceCIDR); err != nil {
			return nil, err
		}
	}
	if req.DestCIDR != "" {
		if err := validateCIDR(req.DestCIDR); err != nil {
			return nil, err
		}
	}
	rule := &models.FirewallRule{
		TenantID:   tenantID,
		VPCID:      req.VPCID,
		Name:       req.Name,
		Protocol:   req.Protocol,
		Direction:  req.Direction,
		SourceCIDR: req.SourceCIDR,
		DestCIDR:   req.DestCIDR,
		PortFrom:   req.PortFrom,
		PortTo:     req.PortTo,
		Action:     req.Action,
		Priority:   req.Priority,
	}
	if req.Enabled != nil {
		rule.Enabled = *req.Enabled
	}
	err := s.repo.CreateFirewallRule(ctx, rule)
	if err != nil {
		return nil, err
	}
	return s.repo.GetFirewallRuleByID(ctx, tenantID, rule.ID)
}

func (s *Service) GetFirewallRule(ctx context.Context, tenantID, id string) (*models.FirewallRule, error) {
	return s.repo.GetFirewallRuleByID(ctx, tenantID, id)
}

func (s *Service) ListFirewallRules(ctx context.Context, tenantID string) ([]models.FirewallRule, error) {
	return s.repo.ListFirewallRules(ctx, tenantID)
}

func (s *Service) ListFirewallRulesByVPC(ctx context.Context, tenantID, vpcID string) ([]models.FirewallRule, error) {
	return s.repo.ListFirewallRulesByVPC(ctx, tenantID, vpcID)
}

func (s *Service) UpdateFirewallRule(ctx context.Context, tenantID, id string, req *models.UpdateFirewallRuleRequest) (*models.FirewallRule, error) {
	rule, err := s.repo.GetFirewallRuleByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		rule.Name = *req.Name
	}
	if req.Protocol != nil {
		rule.Protocol = *req.Protocol
	}
	if req.Direction != nil {
		rule.Direction = *req.Direction
	}
	if req.SourceCIDR != nil {
		if *req.SourceCIDR != "" {
			if err := validateCIDR(*req.SourceCIDR); err != nil {
				return nil, err
			}
		}
		rule.SourceCIDR = *req.SourceCIDR
	}
	if req.DestCIDR != nil {
		if *req.DestCIDR != "" {
			if err := validateCIDR(*req.DestCIDR); err != nil {
				return nil, err
			}
		}
		rule.DestCIDR = *req.DestCIDR
	}
	if req.PortFrom != nil {
		rule.PortFrom = *req.PortFrom
	}
	if req.PortTo != nil {
		rule.PortTo = *req.PortTo
	}
	if req.Action != nil {
		rule.Action = *req.Action
	}
	if req.Priority != nil {
		rule.Priority = *req.Priority
	}
	if req.Enabled != nil {
		rule.Enabled = *req.Enabled
	}
	return s.repo.UpdateFirewallRule(ctx, rule, tenantID)
}

func (s *Service) DeleteFirewallRule(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.DeleteFirewallRule(ctx, tenantID, id)
}

// ---------- LoadBalancer ----------

func (s *Service) CreateLoadBalancer(ctx context.Context, tenantID string, req *models.CreateLoadBalancerRequest) (*models.LoadBalancer, error) {
	lb := &models.LoadBalancer{
		TenantID: tenantID,
		Name:     req.Name,
		VPCID:    req.VPCID,
		Scheme:   req.Scheme,
		Type:     req.Type,
		DNSName:  "",
	}
	err := s.repo.CreateLoadBalancer(ctx, lb)
	if err != nil {
		return nil, err
	}
	return s.repo.GetLoadBalancerByID(ctx, tenantID, lb.ID)
}

func (s *Service) GetLoadBalancer(ctx context.Context, tenantID, id string) (*models.LoadBalancer, error) {
	return s.repo.GetLoadBalancerByID(ctx, tenantID, id)
}

func (s *Service) ListLoadBalancers(ctx context.Context, tenantID string) ([]models.LoadBalancer, error) {
	return s.repo.ListLoadBalancers(ctx, tenantID)
}

func (s *Service) UpdateLoadBalancer(ctx context.Context, tenantID, id string, req *models.UpdateLoadBalancerRequest) (*models.LoadBalancer, error) {
	lb, err := s.repo.GetLoadBalancerByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		lb.Name = *req.Name
	}
	if req.Scheme != nil {
		lb.Scheme = *req.Scheme
	}
	if req.Type != nil {
		lb.Type = *req.Type
	}
	if req.DNSName != nil {
		lb.DNSName = *req.DNSName
	}
	return s.repo.UpdateLoadBalancer(ctx, lb, tenantID)
}

func (s *Service) DeleteLoadBalancer(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.DeleteLoadBalancer(ctx, tenantID, id)
}

// ---------- DNSRecord ----------

func (s *Service) CreateDNSRecord(ctx context.Context, tenantID string, req *models.CreateDNSRecordRequest) (*models.DNSRecord, error) {
	if req.TTL < 0 {
		return nil, fmt.Errorf("invalid TTL: %d", req.TTL)
	}
	record := &models.DNSRecord{
		TenantID: tenantID,
		ZoneID:   req.ZoneID,
		Name:     req.Name,
		Type:     req.Type,
		Value:    req.Value,
		TTL:      req.TTL,
		Priority: req.Priority,
	}
	if req.Enabled != nil {
		record.Enabled = *req.Enabled
	}
	err := s.repo.CreateDNSRecord(ctx, record)
	if err != nil {
		return nil, err
	}
	return s.repo.GetDNSRecordByID(ctx, tenantID, record.ID)
}

func (s *Service) GetDNSRecord(ctx context.Context, tenantID, id string) (*models.DNSRecord, error) {
	return s.repo.GetDNSRecordByID(ctx, tenantID, id)
}

func (s *Service) ListDNSRecords(ctx context.Context, tenantID string) ([]models.DNSRecord, error) {
	return s.repo.ListDNSRecords(ctx, tenantID)
}

func (s *Service) ListDNSRecordsByZone(ctx context.Context, tenantID, zoneID string) ([]models.DNSRecord, error) {
	return s.repo.ListDNSRecordsByZone(ctx, tenantID, zoneID)
}

func (s *Service) UpdateDNSRecord(ctx context.Context, tenantID, id string, req *models.UpdateDNSRecordRequest) (*models.DNSRecord, error) {
	record, err := s.repo.GetDNSRecordByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		record.Name = *req.Name
	}
	if req.Type != nil {
		record.Type = *req.Type
	}
	if req.Value != nil {
		record.Value = *req.Value
	}
	if req.TTL != nil {
		if *req.TTL < 0 {
			return nil, fmt.Errorf("invalid TTL: %d", *req.TTL)
		}
		record.TTL = *req.TTL
	}
	if req.Priority != nil {
		record.Priority = *req.Priority
	}
	if req.Enabled != nil {
		record.Enabled = *req.Enabled
	}
	return s.repo.UpdateDNSRecord(ctx, record, tenantID)
}

func (s *Service) DeleteDNSRecord(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.DeleteDNSRecord(ctx, tenantID, id)
}

// IsNotFound returns true if err is sentinel.NotFound.
func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}
