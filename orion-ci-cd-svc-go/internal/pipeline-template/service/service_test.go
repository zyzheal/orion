package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrPipelineTemplateNotFound.Error() != "template not found" { t.Errorf("unexpected: %s", ErrPipelineTemplateNotFound.Error()) }
}
