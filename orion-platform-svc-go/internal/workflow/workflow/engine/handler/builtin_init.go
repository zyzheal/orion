package handler

import (
	"log"
)

// init registers all built-in step handlers with the GlobalFactory.
// This runs when the package is imported, so the handlers are available
// without explicit registration code in main().
func init() {
	RegisterGlobal(&AssigneeStepHandler{})
	RegisterGlobal(&ActionStepHandler{})
	log.Println("[workflow-engine] built-in step handlers registered: assignee, action")
}
