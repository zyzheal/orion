use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Risk level for security assessments.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

/// Status of a security policy.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PolicyStatus {
    Draft,
    Active,
    Disabled,
    Archived,
}

/// Status of a risk assessment.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AssessmentStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
}

/// A security policy definition.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Policy {
    pub id: Uuid,
    pub tenant_id: String,
    pub name: String,
    pub description: String,
    pub rules: serde_json::Value,
    pub status: String,
    pub enforcement_level: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A risk assessment record.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RiskAssessment {
    pub id: Uuid,
    pub tenant_id: String,
    pub resource_type: String,
    pub resource_id: String,
    pub risk_level: String,
    pub score: f64,
    pub findings: serde_json::Value,
    pub status: String,
    pub assessed_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

/// A security audit log entry.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AuditLog {
    pub id: Uuid,
    pub tenant_id: String,
    pub actor: String,
    pub action: String,
    pub resource_type: String,
    pub resource_id: String,
    pub details: serde_json::Value,
    pub ip_address: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Request to create a new policy.
#[derive(Debug, Clone, Deserialize)]
pub struct CreatePolicyRequest {
    pub name: String,
    pub description: String,
    pub rules: serde_json::Value,
    pub enforcement_level: Option<String>,
}

/// Request to create a risk assessment.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateAssessmentRequest {
    pub resource_type: String,
    pub resource_id: String,
}

/// Request to create an audit log entry.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateAuditLogRequest {
    pub actor: String,
    pub action: String,
    pub resource_type: String,
    pub resource_id: String,
    pub details: Option<serde_json::Value>,
    pub ip_address: Option<String>,
}

/// Pagination parameters.
#[derive(Debug, Clone, Deserialize)]
pub struct PaginationParams {
    pub page: Option<i32>,
    pub page_size: Option<i32>,
}

impl PaginationParams {
    pub fn offset(&self) -> i32 {
        let page = self.page.unwrap_or(1).max(1);
        let size = self.limit();
        (page - 1) * size
    }

    pub fn limit(&self) -> i32 {
        self.page_size.unwrap_or(20).clamp(1, 100)
    }
}
