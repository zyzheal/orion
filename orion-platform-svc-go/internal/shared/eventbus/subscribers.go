package eventbus

import "context"

// AlertTriggeredSubscriber handles alert.triggered events.
type AlertTriggeredSubscriber interface {
	HandleAlertTriggered(ctx context.Context, event StandardEvent) error
}

// AlertResolvedSubscriber handles alert.resolved events.
type AlertResolvedSubscriber interface {
	HandleAlertResolved(ctx context.Context, event StandardEvent) error
}

// PipelineStartedSubscriber handles pipeline.started events.
type PipelineStartedSubscriber interface {
	HandlePipelineStarted(ctx context.Context, event StandardEvent) error
}

// PipelineCompletedSubscriber handles pipeline.completed events.
type PipelineCompletedSubscriber interface {
	HandlePipelineCompleted(ctx context.Context, event StandardEvent) error
}

// PipelineFailedSubscriber handles pipeline.failed events.
type PipelineFailedSubscriber interface {
	HandlePipelineFailed(ctx context.Context, event StandardEvent) error
}

// IncidentCreatedSubscriber handles incident.created events.
type IncidentCreatedSubscriber interface {
	HandleIncidentCreated(ctx context.Context, event StandardEvent) error
}

// IncidentUpdatedSubscriber handles incident.updated events.
type IncidentUpdatedSubscriber interface {
	HandleIncidentUpdated(ctx context.Context, event StandardEvent) error
}

// ChangeApprovedSubscriber handles change.approved events.
type ChangeApprovedSubscriber interface {
	HandleChangeApproved(ctx context.Context, event StandardEvent) error
}

// ChangeRejectedSubscriber handles change.rejected events.
type ChangeRejectedSubscriber interface {
	HandleChangeRejected(ctx context.Context, event StandardEvent) error
}

// CMDBUpdatedSubscriber handles cmdb.updated events.
type CMDBUpdatedSubscriber interface {
	HandleCMDBUpdated(ctx context.Context, event StandardEvent) error
}

// ApprovalSubmittedSubscriber handles approval.submitted events.
type ApprovalSubmittedSubscriber interface {
	HandleApprovalSubmitted(ctx context.Context, event StandardEvent) error
}

// ApprovalApprovedSubscriber handles approval.approved events.
type ApprovalApprovedSubscriber interface {
	HandleApprovalApproved(ctx context.Context, event StandardEvent) error
}

// DeploymentStartedSubscriber handles deployment.started events.
type DeploymentStartedSubscriber interface {
	HandleDeploymentStarted(ctx context.Context, event StandardEvent) error
}

// DeploymentFailedSubscriber handles deployment.failed events.
type DeploymentFailedSubscriber interface {
	HandleDeploymentFailed(ctx context.Context, event StandardEvent) error
}

// ChatOpsMessageSubscriber handles chatops.message events.
type ChatOpsMessageSubscriber interface {
	HandleChatOpsMessage(ctx context.Context, event StandardEvent) error
}

// RegisterAlertTriggered creates an EventHandler from an AlertTriggeredSubscriber.
func RegisterAlertTriggered(s AlertTriggeredSubscriber) EventHandler {
	return func(ctx context.Context, event StandardEvent) error {
		return s.HandleAlertTriggered(ctx, event)
	}
}

// RegisterAlertResolved creates an EventHandler from an AlertResolvedSubscriber.
func RegisterAlertResolved(s AlertResolvedSubscriber) EventHandler {
	return func(ctx context.Context, event StandardEvent) error {
		return s.HandleAlertResolved(ctx, event)
	}
}

// RegisterPipelineStarted creates an EventHandler from a PipelineStartedSubscriber.
func RegisterPipelineStarted(s PipelineStartedSubscriber) EventHandler {
	return func(ctx context.Context, event StandardEvent) error {
		return s.HandlePipelineStarted(ctx, event)
	}
}

// RegisterPipelineCompleted creates an EventHandler from a PipelineCompletedSubscriber.
func RegisterPipelineCompleted(s PipelineCompletedSubscriber) EventHandler {
	return func(ctx context.Context, event StandardEvent) error {
		return s.HandlePipelineCompleted(ctx, event)
	}
}

// RegisterPipelineFailed creates an EventHandler from a PipelineFailedSubscriber.
func RegisterPipelineFailed(s PipelineFailedSubscriber) EventHandler {
	return func(ctx context.Context, event StandardEvent) error {
		return s.HandlePipelineFailed(ctx, event)
	}
}

// RegisterIncidentCreated creates an EventHandler from an IncidentCreatedSubscriber.
func RegisterIncidentCreated(s IncidentCreatedSubscriber) EventHandler {
	return func(ctx context.Context, event StandardEvent) error {
		return s.HandleIncidentCreated(ctx, event)
	}
}

// RegisterIncidentUpdated creates an EventHandler from an IncidentUpdatedSubscriber.
func RegisterIncidentUpdated(s IncidentUpdatedSubscriber) EventHandler {
	return func(ctx context.Context, event StandardEvent) error {
		return s.HandleIncidentUpdated(ctx, event)
	}
}

// RegisterChangeApproved creates an EventHandler from a ChangeApprovedSubscriber.
func RegisterChangeApproved(s ChangeApprovedSubscriber) EventHandler {
	return func(ctx context.Context, event StandardEvent) error {
		return s.HandleChangeApproved(ctx, event)
	}
}

// RegisterChangeRejected creates an EventHandler from a ChangeRejectedSubscriber.
func RegisterChangeRejected(s ChangeRejectedSubscriber) EventHandler {
	return func(ctx context.Context, event StandardEvent) error {
		return s.HandleChangeRejected(ctx, event)
	}
}

// RegisterCMDBUpdated creates an EventHandler from a CMDBUpdatedSubscriber.
func RegisterCMDBUpdated(s CMDBUpdatedSubscriber) EventHandler {
	return func(ctx context.Context, event StandardEvent) error {
		return s.HandleCMDBUpdated(ctx, event)
	}
}

// RegisterApprovalSubmitted creates an EventHandler from an ApprovalSubmittedSubscriber.
func RegisterApprovalSubmitted(s ApprovalSubmittedSubscriber) EventHandler {
	return func(ctx context.Context, event StandardEvent) error {
		return s.HandleApprovalSubmitted(ctx, event)
	}
}

// RegisterApprovalApproved creates an EventHandler from an ApprovalApprovedSubscriber.
func RegisterApprovalApproved(s ApprovalApprovedSubscriber) EventHandler {
	return func(ctx context.Context, event StandardEvent) error {
		return s.HandleApprovalApproved(ctx, event)
	}
}

// RegisterDeploymentStarted creates an EventHandler from a DeploymentStartedSubscriber.
func RegisterDeploymentStarted(s DeploymentStartedSubscriber) EventHandler {
	return func(ctx context.Context, event StandardEvent) error {
		return s.HandleDeploymentStarted(ctx, event)
	}
}

// RegisterDeploymentFailed creates an EventHandler from a DeploymentFailedSubscriber.
func RegisterDeploymentFailed(s DeploymentFailedSubscriber) EventHandler {
	return func(ctx context.Context, event StandardEvent) error {
		return s.HandleDeploymentFailed(ctx, event)
	}
}

// RegisterChatOpsMessage creates an EventHandler from a ChatOpsMessageSubscriber.
func RegisterChatOpsMessage(s ChatOpsMessageSubscriber) EventHandler {
	return func(ctx context.Context, event StandardEvent) error {
		return s.HandleChatOpsMessage(ctx, event)
	}
}
