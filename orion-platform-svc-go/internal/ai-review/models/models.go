package models

// ReviewRequest represents an AI review record.
type ReviewRequest struct {
	ID        string `db:"id" json:"id"`
	TenantID  string `db:"tenant_id" json:"tenant_id"`
	Content   string `db:"content" json:"content"`
	Status    string `db:"status" json:"status"`
	Score     float64 `db:"score" json:"score"`
	Suggestions string `db:"suggestions" json:"suggestions"`
	CreatedBy string `db:"created_by" json:"created_by"`
}

// ReviewResponse is the response payload.
type ReviewResponse struct {
	Score       float64  `json:"score"`
	Suggestions []string `json:"suggestions"`
}

// CreateReviewRequest is the request body for creating a review.
type CreateReviewRequest struct {
	Content   string `json:"content"`
	CreatedBy string `json:"created_by"`
}

// ReviewResponseResult wraps the result of a review.
type ReviewResponseResult struct {
	Review *ReviewRequest `json:"review"`
}

// ListReviewsQuery is the query parameters for listing reviews.
type ListReviewsQuery struct {
	Status string
	Limit  int
	Offset int
}

// ReviewListResponse wraps a paginated list of reviews.
type ReviewListResponse struct {
	Reviews []ReviewRequest `json:"reviews"`
	Total   int             `json:"total"`
}
