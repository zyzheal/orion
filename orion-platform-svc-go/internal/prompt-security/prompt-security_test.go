package prompt_security_test

import (
	"testing"

	"orion/platform-svc-go/internal/prompt-security/models"
	"orion/platform-svc-go/internal/prompt-security/service"
)

func TestPromptSecurity_NewService_Nil(t *testing.T) {
	s := service.NewPromptSecurityService(nil, nil)
	if s == nil {
		t.Fatal("NewPromptSecurityService returned nil")
	}
}

func TestPromptSecurity_ModelsCompile(t *testing.T) {
	scan := models.SecurityScan{
		ID:     "scan-1",
		Score:  0.5,
		IsSafe: true,
	}
	if scan.ID != "scan-1" || scan.IsSafe != true {
		t.Fatalf("unexpected scan: %+v", scan)
	}
}

func TestPromptSecurity_PackageAvailable(t *testing.T) {
	_ = models.ScanRequest{}
	_ = models.ScanResponse{}
}
