package service_test

import (
	"context"
	"errors"
	"testing"

	"orion/platform-svc-go/internal/graph/models"
	"orion/platform-svc-go/internal/graph/service"
)

// --- Service construction ---

func TestService_NewService(t *testing.T) {
	s := service.NewService(nil, nil)
	if s == nil {
		t.Fatal("NewService returned nil")
	}
}

func TestService_NewServiceInMemory(t *testing.T) {
	s := service.NewServiceInMemory()
	if s == nil {
		t.Fatal("NewServiceInMemory returned nil")
	}
}

// --- CreateNode ---

func TestService_CreateNode(t *testing.T) {
	s := service.NewServiceInMemory()
	ctx := context.Background()

	node, err := s.CreateNode(ctx, "tenant1", models.CreateNodeRequest{
		Labels: []string{"Service", "Production"},
		Properties: map[string]interface{}{
			"name":    "api-gateway",
			"version": "1.0",
		},
	})
	if err != nil {
		t.Fatalf("CreateNode returned error: %v", err)
	}
	if node == nil {
		t.Fatal("CreateNode returned nil node")
	}
	if node.ID == "" {
		t.Error("CreateNode: node ID is empty")
	}
	if node.TenantID != "tenant1" {
		t.Errorf("CreateNode: expected tenantID=tenant1, got %s", node.TenantID)
	}
	if node.Properties == nil {
		t.Fatal("CreateNode: properties is nil")
	}
	if name, ok := node.Properties["name"]; !ok || name != "api-gateway" {
		t.Errorf("CreateNode: expected name=api-gateway, got %v", node.Properties["name"])
	}
}

func TestService_CreateNode_InvalidLabel(t *testing.T) {
	s := service.NewServiceInMemory()
	ctx := context.Background()

	_, err := s.CreateNode(ctx, "tenant1", models.CreateNodeRequest{
		Labels: []string{"invalid label!"},
	})
	if err == nil {
		t.Fatal("CreateNode should reject invalid label")
	}
}

func TestService_CreateNode_EmptyLabels(t *testing.T) {
	s := service.NewServiceInMemory()
	ctx := context.Background()

	_, err := s.CreateNode(ctx, "tenant1", models.CreateNodeRequest{
		Labels: []string{},
	})
	if err != nil {
		t.Fatalf("CreateNode with empty labels slice returned error: %v", err)
	}
}

// --- GetNode ---

func TestService_GetNode(t *testing.T) {
	s := service.NewServiceInMemory()
	ctx := context.Background()

	created, err := s.CreateNode(ctx, "tenant1", models.CreateNodeRequest{
		Labels: []string{"Service"},
	})
	if err != nil {
		t.Fatalf("CreateNode failed: %v", err)
	}

	node, err := s.GetNode(ctx, "tenant1", created.ID)
	if err != nil {
		t.Fatalf("GetNode returned error: %v", err)
	}
	if node == nil {
		t.Fatal("GetNode returned nil")
	}
	if node.ID != created.ID {
		t.Errorf("GetNode: expected id=%s, got %s", created.ID, node.ID)
	}
}

func TestService_GetNode_NotFound(t *testing.T) {
	s := service.NewServiceInMemory()
	ctx := context.Background()

	_, err := s.GetNode(ctx, "tenant1", "nonexistent")
	if err == nil {
		t.Fatal("GetNode should return error for nonexistent node")
	}
	if !errors.Is(err, service.ErrNodeNotFound) {
		t.Errorf("GetNode: expected ErrNodeNotFound, got %v", err)
	}
}

// --- ListNodes ---

func TestService_ListNodes(t *testing.T) {
	s := service.NewServiceInMemory()
	ctx := context.Background()

	s.CreateNode(ctx, "tenant1", models.CreateNodeRequest{
		Labels: []string{"Service"},
	})
	s.CreateNode(ctx, "tenant1", models.CreateNodeRequest{
		Labels: []string{"Database"},
	})

	nodes, err := s.ListNodes(ctx, "tenant1", "", 0)
	if err != nil {
		t.Fatalf("ListNodes returned error: %v", err)
	}
	if len(nodes) != 2 {
		t.Errorf("ListNodes: expected 2 nodes, got %d", len(nodes))
	}
}

func TestService_ListNodes_LabelFilter(t *testing.T) {
	s := service.NewServiceInMemory()
	ctx := context.Background()

	s.CreateNode(ctx, "tenant1", models.CreateNodeRequest{
		Labels: []string{"Service"},
	})
	s.CreateNode(ctx, "tenant1", models.CreateNodeRequest{
		Labels: []string{"Database"},
	})

	nodes, err := s.ListNodes(ctx, "tenant1", "Service", 0)
	if err != nil {
		t.Fatalf("ListNodes returned error: %v", err)
	}
	if len(nodes) != 1 {
		t.Errorf("ListNodes with label filter: expected 1, got %d", len(nodes))
	}
}

func TestService_ListNodes_TenantIsolation(t *testing.T) {
	s := service.NewServiceInMemory()
	ctx := context.Background()

	s.CreateNode(ctx, "tenant1", models.CreateNodeRequest{
		Labels: []string{"Service"},
	})
	s.CreateNode(ctx, "tenant2", models.CreateNodeRequest{
		Labels: []string{"Service"},
	})

	nodes, err := s.ListNodes(ctx, "tenant1", "", 0)
	if err != nil {
		t.Fatalf("ListNodes returned error: %v", err)
	}
	if len(nodes) != 1 {
		t.Errorf("ListNodes tenant isolation: expected 1, got %d", len(nodes))
	}
}

// --- UpdateNode ---

