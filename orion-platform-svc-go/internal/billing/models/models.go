package models

import "time"

// Account represents a billing account.
type Account struct {
	ID             string     `json:"id" db:"id"`
	TenantID       string     `json:"tenantId" db:"tenant_id"`
	Name           string     `json:"name" db:"name"`
	BillingEmail   *string    `json:"billingEmail" db:"billing_email"`
	PaymentMethod  *string    `json:"paymentMethod" db:"payment_method"`
	Currency       string     `json:"currency" db:"currency"`
	Status         string     `json:"status" db:"status"`
	CreditBalance  float64    `json:"creditBalance" db:"credit_balance"`
	CreatedAt      time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt      time.Time  `json:"updatedAt" db:"updated_at"`
}

// CreateAccountRequest is the request body for creating an account.
type CreateAccountRequest struct {
	Name           string  `json:"name" binding:"required"`
	BillingEmail   *string `json:"billingEmail"`
	PaymentMethod  *string `json:"paymentMethod"`
	Currency       *string `json:"currency"`
	CreditBalance  *float64 `json:"creditBalance"`
}

// UpdateAccountRequest is the request body for updating an account.
type UpdateAccountRequest struct {
	Name           *string  `json:"name"`
	BillingEmail   *string  `json:"billingEmail"`
	PaymentMethod  *string  `json:"paymentMethod"`
	Currency       *string  `json:"currency"`
	Status         *string  `json:"status"`
	CreditBalance  *float64 `json:"creditBalance"`
}

// Invoice represents a billing invoice.
type Invoice struct {
	ID           string     `json:"id" db:"id"`
	TenantID     string     `json:"tenantId" db:"tenant_id"`
	AccountID    string     `json:"accountId" db:"account_id"`
	InvoiceNumber string   `json:"invoiceNumber" db:"invoice_number"`
	PeriodStart  string     `json:"periodStart" db:"period_start"`
	PeriodEnd    string     `json:"periodEnd" db:"period_end"`
	Total        float64    `json:"total" db:"total"`
	Tax          float64    `json:"tax" db:"tax"`
	Status       string     `json:"status" db:"status"`
	DueDate      *string    `json:"dueDate" db:"due_date"`
	PaidAt       *time.Time `json:"paidAt" db:"paid_at"`
	CreatedAt    time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time  `json:"updatedAt" db:"updated_at"`
}

// CreateInvoiceRequest is the request body for creating an invoice.
type CreateInvoiceRequest struct {
	AccountID   string  `json:"accountId" binding:"required"`
	InvoiceNumber string `json:"invoiceNumber" binding:"required"`
	PeriodStart string  `json:"periodStart" binding:"required"`
	PeriodEnd   string  `json:"periodEnd" binding:"required"`
	Total       float64 `json:"total"`
	Tax         float64 `json:"tax"`
	DueDate     *string `json:"dueDate"`
}

// LineItem represents an invoice line item.
type LineItem struct {
	ID          string  `json:"id" db:"id"`
	InvoiceID   string  `json:"invoiceId" db:"invoice_id"`
	Description string  `json:"description" db:"description"`
	Quantity    float64 `json:"quantity" db:"quantity"`
	UnitPrice   float64 `json:"unitPrice" db:"unit_price"`
	Amount      float64 `json:"amount" db:"amount"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
}

// CreateLineItemRequest is the request body for creating a line item.
type CreateLineItemRequest struct {
	InvoiceID   string  `json:"invoiceId" binding:"required"`
	Description string  `json:"description" binding:"required"`
	Quantity    float64 `json:"quantity"`
	UnitPrice   float64 `json:"unitPrice" binding:"required"`
}

// Subscription represents a billing subscription.
type Subscription struct {
	ID                    string     `json:"id" db:"id"`
	TenantID              string     `json:"tenantId" db:"tenant_id"`
	PlanName              string     `json:"planName" db:"plan_name"`
	Amount                float64    `json:"amount" db:"amount"`
	Interval              string     `json:"interval" db:"interval"`
	Status                string     `json:"status" db:"status"`
	CurrentPeriodStart    *string    `json:"currentPeriodStart" db:"current_period_start"`
	CurrentPeriodEnd      *string    `json:"currentPeriodEnd" db:"current_period_end"`
	StartedAt             *time.Time `json:"startedAt" db:"started_at"`
	CancelledAt           *time.Time `json:"cancelledAt" db:"cancelled_at"`
	CreatedAt             time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt             time.Time  `json:"updatedAt" db:"updated_at"`
}

// CreateSubscriptionRequest is the request body for creating a subscription.
type CreateSubscriptionRequest struct {
	PlanName  string  `json:"planName" binding:"required"`
	Amount    float64 `json:"amount" binding:"required"`
	Interval  string  `json:"interval" binding:"required"`
}

// UpdateSubscriptionRequest is the request body for updating a subscription.
type UpdateSubscriptionRequest struct {
	Status *string `json:"status"`
}

// BillingStats holds aggregated billing statistics.
type BillingStats struct {
	TotalInvoices int     `json:"totalInvoices"`
	TotalAmount   float64 `json:"totalAmount"`
	OverdueAmount float64 `json:"overdueAmount"`
	PaidAmount    float64 `json:"paidAmount"`
	ActiveAccounts int   `json:"activeAccounts"`
}

// InvoiceFilter represents filter parameters for listing invoices.
type InvoiceFilter struct {
	AccountID *string
	Status    *string
	PeriodStart *string
	PeriodEnd   *string
	Limit     int
	Offset    int
}
