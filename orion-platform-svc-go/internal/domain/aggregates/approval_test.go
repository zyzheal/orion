package aggregates

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"orion/platform-svc-go/internal/domain/events"
)

func TestApprovalAggregate_CreateApproval(t *testing.T) {
	t.Run("creates approval with PENDING status", func(t *testing.T) {
		agg := &ApprovalAggregate{
			BaseAggregate: BaseAggregate{
				AggregateID:   "appr-1",
				AggregateType: "approval",
				TenantID:      "tenant-1",
			},
			ApprovalType: "multi_level",
			TotalLevels:  2,
		}

		ev := agg.CreateApproval()

		assert.NotNil(t, ev)
		assert.Equal(t, "PENDING", agg.Status)

		created, ok := ev.(*events.ApprovalCreatedEvent)
		assert.True(t, ok)
		assert.Equal(t, "multi_level", created.ApprovalType)
		assert.Equal(t, 2, created.TotalLevels)
	})

	t.Run("can create approval without pre-set levels", func(t *testing.T) {
		agg := &ApprovalAggregate{ApprovalType: "simple"}
		ev := agg.CreateApproval()
		assert.NotNil(t, ev)
		assert.Equal(t, "PENDING", agg.Status)
	})
}

func TestApprovalAggregate_ApproveLevel(t *testing.T) {
	t.Run("approves a PENDING level", func(t *testing.T) {
		agg := &ApprovalAggregate{
			BaseAggregate: BaseAggregate{
				AggregateID:   "appr-1",
				AggregateType: "approval",
				TenantID:      "tenant-1",
			},
			ApprovalType: "multi_level",
			TotalLevels:  2,
			Status:       "PENDING",
			Approvals: []ApprovalLevel{
				{LevelID: "level-1", Order: 1, Status: "PENDING"},
				{LevelID: "level-2", Order: 2, Status: "PENDING"},
			},
		}

		ev := agg.ApproveLevel("level-1", "approver-1", "looks good")

		assert.NotNil(t, ev)
		assert.Equal(t, "APPROVED", agg.Approvals[0].Status)
		assert.Equal(t, "approver-1", agg.Approvals[0].ApproverID)
		assert.Equal(t, "looks good", agg.Approvals[0].Comment)
		assert.Equal(t, 1, agg.CurrentLevel)

		levelApproved, ok := ev.(*events.ApprovalLevelApprovedEvent)
		assert.True(t, ok)
		assert.Equal(t, "level-1", levelApproved.LevelID)
		assert.Equal(t, "approver-1", levelApproved.ApproverID)
	})

	t.Run("completes approval when all levels approved", func(t *testing.T) {
		agg := &ApprovalAggregate{
			BaseAggregate: BaseAggregate{
				AggregateID:   "appr-1",
				AggregateType: "approval",
				TenantID:      "tenant-1",
			},
			ApprovalType: "multi_level",
			TotalLevels:  2,
			Status:       "PENDING",
			Approvals: []ApprovalLevel{
				{LevelID: "level-1", Order: 1, Status: "PENDING"},
				{LevelID: "level-2", Order: 2, Status: "PENDING"},
			},
		}

		// Approve level 1
		ev1 := agg.ApproveLevel("level-1", "approver-1", "ok")
		assert.NotNil(t, ev1)
		_, isLevelApproved := ev1.(*events.ApprovalLevelApprovedEvent)
		assert.True(t, isLevelApproved)
		assert.Equal(t, "PENDING", agg.Status) // still pending

		// Approve level 2 — should complete the approval
		ev2 := agg.ApproveLevel("level-2", "approver-2", "approved")
		assert.NotNil(t, ev2)
		assert.Equal(t, "APPROVED", agg.Status)

		completed, ok := ev2.(*events.ApprovalCompletedEvent)
		assert.True(t, ok)
		assert.Equal(t, "multi_level", completed.ApprovalType)
		assert.Equal(t, 2, completed.TotalLevels)
	})

	t.Run("returns nil for already approved level", func(t *testing.T) {
		agg := &ApprovalAggregate{
			Status: "PENDING",
			Approvals: []ApprovalLevel{
				{LevelID: "level-1", Order: 1, Status: "APPROVED"},
			},
		}
		ev := agg.ApproveLevel("level-1", "approver-2", "again")
		assert.Nil(t, ev)
	})

	t.Run("returns nil for non-existent level", func(t *testing.T) {
		agg := &ApprovalAggregate{Status: "PENDING"}
		ev := agg.ApproveLevel("nonexistent", "approver-1", "")
		assert.Nil(t, ev)
	})

	t.Run("returns nil for rejected level", func(t *testing.T) {
		agg := &ApprovalAggregate{
			Status: "REJECTED",
			Approvals: []ApprovalLevel{
				{LevelID: "level-1", Order: 1, Status: "REJECTED"},
			},
		}
		ev := agg.ApproveLevel("level-1", "approver-2", "")
		assert.Nil(t, ev)
	})
}

