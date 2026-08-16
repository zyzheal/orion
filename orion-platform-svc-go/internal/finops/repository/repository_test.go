package repository

import (
	"testing"

	"orion/platform-svc-go/internal/finops/models"
)

func Test_NewRepository_Nil(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("NewRepository(nil) returned nil")
	}
}

func Test_ValidEntityType_Project(t *testing.T) {
	if !validEntityType(models.CostEntityTypeProject) {
		t.Fatal("CostEntityTypeProject should be valid")
	}
}

func Test_ValidEntityType_Tenant(t *testing.T) {
	if !validEntityType(models.CostEntityTypeTenant) {
		t.Fatal("CostEntityTypeTenant should be valid")
	}
}

func Test_ValidEntityType_Team(t *testing.T) {
	if !validEntityType(models.CostEntityTypeTeam) {
		t.Fatal("CostEntityTypeTeam should be valid")
	}
}

func Test_ValidEntityType_Invalid(t *testing.T) {
	if validEntityType(models.CostEntityType("invalid")) {
		t.Fatal("invalid entity type should not be valid")
	}
}

func Test_ValidEntityType_Empty(t *testing.T) {
	if validEntityType(models.CostEntityType("")) {
		t.Fatal("empty entity type should not be valid")
	}
}
