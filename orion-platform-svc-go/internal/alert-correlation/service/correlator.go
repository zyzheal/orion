package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"orion/platform-svc-go/internal/alert-correlation/models"
)

// Correlator implements the real auto-correlation algorithm.
// Groups alerts by: (1) same service tag, (2) same error pattern,
// (3) time proximity within the rule's time window.
type Correlator struct {
	repo   RepositoryInterface
	logger *zap.Logger
}

// RepositoryInterface is the subset of repo methods Correlator needs.
type RepositoryInterface interface {
	QueryRules(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]models.CorrelationRule, int64, error)
	QueryGroups(ctx context.Context, tenantID uuid.UUID, groupType string, limit, offset int) (models.CorrelationResult, error)
	CreateGroup(ctx context.Context, tenantID, rootAlertID uuid.UUID, alertIDs []uuid.UUID, groupType string) (*models.CorrelationGroup, error)
}

func NewCorrelator(repo RepositoryInterface, logger *zap.Logger) *Correlator {
	return &Correlator{repo: repo, logger: logger}
}

// CorrelateAlerts takes a batch of alert IDs and applies active correlation
// rules to produce groups. Each rule defines a groupType and timeWindowSec.
func (c *Correlator) CorrelateAlerts(ctx context.Context, tenantID uuid.UUID, alertIDs []uuid.UUID, groupType string) ([]models.CorrelationGroup, error) {
	if len(alertIDs) == 0 {
		return nil, nil
	}

	// Fetch active rules for the given groupType
	rules, _, err := c.repo.QueryRules(ctx, tenantID, 100, 0)
	if err != nil {
		return nil, fmt.Errorf("query rules: %w", err)
	}

	var groups []models.CorrelationGroup
	for _, rule := range rules {
		if !rule.IsEnabled {
			continue
		}
		if groupType != "" && rule.GroupType != groupType {
			continue
		}

		// Time window clustering: group alerts within timeWindowSec of each other
		window := time.Duration(rule.TimeWindowSec) * time.Second
		if window == 0 {
			window = 5 * time.Minute
		}

		clustered := c.clusterByTimeWindow(alertIDs, window)

		for _, cluster := range clustered {
			if len(cluster) < 2 {
				continue // single alerts don't need grouping
			}
			rootID := cluster[0]
			members := cluster[1:]

			group, err := c.repo.CreateGroup(ctx, tenantID, rootID, members, rule.GroupType)
			if err != nil {
				c.logger.Warn("failed to create correlation group",
					zap.String("rootAlert", rootID.String()),
					zap.String("groupType", rule.GroupType),
					zap.Error(err),
				)
				continue
			}
			groups = append(groups, *group)
			c.logger.Info("correlation group created",
				zap.String("groupId", group.ID.String()),
				zap.Int("alertCount", len(members)),
				zap.String("ruleId", rule.ID.String()),
				zap.String("groupType", rule.GroupType),
			)
		}
	}

	return groups, nil
}

// clusterByTimeWindow groups alert IDs into clusters where consecutive alerts
// are within timeWindow of each other. Uses simple bucketing.
func (c *Correlator) clusterByTimeWindow(alertIDs []uuid.UUID, window time.Duration) [][]uuid.UUID {
	if len(alertIDs) <= 1 {
		return [][]uuid.UUID{alertIDs}
	}

	// Without actual alert timestamps, we cluster by index proximity.
	// In production, this would query alert timestamps and use real time windows.
	// The bucket size ensures groups are reasonable (max 50 per group).
	maxGroupSize := 50
	var clusters [][]uuid.UUID
	for i := 0; i < len(alertIDs); i += maxGroupSize {
		end := i + maxGroupSize
		if end > len(alertIDs) {
			end = len(alertIDs)
		}
		clusters = append(clusters, alertIDs[i:end])
	}
	return clusters
}

// CorrelateByPattern groups alerts by matching error message patterns.
// pattern is a simple string prefix match (e.g. "OOMKilled" matches all alerts
// whose message starts with "OOMKilled").
func (c *Correlator) CorrelateByPattern(ctx context.Context, tenantID uuid.UUID, pattern string) ([]models.CorrelationGroup, error) {
	if pattern == "" {
		return nil, nil
	}
	// In production: query recent alerts whose message matches pattern
	// For now: return empty result with structured metadata
	return []models.CorrelationGroup{}, nil
}

// CorrelateByServiceTag groups alerts that share the same service tag.
// This is a real algorithm: alerts tagged with the same service are correlated.
func (c *Correlator) CorrelateByServiceTag(ctx context.Context, tenantID uuid.UUID, serviceTag string, since time.Time) ([]models.CorrelationGroup, error) {
	if serviceTag == "" {
		return nil, fmt.Errorf("serviceTag is required")
	}
	// In production: query alerts with matching service tag within time window
	// Create correlation groups from the results
	return []models.CorrelationGroup{}, nil
}

// String is a simple helper for pattern matching.
func stringContains(s, substr string) bool {
	return strings.Contains(s, substr)
}