func TestApprovalAggregate_RejectLevel(t *testing.T) {
	t.Run("rejects a PENDING level", func(t *testing.T) {
		agg := &ApprovalAggregate{
			BaseAggregate: BaseAggregate{
				AggregateID:   "appr-1",
				AggregateType: "approval",
				TenantID:      "tenant-1",
			},
			ApprovalType: "multi_level",
			Status:       "PENDING",
			Approvals: []ApprovalLevel{
				{LevelID: "level-1", Order: 1, Status: "PENDING"},
			},
		}

		ev := agg.RejectLevel("level-1", "approver-1", "not approved")

		assert.NotNil(t, ev)
		assert.Equal(t, "REJECTED", agg.Approvals[0].Status)
		assert.Equal(t, "REJECTED", agg.Status)
		assert.Equal(t, "approver-1", agg.Approvals[0].ApproverID)
		assert.Equal(t, "not approved", agg.Approvals[0].Comment)

		rejected, ok := ev.(*events.ApprovalLevelRejectedEvent)
		assert.True(t, ok)
		assert.Equal(t, "level-1", rejected.LevelID)
		assert.Equal(t, "approver-1", rejected.ApproverID)
		assert.Equal(t, "not approved", rejected.Comment)
	})

	t.Run("returns nil for already approved level", func(t *testing.T) {
		agg := &ApprovalAggregate{
			Approvals: []ApprovalLevel{
				{LevelID: "level-1", Order: 1, Status: "APPROVED"},
			},
		}
		ev := agg.RejectLevel("level-1", "approver-2", "")
		assert.Nil(t, ev)
	})

	t.Run("returns nil for non-existent level", func(t *testing.T) {
		agg := &ApprovalAggregate{}
		ev := agg.RejectLevel("nonexistent", "approver-1", "")
		assert.Nil(t, ev)
	})
}

func TestApprovalAggregate_CancelApproval(t *testing.T) {
	t.Run("cancels a PENDING approval", func(t *testing.T) {
		agg := &ApprovalAggregate{
			BaseAggregate: BaseAggregate{
				AggregateID:   "appr-1",
				AggregateType: "approval",
				TenantID:      "tenant-1",
			},
			ApprovalType: "multi_level",
			Status:       "PENDING",
		}

		ev := agg.CancelApproval("no longer needed")

		assert.NotNil(t, ev)
		assert.Equal(t, "CANCELLED", agg.Status)

		cancelled, ok := ev.(*events.ApprovalCancelledEvent)
		assert.True(t, ok)
		assert.Equal(t, "multi_level", cancelled.ApprovalType)
		assert.Equal(t, "no longer needed", cancelled.Reason)
	})

	t.Run("returns nil when not PENDING", func(t *testing.T) {
		tests := []struct {
			name   string
			status string
		}{
			{"APPROVED", "APPROVED"},
			{"REJECTED", "REJECTED"},
			{"CANCELLED", "CANCELLED"},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				agg := &ApprovalAggregate{Status: tt.status}
				ev := agg.CancelApproval("test")
				assert.Nil(t, ev)
			})
		}
	})
}

func TestApprovalAggregate_Apply(t *testing.T) {
	t.Run("replays ApprovalCreatedEvent", func(t *testing.T) {
		agg := &ApprovalAggregate{}
		agg.Apply(&events.ApprovalCreatedEvent{})
		assert.Equal(t, "PENDING", agg.Status)
	})

	t.Run("replays ApprovalCompletedEvent", func(t *testing.T) {
		agg := &ApprovalAggregate{Status: "PENDING"}
		agg.Apply(&events.ApprovalCompletedEvent{})
		assert.Equal(t, "APPROVED", agg.Status)
	})

	t.Run("replays ApprovalCancelledEvent", func(t *testing.T) {
		agg := &ApprovalAggregate{Status: "PENDING"}
		agg.Apply(&events.ApprovalCancelledEvent{})
		assert.Equal(t, "CANCELLED", agg.Status)
	})

	t.Run("replays ApprovalLevelRejectedEvent - status unchanged", func(t *testing.T) {
		// Rejection status is set by the domain method, not by replay
		agg := &ApprovalAggregate{Status: "PENDING"}
		agg.Apply(&events.ApprovalLevelRejectedEvent{})
		assert.Equal(t, "PENDING", agg.Status)
	})
}

func TestApprovalAggregate_FindLevel(t *testing.T) {
	t.Run("finds level by ID", func(t *testing.T) {
		agg := &ApprovalAggregate{
			Approvals: []ApprovalLevel{
				{LevelID: "level-1", Order: 1},
				{LevelID: "level-2", Order: 2},
			},
		}
		level := agg.findLevel("level-2")
		assert.NotNil(t, level)
		assert.Equal(t, "level-2", level.LevelID)
	})

	t.Run("returns nil for non-existent level", func(t *testing.T) {
		agg := &ApprovalAggregate{}
		level := agg.findLevel("nonexistent")
		assert.Nil(t, level)
	})
}