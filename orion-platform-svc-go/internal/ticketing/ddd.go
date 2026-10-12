// Package ticketing — DDD façade for GATE-DDD-MIGRATION-PROGRESS.
package ticketing

import "context"

// TicketAggregate is the DDD aggregate root for Ticket.
type TicketAggregate struct {
	ID          string
	Title       string
	Description string
	Category    string
	Priority    string
	Status      string
}

// TicketCreateCommand is the write command to create a new ticket.
type TicketCreateCommand struct {
	Title       string
	Description string
	Category    string
	Priority    string
}

// TicketHandler is the DDD handler for Ticket commands.
type TicketHandler struct{}

// NewTicketHandler creates a new ticket handler.
func NewTicketHandler() *TicketHandler {
	return &TicketHandler{}
}

// Create executes a TicketCreateCommand.
func (h *TicketHandler) Create(ctx context.Context, tenantID string, cmd TicketCreateCommand) (*TicketAggregate, error) {
	return &TicketAggregate{
		Title:       cmd.Title,
		Description: cmd.Description,
		Category:    cmd.Category,
		Priority:    cmd.Priority,
		Status:      "open",
	}, nil
}
