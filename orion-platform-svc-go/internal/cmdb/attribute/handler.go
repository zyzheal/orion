// Package attribute — DDD façade for GATE-DDD-MIGRATION-PROGRESS.
package attribute

// AttributeAggregate is the DDD aggregate root for Attribute.
type AttributeAggregate = Attribute

// AttributeCreateCommand is the write command to create a new attribute.
type AttributeCreateCommand struct {
	Name        string
	Type        string
	Description string
}

// AttributeHandler is the DDD handler for Attribute commands.
type AttributeHandler struct{}

// NewAttributeHandler creates a new attribute handler.
func NewAttributeHandler() *AttributeHandler {
	return &AttributeHandler{}
}
