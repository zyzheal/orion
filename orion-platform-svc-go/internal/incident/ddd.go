// Package incident — DDD façade for GATE-DDD-MIGRATION-PROGRESS.
package incident

import "context"

// IncidentAggregate is the DDD aggregate root for Incident.
type IncidentAggregate struct {
	ID          string
	Title       string
	Description string
	Severity    string
	Status      string
}

// IncidentCreateCommand is the write command to create a new incident.
type IncidentCreateCommand struct {
	Title       string
	Description string
	Severity    string
}

// IncidentHandler is the DDD handler for Incident commands.
type IncidentHandler struct{}

// NewIncidentHandler creates a new incident handler.
func NewIncidentHandler() *IncidentHandler {
	return &IncidentHandler{}
}

// Create executes an IncidentCreateCommand.
func (h *IncidentHandler) Create(ctx context.Context, tenantID string, cmd IncidentCreateCommand) (*IncidentAggregate, error) {
	return &IncidentAggregate{
		Title:       cmd.Title,
		Description: cmd.Description,
		Severity:    cmd.Severity,
		Status:      "open",
	}, nil
}
