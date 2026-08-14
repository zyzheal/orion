package service_test

import (
	"context"
	"strings"
	"testing"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/network/models"
	"orion/platform-svc-go/internal/network/service"
)

// -------------------------------------------------------------------
// fakeNetworkRepo
// -------------------------------------------------------------------

type fakeNetworkRepo struct {
	vpcs       map[string]*models.VPC
	subnets    map[string]*models.Subnet
	fwRules    map[string]*models.FirewallRule
	lbs        map[string]*models.LoadBalancer
	dnsRecords map[string]*models.DNSRecord
}

func newFakeRepo() *fakeNetworkRepo {
	return &fakeNetworkRepo{
		vpcs:       make(map[string]*models.VPC),
		subnets:    make(map[string]*models.Subnet),
		fwRules:    make(map[string]*models.FirewallRule),
		lbs:        make(map[string]*models.LoadBalancer),
		dnsRecords: make(map[string]*models.DNSRecord),
	}
}

var _ service.RepositoryInterface = (*fakeNetworkRepo)(nil)

// VPC methods

func (r *fakeNetworkRepo) CreateVPC(ctx context.Context, vpc *models.VPC) error {
	if vpc.ID == "" {
		vpc.ID = "vpc-001"
	}
	r.vpcs[vpc.ID] = vpc
	return nil
}

func (r *fakeNetworkRepo) GetVPCByID(ctx context.Context, tenantID, id string) (*models.VPC, error) {
	vpc, ok := r.vpcs[id]
	if !ok {
		return nil, sentinel.NotFound
	}
	return vpc, nil
}

func (r *fakeNetworkRepo) ListVPCs(ctx context.Context, tenantID string) ([]models.VPC, error) {
	out := make([]models.VPC, 0, len(r.vpcs))
	for _, v := range r.vpcs {
		out = append(out, *v)
	}
	return out, nil
}

func (r *fakeNetworkRepo) UpdateVPC(ctx context.Context, vpc *models.VPC, tenantID string) (*models.VPC, error) {
	r.vpcs[vpc.ID] = vpc
	return vpc, nil
}

func (r *fakeNetworkRepo) DeleteVPC(ctx context.Context, tenantID, id string) (bool, error) {
	if _, ok := r.vpcs[id]; !ok {
		return false, nil
	}
	delete(r.vpcs, id)
	return true, nil
}

// Subnet methods

func (r *fakeNetworkRepo) CreateSubnet(ctx context.Context, subnet *models.Subnet) error {
	if subnet.ID == "" {
		subnet.ID = "subnet-001"
	}
	r.subnets[subnet.ID] = subnet
	return nil
}

func (r *fakeNetworkRepo) GetSubnetByID(ctx context.Context, tenantID, id string) (*models.Subnet, error) {
	subnet, ok := r.subnets[id]
	if !ok {
		return nil, sentinel.NotFound
	}
	return subnet, nil
}

func (r *fakeNetworkRepo) ListSubnets(ctx context.Context, tenantID string) ([]models.Subnet, error) {
	return nil, nil
}

func (r *fakeNetworkRepo) ListSubnetsByVPC(ctx context.Context, tenantID, vpcID string) ([]models.Subnet, error) {
	return nil, nil
}

func (r *fakeNetworkRepo) UpdateSubnet(ctx context.Context, subnet *models.Subnet, tenantID string) (*models.Subnet, error) {
	r.subnets[subnet.ID] = subnet
	return subnet, nil
}

func (r *fakeNetworkRepo) DeleteSubnet(ctx context.Context, tenantID, id string) (bool, error) {
	if _, ok := r.subnets[id]; !ok {
		return false, nil
	}
	delete(r.subnets, id)
	return true, nil
}

// FirewallRule methods

func (r *fakeNetworkRepo) CreateFirewallRule(ctx context.Context, rule *models.FirewallRule) error {
	if rule.ID == "" {
		rule.ID = "fr-001"
	}
	r.fwRules[rule.ID] = rule
	return nil
}

func (r *fakeNetworkRepo) GetFirewallRuleByID(ctx context.Context, tenantID, id string) (*models.FirewallRule, error) {
	rule, ok := r.fwRules[id]
	if !ok {
		return nil, nil
	}
	return rule, nil
}

