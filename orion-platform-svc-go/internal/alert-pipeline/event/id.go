package event

import (
	"fmt"
	"time"
)

// GenerateEventID returns a stable, sortable event identifier.
func GenerateEventID() string {
	return fmt.Sprintf("evt-%d", time.Now().UnixNano())
}
