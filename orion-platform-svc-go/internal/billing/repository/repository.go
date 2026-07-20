package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/billing/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Accounts ---

func (r *Repository) CreateAccount(ctx context.Context, account *models.Account) error {
	account.ID = uuid.New().String()
	account.CreatedAt = time.Now().UTC()
	account.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO billing_accounts (id, tenant_id, name, billing_email, payment_method, currency, status, credit_balance, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :billingEmail, :paymentMethod, :currency, :status, :creditBalance, :createdAt, :updatedAt)`,
		account)
	return err
}

func (r *Repository) GetAccountByID(ctx context.Context, tenantID, id string) (*models.Account, error) {
	var account models.Account
	err := r.db.GetContext(ctx, &account,
		`SELECT * FROM billing_accounts WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return &account, err
}

func (r *Repository) ListAccounts(ctx context.Context, tenantID string, status *string) ([]models.Account, error) {
	where := "WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2
	if status != nil && *status != "" {
		where += fmt.Sprintf(" AND status=$%d", argIdx)
		args = append(args, *status)
	}
	var accounts []models.Account
	err := r.db.SelectContext(ctx, &accounts,
		fmt.Sprintf(`SELECT * FROM billing_accounts %s ORDER BY created_at DESC`, where), args...)
	return accounts, err
}

func (r *Repository) UpdateAccount(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Account, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}
	updates["updated_at"] = time.Now().UTC()
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	result, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE billing_accounts SET %s WHERE id=$%d AND tenant_id=$%d`,
			strings.Join(setClauses, ", "), i, i+1), args...)
	if err != nil {
		return nil, err
	}
	if n, _ := result.RowsAffected(); n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetAccountByID(ctx, tenantID, id)
}

func (r *Repository) DeleteAccount(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM billing_accounts WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// --- Invoices ---

func (r *Repository) CreateInvoice(ctx context.Context, invoice *models.Invoice) error {
	invoice.ID = uuid.New().String()
	invoice.CreatedAt = time.Now().UTC()
	invoice.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO billing_invoices (id, tenant_id, account_id, invoice_number, period_start, period_end, total, tax, status, due_date, created_at, updated_at)
		 VALUES (:id, :tenantId, :accountId, :invoiceNumber, :periodStart, :periodEnd, :total, :tax, :status, :dueDate, :createdAt, :updatedAt)`,
		invoice)
	return err
}

func (r *Repository) GetInvoiceByID(ctx context.Context, tenantID, id string) (*models.Invoice, error) {
	var invoice models.Invoice
	err := r.db.GetContext(ctx, &invoice,
		`SELECT * FROM billing_invoices WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return &invoice, err
}

func (r *Repository) ListInvoices(ctx context.Context, tenantID string, filter *models.InvoiceFilter) ([]models.Invoice, int, error) {
	where := "WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.AccountID != nil && *filter.AccountID != "" {
			where += fmt.Sprintf(" AND account_id=$%d", argIdx)
			args = append(args, *filter.AccountID)
			argIdx++
		}
		if filter.Status != nil && *filter.Status != "" {
			where += fmt.Sprintf(" AND status=$%d", argIdx)
			args = append(args, *filter.Status)
			argIdx++
		}
		if filter.PeriodStart != nil && *filter.PeriodStart != "" {
			where += fmt.Sprintf(" AND period_start>=$%d", argIdx)
			args = append(args, *filter.PeriodStart)
			argIdx++
		}
		if filter.PeriodEnd != nil && *filter.PeriodEnd != "" {
			where += fmt.Sprintf(" AND period_end<=$%d", argIdx)
			args = append(args, *filter.PeriodEnd)
			argIdx++
		}
		if filter.Limit > 0 {
			where += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
			args = append(args, filter.Limit, filter.Offset)
		}
	}

	var invoices []models.Invoice
	err := r.db.SelectContext(ctx, &invoices,
		fmt.Sprintf(`SELECT * FROM billing_invoices %s ORDER BY created_at DESC`, where), args...)
	if err != nil {
		return nil, 0, err
	}

	// Count total
	countArgs := []interface{}{tenantID}
	countIdx := 2
	countWhere := "WHERE tenant_id=$1"
	if filter != nil {
		if filter.AccountID != nil && *filter.AccountID != "" {
			countWhere += fmt.Sprintf(" AND account_id=$%d", countIdx)
			countArgs = append(countArgs, *filter.AccountID)
			countIdx++
		}
		if filter.Status != nil && *filter.Status != "" {
			countWhere += fmt.Sprintf(" AND status=$%d", countIdx)
			countArgs = append(countArgs, *filter.Status)
			countIdx++
		}
	}
	var total int
	err = r.db.GetContext(ctx, &total,
		fmt.Sprintf(`SELECT COUNT(*) FROM billing_invoices %s`, countWhere), countArgs...)
	if err != nil {
		return nil, 0, err
	}
	return invoices, total, nil
}

func (r *Repository) UpdateInvoice(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Invoice, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}
	updates["updated_at"] = time.Now().UTC()
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	result, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE billing_invoices SET %s WHERE id=$%d AND tenant_id=$%d`,
			strings.Join(setClauses, ", "), i, i+1), args...)
	if err != nil {
		return nil, err
	}
	if n, _ := result.RowsAffected(); n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetInvoiceByID(ctx, tenantID, id)
}