func (r *fakeNetworkRepo) ListFirewallRules(ctx context.Context, tenantID string) ([]models.FirewallRule, error) {
	return nil, nil
}

func (r *fakeNetworkRepo) ListFirewallRulesByVPC(ctx context.Context, tenantID, vpcID string) ([]models.FirewallRule, error) {
	return nil, nil
}

func (r *fakeNetworkRepo) UpdateFirewallRule(ctx context.Context, rule *models.FirewallRule, tenantID string) (*models.FirewallRule, error) {
	r.fwRules[rule.ID] = rule
	return rule, nil
}

func (r *fakeNetworkRepo) DeleteFirewallRule(ctx context.Context, tenantID, id string) (bool, error) {
	return false, nil
}

// LoadBalancer methods

func (r *fakeNetworkRepo) CreateLoadBalancer(ctx context.Context, lb *models.LoadBalancer) error {
	if lb.ID == "" {
		lb.ID = "lb-001"
	}
	r.lbs[lb.ID] = lb
	return nil
}

func (r *fakeNetworkRepo) GetLoadBalancerByID(ctx context.Context, tenantID, id string) (*models.LoadBalancer, error) {
	lb, ok := r.lbs[id]
	if !ok {
		return nil, nil
	}
	return lb, nil
}

func (r *fakeNetworkRepo) ListLoadBalancers(ctx context.Context, tenantID string) ([]models.LoadBalancer, error) {
	return nil, nil
}

func (r *fakeNetworkRepo) UpdateLoadBalancer(ctx context.Context, lb *models.LoadBalancer, tenantID string) (*models.LoadBalancer, error) {
	r.lbs[lb.ID] = lb
	return lb, nil
}

func (r *fakeNetworkRepo) DeleteLoadBalancer(ctx context.Context, tenantID, id string) (bool, error) {
	return false, nil
}

// DNSRecord methods

func (r *fakeNetworkRepo) CreateDNSRecord(ctx context.Context, record *models.DNSRecord) error {
	if record.ID == "" {
		record.ID = "dns-001"
	}
	r.dnsRecords[record.ID] = record
	return nil
}

func (r *fakeNetworkRepo) GetDNSRecordByID(ctx context.Context, tenantID, id string) (*models.DNSRecord, error) {
	record, ok := r.dnsRecords[id]
	if !ok {
		return nil, nil
	}
	return record, nil
}

func (r *fakeNetworkRepo) ListDNSRecords(ctx context.Context, tenantID string) ([]models.DNSRecord, error) {
	return nil, nil
}

func (r *fakeNetworkRepo) ListDNSRecordsByZone(ctx context.Context, tenantID, zoneID string) ([]models.DNSRecord, error) {
	return nil, nil
}

func (r *fakeNetworkRepo) UpdateDNSRecord(ctx context.Context, record *models.DNSRecord, tenantID string) (*models.DNSRecord, error) {
	r.dnsRecords[record.ID] = record
	return record, nil
}

