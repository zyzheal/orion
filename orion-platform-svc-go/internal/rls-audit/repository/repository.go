package repository

import (
	"context"

	"orion/platform-svc-go/internal/rls-audit/models"
)

// Interface abstracts persistence of audit findings.
type Interface interface {
	SaveTableAudit(ctx context.Context, t *models.TableAudit) error
	GetTableAudit(ctx context.Context, database, schema, table string) (*models.TableAudit, error)
	ListTableAudits(ctx context.Context, database string) ([]*models.TableAudit, error)

	SaveDatabaseAudit(ctx context.Context, d *models.DatabaseAudit) error
	GetDatabaseAudit(ctx context.Context, database string) (*models.DatabaseAudit, error)
	ListDatabaseAudits(ctx context.Context) ([]*models.DatabaseAudit, error)

	SaveGap(ctx context.Context, g *models.GapFinding) error
	ListGaps(ctx context.Context, database string, severity string) ([]*models.GapFinding, error)
}
