package models

import "time"

// VPC represents a Virtual Private Cloud network resource.
type VPC struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	CIDR      string    `json:"cidr" db:"cidr"`
	Region    string    `json:"region" db:"region"`
	Status    string    `json:"status" db:"status"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// Subnet represents a subnet within a VPC.
type Subnet struct {
	ID              string    `json:"id" db:"id"`
	TenantID        string    `json:"tenant_id" db:"tenant_id"`
	VPCID           string    `json:"vpc_id" db:"vpc_id"`
	Name            string    `json:"name" db:"name"`
	CIDR            string    `json:"cidr" db:"cidr"`
	AvailabilityZone string    `json:"availability_zone" db:"availability_zone"`
	Status          string    `json:"status" db:"status"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
}

// FirewallRule represents an inbound/outbound firewall rule.
type FirewallRule struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	VPCID       string    `json:"vpc_id" db:"vpc_id"`
	Name        string    `json:"name" db:"name"`
	Protocol    string    `json:"protocol" db:"protocol"`
	Direction   string    `json:"direction" db:"direction"`
	SourceCIDR  string    `json:"source_cidr" db:"source_cidr"`
	DestCIDR    string    `json:"dest_cidr" db:"dest_cidr"`
	PortFrom    int       `json:"port_from" db:"port_from"`
	PortTo      int       `json:"port_to" db:"port_to"`
	Action      string    `json:"action" db:"action"`
	Priority    int       `json:"priority" db:"priority"`
	Enabled     bool      `json:"enabled" db:"enabled"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// LoadBalancer represents a cloud load balancer resource.
type LoadBalancer struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	VPCID     string    `json:"vpc_id" db:"vpc_id"`
	Scheme    string    `json:"scheme" db:"scheme"`
	Type      string    `json:"type" db:"type"`
	DNSName   string    `json:"dns_name" db:"dns_name"`
	Status    string    `json:"status" db:"status"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// DNSRecord represents a DNS record in a zone.
type DNSRecord struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	ZoneID    string    `json:"zone_id" db:"zone_id"`
	Name      string    `json:"name" db:"name"`
	Type      string    `json:"type" db:"type"`
	Value     string    `json:"value" db:"value"`
	TTL       int       `json:"ttl" db:"ttl"`
	Priority  int       `json:"priority" db:"priority"`
	Enabled   bool      `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// ---------- Request / Response types ----------

// CreateVPCRequest is the request body for creating a VPC.
type CreateVPCRequest struct {
	Name   string `json:"name" binding:"required"`
	CIDR   string `json:"cidr" binding:"required"`
	Region string `json:"region"`
}

// UpdateVPCRequest contains optional fields for updating a VPC.
type UpdateVPCRequest struct {
	Name *string `json:"name"`
	CIDR *string `json:"cidr"`
}

// CreateSubnetRequest is the request body for creating a subnet.
type CreateSubnetRequest struct {
	VPCID string `json:"vpc_id" binding:"required"`
	Name  string `json:"name" binding:"required"`
	CIDR  string `json:"cidr" binding:"required"`
	AZ    string `json:"availability_zone"`
}

// UpdateSubnetRequest contains optional fields for updating a subnet.
type UpdateSubnetRequest struct {
	Name *string `json:"name"`
	CIDR *string `json:"cidr"`
	AZ   *string `json:"availability_zone"`
}

// CreateFirewallRuleRequest is the request body for creating a firewall rule.
type CreateFirewallRuleRequest struct {
	VPCID       string `json:"vpc_id" binding:"required"`
	Name        string `json:"name" binding:"required"`
	Protocol    string `json:"protocol" binding:"required"`
	Direction   string `json:"direction" binding:"required"`
	SourceCIDR  string `json:"source_cidr"`
	DestCIDR    string `json:"dest_cidr"`
	PortFrom    int    `json:"port_from"`
	PortTo      int    `json:"port_to"`
	Action      string `json:"action" binding:"required"`
	Priority    int    `json:"priority"`
	Enabled     *bool  `json:"enabled"`
}

// UpdateFirewallRuleRequest contains optional fields for updating a firewall rule.
type UpdateFirewallRuleRequest struct {
	Name       *string `json:"name"`
	Protocol   *string `json:"protocol"`
	Direction  *string `json:"direction"`
	SourceCIDR *string `json:"source_cidr"`
	DestCIDR   *string `json:"dest_cidr"`
	PortFrom   *int    `json:"port_from"`
	PortTo     *int    `json:"port_to"`
	Action     *string `json:"action"`
	Priority   *int    `json:"priority"`
	Enabled    *bool   `json:"enabled"`
}

// CreateLoadBalancerRequest is the request body for creating a load balancer.
type CreateLoadBalancerRequest struct {
	Name   string `json:"name" binding:"required"`
	VPCID  string `json:"vpc_id" binding:"required"`
	Scheme string `json:"scheme"`
	Type   string `json:"type"`
	DNSName *string `json:"dns_name"`
}

// UpdateLoadBalancerRequest contains optional fields for updating a load balancer.
type UpdateLoadBalancerRequest struct {
	Name    *string `json:"name"`
	Scheme  *string `json:"scheme"`
	Type    *string `json:"type"`
	DNSName *string `json:"dns_name"`
}

// CreateDNSRecordRequest is the request body for creating a DNS record.
type CreateDNSRecordRequest struct {
	ZoneID   string `json:"zone_id" binding:"required"`
	Name     string `json:"name" binding:"required"`
	Type     string `json:"type" binding:"required"`
	Value    string `json:"value" binding:"required"`
	TTL      int    `json:"ttl"`
	Priority int    `json:"priority"`
	Enabled  *bool  `json:"enabled"`
}

// UpdateDNSRecordRequest contains optional fields for updating a DNS record.
type UpdateDNSRecordRequest struct {
	Name     *string `json:"name"`
	Type     *string `json:"type"`
	Value    *string `json:"value"`
	TTL      *int    `json:"ttl"`
	Priority *int    `json:"priority"`
	Enabled  *bool   `json:"enabled"`
}
