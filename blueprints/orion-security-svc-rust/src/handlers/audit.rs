use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{AuditLog, CreateAuditLogRequest, PaginationParams};

pub async fn list_audit_logs(
    State(pool): State<PgPool>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let offset = params.offset() as i64;
    let limit = params.limit() as i64;

    let logs = sqlx::query_as::<_, AuditLog>(
        r#"SELECT id, tenant_id, actor, action, resource_type, resource_id,
           details, ip_address, created_at
           FROM audit_logs ORDER BY created_at DESC OFFSET $1 LIMIT $2"#,
    )
    .bind(offset)
    .bind(limit)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({ "data": logs })))
}

pub async fn create_audit_log(
    State(pool): State<PgPool>,
    Json(req): Json<CreateAuditLogRequest>,
) -> Result<(StatusCode, Json<AuditLog>), StatusCode> {
    let id = Uuid::new_v4();
    let details = req.details.unwrap_or(serde_json::json!({}));

    let log = sqlx::query_as::<_, AuditLog>(
        r#"INSERT INTO audit_logs (id, tenant_id, actor, action, resource_type, resource_id, details, ip_address)
           VALUES ($1, 'default', $2, $3, $4, $5, $6, $7)
           RETURNING id, tenant_id, actor, action, resource_type, resource_id, details, ip_address, created_at"#,
    )
    .bind(id)
    .bind(req.actor)
    .bind(req.action)
    .bind(req.resource_type)
    .bind(req.resource_id)
    .bind(details)
    .bind(req.ip_address)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(log)))
}