func TestService_UpdateNode(t *testing.T) {
	s := service.NewServiceInMemory()
	ctx := context.Background()

	created, err := s.CreateNode(ctx, "tenant1", models.CreateNodeRequest{
		Labels: []string{"Service"},
		Properties: map[string]interface{}{
			"name": "old-name",
		},
	})
	if err != nil {
		t.Fatalf("CreateNode failed: %v", err)
	}

	newLabels := []string{"Service", "Updated"}
	updated, err := s.UpdateNode(ctx, "tenant1", created.ID, models.UpdateNodeRequest{
		Labels: &newLabels,
		Properties: map[string]interface{}{
			"name": "new-name",
		},
	})
	if err != nil {
		t.Fatalf("UpdateNode returned error: %v", err)
	}
	if name, ok := updated.Properties["name"]; !ok || name != "new-name" {
		t.Errorf("UpdateNode: expected name=new-name, got %v", updated.Properties["name"])
	}
}

func TestService_UpdateNode_NotFound(t *testing.T) {
	s := service.NewServiceInMemory()
	ctx := context.Background()

	newLabels := []string{"X"}
	_, err := s.UpdateNode(ctx, "tenant1", "nope", models.UpdateNodeRequest{
		Labels: &newLabels,
	})
	if err == nil {
		t.Fatal("UpdateNode should return error for nonexistent node")
	}
	if !errors.Is(err, service.ErrNodeNotFound) {
		t.Errorf("UpdateNode: expected ErrNodeNotFound, got %v", err)
	}
}

// --- DeleteNode ---

func TestService_DeleteNode(t *testing.T) {
	s := service.NewServiceInMemory()
	ctx := context.Background()

	created, err := s.CreateNode(ctx, "tenant1", models.CreateNodeRequest{
		Labels: []string{"Service"},
	})
	if err != nil {
		t.Fatalf("CreateNode failed: %v", err)
	}

	err = s.DeleteNode(ctx, "tenant1", created.ID)
	if err != nil {
		t.Fatalf("DeleteNode returned error: %v", err)
	}

	_, err = s.GetNode(ctx, "tenant1", created.ID)
	if err == nil {
		t.Fatal("GetNode should return error after delete")
	}
}

func TestService_DeleteNode_NotFound(t *testing.T) {
	s := service.NewServiceInMemory()
	ctx := context.Background()

	err := s.DeleteNode(ctx, "tenant1", "nope")
	if err == nil {
		t.Fatal("DeleteNode should return error for nonexistent node")
	}
}

// --- CreateRelationship ---

func TestService_CreateRelationship(t *testing.T) {
	s := service.NewServiceInMemory()
	ctx := context.Background()

	nodeA, err := s.CreateNode(ctx, "tenant1", models.CreateNodeRequest{
		Labels: []string{"Service"},
	})
	if err != nil {
		t.Fatalf("CreateNode A failed: %v", err)
	}
	nodeB, err := s.CreateNode(ctx, "tenant1", models.CreateNodeRequest{
		Labels: []string{"Service"},
	})
	if err != nil {
		t.Fatalf("CreateNode B failed: %v", err)
	}

	rel, err := s.CreateRelationship(ctx, "tenant1", models.CreateRelationshipRequest{
		Type:        "DEPENDS_ON",
		StartNodeID: nodeA.ID,
		EndNodeID:   nodeB.ID,
		Properties: map[string]interface{}{
			"since": "2024-01-01",
		},
	})
	if err != nil {
		t.Fatalf("CreateRelationship returned error: %v", err)
	}
	if rel == nil {
		t.Fatal("CreateRelationship returned nil")
	}
	if rel.Type != "DEPENDS_ON" {
		t.Errorf("CreateRelationship: expected type=DEPENDS_ON, got %s", rel.Type)
	}
	if rel.StartNodeID != nodeA.ID {
		t.Errorf("CreateRelationship: start node mismatch")
	}
	if rel.EndNodeID != nodeB.ID {
		t.Errorf("CreateRelationship: end node mismatch")
	}
}

func TestService_CreateRelationship_StartNodeNotFound(t *testing.T) {
	s := service.NewServiceInMemory()
	ctx := context.Background()

	s.CreateNode(ctx, "tenant1", models.CreateNodeRequest{
		Labels: []string{"Service"},
	})

	_, err := s.CreateRelationship(ctx, "tenant1", models.CreateRelationshipRequest{
		Type:        "CONNECTS",
		StartNodeID: "missing-start",
		EndNodeID:   "missing-end",
	})
	if err == nil {
		t.Fatal("CreateRelationship should reject missing start node")
	}
	if !errors.Is(err, service.ErrStartNodeNotFound) {
		t.Errorf("CreateRelationship: expected ErrStartNodeNotFound, got %v", err)
	}
}

func TestService_CreateRelationship_InvalidType(t *testing.T) {
	s := service.NewServiceInMemory()
	ctx := context.Background()

	nodeA, err := s.CreateNode(ctx, "tenant1", models.CreateNodeRequest{
		Labels: []string{"Service"},
	})
	if err != nil {
		t.Fatalf("CreateNode A failed: %v", err)
	}
	nodeB, err := s.CreateNode(ctx, "tenant1", models.CreateNodeRequest{
		Labels: []string{"Service"},
	})
	if err != nil {
		t.Fatalf("CreateNode B failed: %v", err)
	}

	_, err = s.CreateRelationship(ctx, "tenant1", models.CreateRelationshipRequest{
		Type:        "123 invalid",
		StartNodeID: nodeA.ID,
		EndNodeID:   nodeB.ID,
	})
	if err == nil {
		t.Fatal("CreateRelationship should reject invalid type")
	}
}
