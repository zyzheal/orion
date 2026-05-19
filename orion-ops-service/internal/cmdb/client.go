package cmdb

import (
	"context"
	"fmt"
	"time"

	cmdbv1 "github.com/orion-platform/orion-proto/cmdb/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// Host represents a server host from CMDB
type Host struct {
	CiID       string
	IPAddress  string
	SSHPort    int
	SSHUser    string
	OSType     string
	Status     string
	Attributes map[string]string
}

// Relation represents a relationship between CIs
type Relation struct {
	ID           string
	SourceCiID   string
	TargetCiID   string
	RelationType string
	Attributes   map[string]string
	CreatedAt    time.Time
}

// Client is a gRPC client for the CMDB service
type Client struct {
	grpcConn *grpc.ClientConn
	client   cmdbv1.CMDBServiceClient
}

// NewClient creates a new CMDB client
func NewClient(addr string) (*Client, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to CMDB service: %w", err)
	}

	return &Client{
		grpcConn: conn,
		client:   cmdbv1.NewCMDBServiceClient(conn),
	}, nil
}

// GetHost retrieves a host by ID
func (c *Client) GetHost(ctx context.Context, hostID string) (*Host, error) {
	req := &cmdbv1.GetCIRequest{
		Id: hostID,
	}

	ci, err := c.client.GetCI(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get host: %w", err)
	}

	return &Host{
		CiID:       ci.Id,
		IPAddress:  ci.Attributes["ip_address"],
		SSHPort:    22, // default
		SSHUser:    ci.Attributes["ssh_user"],
		OSType:     ci.Attributes["os_type"],
		Status:     ci.Attributes["status"],
		Attributes: ci.Attributes,
	}, nil
}

// ListHosts retrieves all hosts for a tenant
func (c *Client) ListHosts(ctx context.Context, tenantID int64) ([]Host, error) {
	req := &cmdbv1.CIListRequest{
		CiType: "SERVER",
		Pagination: &cmdbv1.Pagination{
			Page:     1,
			PageSize: 1000,
		},
	}

	resp, err := c.client.ListCIs(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to list hosts: %w", err)
	}

	hosts := make([]Host, 0, len(resp.Cis))
	for _, ci := range resp.Cis {
		hosts = append(hosts, Host{
			CiID:       ci.Id,
			IPAddress:  ci.Attributes["ip_address"],
			SSHPort:    22,
			SSHUser:    ci.Attributes["ssh_user"],
			OSType:     ci.Attributes["os_type"],
			Status:     ci.Attributes["status"],
			Attributes: ci.Attributes,
		})
	}

	return hosts, nil
}

// GetRelations retrieves relations for a CI
func (c *Client) GetRelations(ctx context.Context, ciID string) ([]Relation, error) {
	req := &cmdbv1.GetRelationsRequest{
		SourceCiId: ciID,
	}

	resp, err := c.client.GetRelations(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get relations: %w", err)
	}

	relations := make([]Relation, 0, len(resp.Relations))
	for _, r := range resp.Relations {
		relations = append(relations, Relation{
			ID:           r.Id,
			SourceCiID:   r.SourceCiId,
			TargetCiID:   r.TargetCiId,
			RelationType: r.RelationType,
			Attributes:   r.Attributes,
			CreatedAt:    time.Unix(r.CreatedAt, 0),
		})
	}

	return relations, nil
}

// Close closes the gRPC connection
func (c *Client) Close() error {
	if c.grpcConn != nil {
		return c.grpcConn.Close()
	}
	return nil
}