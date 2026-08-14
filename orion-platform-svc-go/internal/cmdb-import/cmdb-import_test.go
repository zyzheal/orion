package cmdb_import_test

import (
	"testing"

	"orion/platform-svc-go/internal/cmdb-import/models"
	"orion/platform-svc-go/internal/cmdb-import/service"
)

func TestCmdbImport_NewManager(t *testing.T) {
	m := service.NewCMDBImportManager(nil)
	if m == nil {
		t.Fatal("NewCMDBImportManager returned nil")
	}
}

func TestCmdbImport_ModelsCompile(t *testing.T) {
	job := models.CMDBImportJob{
		ID:   "job-1",
		Name: "test-import",
	}
	if job.ID != "job-1" {
		t.Fatal("unexpected job")
	}
}

func TestCmdbImport_PackageAvailable(t *testing.T) {
	_ = models.CMDBImportRecord{}
}
