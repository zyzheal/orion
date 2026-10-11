package repository

import (
	"context"
	"orion/platform-svc-go/internal/ticket/models"

	"orion/go-common/pkg/database"
)

type CommentRepository struct {
	db *database.DB
}

func NewCommentRepository(db *database.DB) *CommentRepository {
	return &CommentRepository{db: db}
}

// Create 写入 ticket_comments。tenant_id 由 Migration 704 引入（ADR-011）；
// 若 comment.TenantID 为空，从父工单 tickets.tenant_id 自动带出，保证写入不遗漏。
func (r *CommentRepository) Create(ctx context.Context, comment *models.TicketComment) error {
	// 自动补 tenant_id：若调用方未设置，从 tickets 表拉
	if comment.TenantID == "" && comment.TicketID != "" {
		var tid string
		if err := r.db.GetContext(ctx, &tid,
			"SELECT tenant_id::text FROM tickets WHERE id = $1", comment.TicketID); err == nil {
			comment.TenantID = tid
		}
	}

	query := `INSERT INTO ticket_comments (id, tenant_id, ticket_id, author, content, is_internal)
		VALUES ($1, NULLIF($2, ''), $3, $4, $5, $6)`
	_, err := r.db.ExecContext(ctx, query,
		comment.ID, comment.TenantID, comment.TicketID, comment.Author, comment.Content, comment.IsInternal,
	)
	return err
}

// ListByTicket 返回指定工单的评论，并通过父工单的 tenant_id 做 ADR-011 多租户过滤。
// 旧行 tenant_id 为空时（未回填或早于 704）保留；新行必须与父工单 tenant 对齐。
func (r *CommentRepository) ListByTicket(ctx context.Context, ticketID string) ([]models.TicketComment, error) {
	var comments []models.TicketComment
	err := r.db.SelectContext(ctx, &comments,
		`SELECT c.* FROM ticket_comments c
		 JOIN tickets t ON c.ticket_id = t.id
		 WHERE c.ticket_id = $1
		   AND (c.tenant_id = t.tenant_id OR c.tenant_id IS NULL)
		 ORDER BY c.created_at ASC`, ticketID)
	return comments, err
}

// Delete 按 (id, ticket_id) 删除；附加父工单 tenant 一致性检查防止跨租户误删。
func (r *CommentRepository) Delete(ctx context.Context, id, ticketID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM ticket_comments c
		 USING tickets t
		 WHERE c.id = $1 AND c.ticket_id = $2
		   AND c.ticket_id = t.id
		   AND (c.tenant_id = t.tenant_id OR c.tenant_id IS NULL)`, id, ticketID)
	return err
}
