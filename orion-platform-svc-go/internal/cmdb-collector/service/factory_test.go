package service

import (
	"testing"
	"time"

	"orion/platform-svc-go/internal/cmdb-collector/models"
)

// Tests for business logic that is independent of the concrete sqlx repository:
// model validation, filter definitions, error constants, and AdapterFactoryOptions.

func TestCMDBAdapterValidCategory(t *testing.T) {
	valid := []string{"cloud", "network", "database", "middleware", "os", "app"}
	for _, c := range valid {
		a := models.CMDBAdapter{Category: c}
		if !a.ValidCategory() {
			t.Errorf("%q should be a valid category", c)
		}
	}
	invalid := models.CMDBAdapter{Category: "something-else"}
	if invalid.ValidCategory() {
		t.Error("something-else should be invalid")
	}
}

func TestCMDBDiscoveryJobValidStatus(t *testing.T) {
	valid := []string{"pending", "running", "completed", "failed"}
	for _, s := range valid {
		j := models.CMDBDiscoveryJob{Status: s}
		if !j.ValidStatus() {
			t.Errorf("%q should be a valid status", s)
		}
	}
	invalid := models.CMDBDiscoveryJob{Status: "completed-wrong"}
	if invalid.ValidStatus() {
		t.Error("completed-wrong should be invalid")
	}
}

func TestListAdaptersFilterDefaults(t *testing.T) {
	f := ListAdaptersFilter{}
	if f.Category != "" {
		t.Error("default Category should be empty")
	}
	if f.Offset != 0 {
		t.Errorf("default Offset=%d, want 0", f.Offset)
	}
	if f.Limit != 0 {
		t.Errorf("default Limit=%d, want 0", f.Limit)
	}
}

func TestListAssetsFilterDefaults(t *testing.T) {
	f := ListAssetsFilter{}
	if f.AdapterID != "" {
		t.Error("default AdapterID should be empty")
	}
	if f.AssetType != "" {
		t.Error("default AssetType should be empty")
	}
	if f.Offset != 0 {
		t.Errorf("default Offset=%d, want 0", f.Offset)
	}
	if f.Limit != 0 {
		t.Errorf("default Limit=%d, want 0", f.Limit)
	}
}

func TestAdapterFactoryOptionsDefault(t *testing.T) {
	opts := &AdapterFactoryOptions{DefaultTenant: "default"}
	if opts.DefaultTenant != "default" {
		t.Errorf("DefaultTenant=%s, want default", opts.DefaultTenant)
	}
	if opts.Logger != nil {
		t.Error("Logger should be nil")
	}
}

func TestNewAdapterFactoryWithNilOpts(t *testing.T) {
	f := NewAdapterFactory(nil, nil, nil)
	if f == nil {
		t.Fatal("NewAdapterFactory with nil opts should not return nil")
	}
	if f.adapters == nil {
		t.Fatal("AdapterFactory.adapters should not be nil")
	}
	if f.defaultTenant != "" {
		t.Errorf("defaultTenant=%q, want empty", f.defaultTenant)
	}
}

func TestAdapterFactoryErrorsConstants(t *testing.T) {
	errs := []error{
		ErrAdapterFactoryNotFound,
		ErrAdapterNotInRegistry,
		ErrInvalidCategory,
		ErrInvalidConfig,
		ErrMissingAdapterID,
	}
	for _, e := range errs {
		if e == nil {
			t.Error("error constant should not be nil")
		}
	}
}

func TestCMDBAssetModel(t *testing.T) {
	a := models.CMDBAsset{
		ID:        "a1",
		TenantID:  "t1",
		Name:      "server1",
		AdapterID: "adp_1",
		AssetType: "server",
		Status:    "active",
	}
	if a.ID != "a1" {
		t.Error("ID mismatch")
	}
	if a.AssetType != "server" {
		t.Error("AssetType mismatch")
	}
}

func TestCMDBAdapterModel(t *testing.T) {
	a := &models.CMDBAdapter{
		ID:        "adp_1",
		TenantID:  "t1",
		Name:      "cisco-snmp",
		Category:  "network",
		Vendor:    "Cisco",
		Enabled:   true,
		CreatedAt: time.Now(),
	}
	if !a.ValidCategory() {
		t.Error("Category should be valid")
	}
	if !a.Enabled {
		t.Error("Enabled should be true")
	}
}