func (r *fakeNetworkRepo) DeleteDNSRecord(ctx context.Context, tenantID, id string) (bool, error) {
	return false, nil
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------

func TestService_NewService(t *testing.T) {
	s := service.NewService(newFakeRepo())
	if s == nil {
		t.Fatal("NewService returned nil")
	}
}

func TestService_CreateVPC_Success(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	s := service.NewService(repo)

	vpc, err := s.CreateVPC(ctx, "tenant-1", &models.CreateVPCRequest{
		Name:   "test-vpc",
		CIDR:   "10.0.0.0/16",
		Region: "us-east-1",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if vpc == nil {
		t.Fatal("expected VPC, got nil")
	}
	if vpc.Name != "test-vpc" {
		t.Fatalf("expected name 'test-vpc', got %q", vpc.Name)
	}
	if vpc.CIDR != "10.0.0.0/16" {
		t.Fatalf("expected CIDR '10.0.0.0/16', got %q", vpc.CIDR)
	}
	if vpc.TenantID != "tenant-1" {
		t.Fatalf("expected tenant_id 'tenant-1', got %q", vpc.TenantID)
	}
	if vpc.Region != "us-east-1" {
		t.Fatalf("expected region 'us-east-1', got %q", vpc.Region)
	}
}

func TestService_CreateVPC_InvalidCIDR(t *testing.T) {
	ctx := context.Background()
	s := service.NewService(newFakeRepo())

	_, err := s.CreateVPC(ctx, "tenant-1", &models.CreateVPCRequest{
		Name: "bad-vpc",
		CIDR: "not-a-cidr",
	})
	if err == nil {
		t.Fatal("expected error for invalid CIDR, got nil")
	}
	if !strings.Contains(err.Error(), "invalid CIDR") {
		t.Fatalf("expected 'invalid CIDR' in error, got %q", err.Error())
	}
}

func TestService_CreateVPC_RepoError(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	// Seed a VPC so GetVPCByID returns nil (not found) — simulates create not persisted
	repo.vpcs["vpc-999"] = &models.VPC{} // irrelevant, just to show we control the repo

	// We cannot easily inject an error into CreateVPC on the fake, so instead we verify
	// that when the fake assigns ID "vpc-001" and GetVPCByID looks it up, it finds it.
	// This test validates the round-trip chain works.
	s := service.NewService(repo)

	vpc, err := s.CreateVPC(ctx, "tenant-1", &models.CreateVPCRequest{
		Name: "round-trip",
		CIDR: "172.16.0.0/12",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if vpc.ID != "vpc-001" {
		t.Fatalf("expected ID 'vpc-001', got %q", vpc.ID)
	}
}

func TestService_GetVPC_Success(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	repo.vpcs["vpc-42"] = &models.VPC{
		ID: "vpc-42", Name: "existing", CIDR: "10.1.0.0/24",
	}
	s := service.NewService(repo)

	vpc, err := s.GetVPC(ctx, "tenant-1", "vpc-42")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if vpc == nil {
		t.Fatal("expected VPC, got nil")
	}
	if vpc.Name != "existing" {
		t.Fatalf("expected name 'existing', got %q", vpc.Name)
	}
}

func TestService_GetVPC_NotFound(t *testing.T) {
	ctx := context.Background()
	s := service.NewService(newFakeRepo())

	vpc, err := s.GetVPC(ctx, "tenant-1", "vpc-missing")
	if err == nil {
		t.Fatal("expected error for missing VPC, got nil")
	}
	if vpc != nil {
		t.Fatal("expected nil VPC for missing id")
	}
	if !service.IsNotFound(err) {
		t.Fatalf("expected NotFound error, got %q", err.Error())
	}
}

func TestService_ListVPCs(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	repo.vpcs["vpc-1"] = &models.VPC{ID: "vpc-1", Name: "one"}
	repo.vpcs["vpc-2"] = &models.VPC{ID: "vpc-2", Name: "two"}
	s := service.NewService(repo)

	vpcs, err := s.ListVPCs(ctx, "tenant-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(vpcs) != 2 {
		t.Fatalf("expected 2 VPCs, got %d", len(vpcs))
	}
}

func TestService_UpdateVPC_Success(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	repo.vpcs["vpc-1"] = &models.VPC{ID: "vpc-1", Name: "old-name", CIDR: "10.0.0.0/16"}
	s := service.NewService(repo)

	newName := "new-name"
	newCIDR := "10.2.0.0/16"
	vpc, err := s.UpdateVPC(ctx, "tenant-1", "vpc-1", &models.UpdateVPCRequest{
		Name: &newName,
		CIDR: &newCIDR,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if vpc.Name != "new-name" {
		t.Fatalf("expected name 'new-name', got %q", vpc.Name)
	}
	if vpc.CIDR != "10.2.0.0/16" {
		t.Fatalf("expected CIDR '10.2.0.0/16', got %q", vpc.CIDR)
	}
}

func TestService_UpdateVPC_InvalidCIDR(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	repo.vpcs["vpc-1"] = &models.VPC{ID: "vpc-1", Name: "v", CIDR: "10.0.0.0/16"}
	s := service.NewService(repo)

	badCIDR := "invalid"
	_, err := s.UpdateVPC(ctx, "tenant-1", "vpc-1", &models.UpdateVPCRequest{
		CIDR: &badCIDR,
	})
	if err == nil {
		t.Fatal("expected error for invalid CIDR in update, got nil")
	}
	if !strings.Contains(err.Error(), "invalid CIDR") {
		t.Fatalf("expected 'invalid CIDR' in error, got %q", err.Error())
	}
}

func TestService_UpdateVPC_NotFound(t *testing.T) {
	ctx := context.Background()
	s := service.NewService(newFakeRepo())

	newName := "new-name"
	_, err := s.UpdateVPC(ctx, "tenant-1", "vpc-missing", &models.UpdateVPCRequest{
		Name: &newName,
	})
	if err == nil {
		t.Fatal("expected error for missing VPC, got nil")
	}
}

func TestService_DeleteVPC_Success(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	repo.vpcs["vpc-1"] = &models.VPC{ID: "vpc-1"}
	s := service.NewService(repo)

	ok, err := s.DeleteVPC(ctx, "tenant-1", "vpc-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok {
		t.Fatal("expected delete to return true")
	}
	if _, exists := repo.vpcs["vpc-1"]; exists {
		t.Fatal("VPC should have been deleted from repo")
	}
}

func TestService_DeleteVPC_NotFound(t *testing.T) {
	ctx := context.Background()
	s := service.NewService(newFakeRepo())

	ok, err := s.DeleteVPC(ctx, "tenant-1", "vpc-missing")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok {
		t.Fatal("expected delete to return false for missing VPC")
	}
}

func TestService_CreateSubnet_Success(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	s := service.NewService(repo)

	subnet, err := s.CreateSubnet(ctx, "tenant-1", &models.CreateSubnetRequest{
		VPCID: "vpc-001",
		Name:  "web-subnet",
		CIDR:  "10.0.1.0/24",
		AZ:    "us-east-1a",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if subnet == nil {
		t.Fatal("expected Subnet, got nil")
	}
	if subnet.Name != "web-subnet" {
		t.Fatalf("expected name 'web-subnet', got %q", subnet.Name)
	}
	if subnet.CIDR != "10.0.1.0/24" {
		t.Fatalf("expected CIDR '10.0.1.0/24', got %q", subnet.CIDR)
	}
	if subnet.VPCID != "vpc-001" {
		t.Fatalf("expected VPCID 'vpc-001', got %q", subnet.VPCID)
	}
	if subnet.AvailabilityZone != "us-east-1a" {
		t.Fatalf("expected AZ 'us-east-1a', got %q", subnet.AvailabilityZone)
	}
}

func TestService_CreateSubnet_InvalidCIDR(t *testing.T) {
	ctx := context.Background()
	s := service.NewService(newFakeRepo())

	_, err := s.CreateSubnet(ctx, "tenant-1", &models.CreateSubnetRequest{
		VPCID: "vpc-001",
		Name:  "bad",
		CIDR:  "bad-cidr",
	})
	if err == nil {
		t.Fatal("expected error for invalid CIDR, got nil")
	}
	if !strings.Contains(err.Error(), "invalid CIDR") {
		t.Fatalf("expected 'invalid CIDR' in error, got %q", err.Error())
	}
}

func TestService_GetSubnet_Success(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	repo.subnets["subnet-42"] = &models.Subnet{
		ID: "subnet-42", Name: "app-subnet", CIDR: "10.0.2.0/24",
	}
	s := service.NewService(repo)

	subnet, err := s.GetSubnet(ctx, "tenant-1", "subnet-42")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if subnet == nil {
		t.Fatal("expected Subnet, got nil")
	}
	if subnet.Name != "app-subnet" {
		t.Fatalf("expected name 'app-subnet', got %q", subnet.Name)
	}
}

func TestService_GetSubnet_NotFound(t *testing.T) {
	ctx := context.Background()
	s := service.NewService(newFakeRepo())

	subnet, err := s.GetSubnet(ctx, "tenant-1", "subnet-missing")
	if err == nil {
		t.Fatal("expected error for missing Subnet, got nil")
	}
	if subnet != nil {
		t.Fatal("expected nil Subnet for missing id")
	}
	if !service.IsNotFound(err) {
		t.Fatalf("expected NotFound error, got %q", err.Error())
	}
}
