// Package models defines response types for the RDM code-reviews module.
//
// Shapes match orion-frontend/src/api/rdm.ts (CodeReview / CreateCodeReviewInput
// / CodeReviewComment). The frontend declares these endpoints but the
// backend previously returned 404 — this module resolves R-P0-05 from
// the risk register (CC v5.4 §1.5.1).
package models

import "time"

// CodeReview is the response for GET/POST /rdm/code-reviews.
type CodeReview struct {
	ID            string    `json:"id"`
	TenantID      string    `json:"tenantId"`
	ProjectID     string    `json:"projectId"`
	Title         string    `json:"title"`
	SourceBranch  string    `json:"sourceBranch"`
	TargetBranch  string    `json:"targetBranch"`
	SourceCommit  string    `json:"sourceCommit"`
	Status        string    `json:"status"` // pending | approved | changes_requested | merged | closed
	Author        string    `json:"author"`
	Reviewers     []string  `json:"reviewers"`
	CommentsCount int       `json:"commentsCount"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// CreateCodeReviewRequest is the request body for POST /rdm/code-reviews.
// Mirrors frontend CreateCodeReviewInput (title required; reviewers optional).
type CreateCodeReviewRequest struct {
	ProjectID    string   `json:"projectId" binding:"required"`
	Title        string   `json:"title" binding:"required"`
	SourceBranch string   `json:"sourceBranch" binding:"required"`
	TargetBranch string   `json:"targetBranch" binding:"required"`
	SourceCommit string   `json:"sourceCommit" binding:"required"`
	Reviewers    []string `json:"reviewers"`
}

// CodeReviewComment is a single comment on a code review.
// File and Line are pointer-null because inline file-level comments
// carry both, general review comments carry neither.
type CodeReviewComment struct {
	ID        string    `json:"id"`
	ReviewID  string    `json:"reviewId"`
	Author    string    `json:"author"`
	Content   string    `json:"content"`
	File      *string   `json:"file"`
	Line      *int      `json:"line"`
	CreatedAt time.Time `json:"createdAt"`
}

// CreateCodeReviewCommentRequest is the request body for
// POST /rdm/code-reviews/:reviewId/comments.
type CreateCodeReviewCommentRequest struct {
	Content string `json:"content" binding:"required"`
	File    string `json:"file"`
	Line    *int   `json:"line"`
}