func (r *Repository) DeleteInvoice(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM billing_invoices WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// --- Line Items ---

func (r *Repository) CreateLineItem(ctx context.Context, item *models.LineItem) error {
	item.ID = uuid.New().String()
	item.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO billing_line_items (id, invoice_id, description, quantity, unit_price, amount, created_at)
		 VALUES (:id, :invoiceId, :description, :quantity, :unitPrice, :amount, :createdAt)`,
		item)
	return err
}

func (r *Repository) ListLineItemsByInvoice(ctx context.Context, tenantID, invoiceID string) ([]models.LineItem, error) {
	var items []models.LineItem
	err := r.db.SelectContext(ctx, &items,
		`SELECT li.* FROM billing_line_items li
		 JOIN billing_invoices bi ON li.invoice_id = bi.id
		 WHERE bi.tenant_id=$1 AND li.invoice_id=$2
		 ORDER BY li.id`, tenantID, invoiceID)
	return items, err
}

// --- Subscriptions ---

func (r *Repository) CreateSubscription(ctx context.Context, sub *models.Subscription) error {
	sub.ID = uuid.New().String()
	sub.CreatedAt = time.Now().UTC()
	sub.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO billing_subscriptions (id, tenant_id, plan_name, amount, interval, status, started_at, created_at, updated_at)
		 VALUES (:id, :tenantId, :planName, :amount, :interval, :status, :startedAt, :createdAt, :updatedAt)`,
		sub)
	return err
}

func (r *Repository) GetSubscriptionByID(ctx context.Context, tenantID, id string) (*models.Subscription, error) {
	var sub models.Subscription
	err := r.db.GetContext(ctx, &sub,
		`SELECT * FROM billing_subscriptions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return &sub, err
}

func (r *Repository) ListSubscriptions(ctx context.Context, tenantID string, status *string) ([]models.Subscription, error) {
	where := "WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2
	if status != nil && *status != "" {
		where += fmt.Sprintf(" AND status=$%d", argIdx)
		args = append(args, *status)
	}
	var subs []models.Subscription
	err := r.db.SelectContext(ctx, &subs,
		fmt.Sprintf(`SELECT * FROM billing_subscriptions %s ORDER BY created_at DESC`, where), args...)
	return subs, err
}

func (r *Repository) UpdateSubscription(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Subscription, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}
	updates["updated_at"] = time.Now().UTC()
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	result, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE billing_subscriptions SET %s WHERE id=$%d AND tenant_id=$%d`,
			strings.Join(setClauses, ", "), i, i+1), args...)
	if err != nil {
		return nil, err
	}
	if n, _ := result.RowsAffected(); n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetSubscriptionByID(ctx, tenantID, id)
}

func (r *Repository) DeleteSubscription(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM billing_subscriptions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// --- Stats ---

func (r *Repository) GetBillingStats(ctx context.Context, tenantID string) (*models.BillingStats, error) {
	stats := &models.BillingStats{}

	err := r.db.GetContext(ctx, &stats.TotalInvoices,
		`SELECT COUNT(*) FROM billing_invoices WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.TotalAmount,
		`SELECT COALESCE(SUM(total), 0) FROM billing_invoices WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.OverdueAmount,
		`SELECT COALESCE(SUM(total), 0) FROM billing_invoices WHERE tenant_id=$1 AND status='overdue'`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.PaidAmount,
		`SELECT COALESCE(SUM(total), 0) FROM billing_invoices WHERE tenant_id=$1 AND status='paid'`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.ActiveAccounts,
		`SELECT COUNT(*) FROM billing_accounts WHERE tenant_id=$1 AND status='active'`, tenantID)
	if err != nil {
		return nil, err
	}

	return stats, nil
}
