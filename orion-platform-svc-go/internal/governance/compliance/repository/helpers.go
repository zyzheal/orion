package repository

import (
	"encoding/json"

	"orion/platform-svc-go/internal/compliance/models"
)

// findingsToJSONB converts a findings slice to JSONB bytes.
func findingsToJSONB(findings []models.ComplianceFinding) models.JSONB {
	data, _ := json.Marshal(findings)
	return models.JSONB(data)
}
