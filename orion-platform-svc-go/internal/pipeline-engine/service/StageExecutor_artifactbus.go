// StageExecutor ArtifactBus integration (ADR-014 §3.2.3).
//
// Opt-in artifact propagation via chainable methods + helper.
// ExecuteTask is NOT modified — existing callers are unaffected.
//
// Design:
//   - WithArtifactBus attaches a bus (nil = no propagation).
//   - PublishOutputs is called explicitly after a successful task;
//     it never blocks stage execution (ADR-014 §3.3 降级路径).
//   - Individual publish failures are counted and returned, but do
//     not abort the loop.
package service

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/pipeline/artifactbus"
)

// ArtifactBusAdapter wraps an artifactbus.ArtifactBus so StageExecutor
// can depend on the interface without exposing the type.
type ArtifactBusAdapter struct {
	bus artifactbus.ArtifactBus
}

// PublishOutputs publishes each output as a separate artifact named
// "<taskName>.<outputKey>". Returns the count of successfully
// published artifacts and the first error (if any).
//
// No-op when the bus is nil or outputs is empty. Individual publish
// failures are counted (published < len(outputs)) and the first error
// is returned — callers can decide whether to log or retry.
func (s *StageExecutor) PublishOutputs(
	ctx context.Context,
	tenantID, pipelineRunID, stageID, taskName string,
	outputs map[string]string,
) (int, error) {
	if s.artifactBusAdapter == nil || s.artifactBusAdapter.bus == nil {
		return 0, nil
	}
	if len(outputs) == 0 {
		return 0, nil
	}

	published := 0
	var firstErr error
	for name, content := range outputs {
		a := &artifactbus.Artifact{
			TenantID:      tenantID,
			PipelineRunID: pipelineRunID,
			StageID:       stageID,
			Name:          taskName + "." + name,
			ContentType:   "text/plain",
			Content:       []byte(content),
		}
		if err := s.artifactBusAdapter.bus.Publish(ctx, a); err != nil {
			if firstErr == nil {
				firstErr = fmt.Errorf("publish %q: %w", a.Name, err)
			}
			continue
		}
		published++
	}
	return published, firstErr
}

// WithArtifactBus attaches an ArtifactBus. Chainable. nil is accepted
// (equivalent to not calling this method — PublishOutputs no-ops).
func (s *StageExecutor) WithArtifactBus(bus artifactbus.ArtifactBus) *StageExecutor {
	if bus != nil {
		s.artifactBusAdapter = &ArtifactBusAdapter{bus: bus}
	} else {
		s.artifactBusAdapter = nil
	}
	return s
}

// ArtifactBus returns the wired bus, or nil if none is wired. Useful
// for tests and for callers that want to publish custom artifacts
// (not derived from task outputs).
func (s *StageExecutor) ArtifactBus() artifactbus.ArtifactBus {
	if s.artifactBusAdapter == nil {
		return nil
	}
	return s.artifactBusAdapter.bus
}
