use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{CreateAssessmentRequest, PaginationParams, RiskAssessment};

pub async fn list_assessments(
    State(pool): State<PgPool>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let offset = params.offset() as i64;
    let limit = params.limit() as i64;

    let assessments = sqlx::query_as::<_, RiskAssessment>(
        r#"SELECT id, tenant_id, resource_type, resource_id,
           risk_level, score, findings, status, assessed_at, created_at
           FROM risk_assessments ORDER BY created_at DESC OFFSET $1 LIMIT $2"#,
    )
    .bind(offset)
    .bind(limit)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({ "data": assessments })))
}

pub async fn create_assessment(
    State(pool): State<PgPool>,
    Json(req): Json<CreateAssessmentRequest>,
) -> Result<(StatusCode, Json<RiskAssessment>), StatusCode> {
    let id = Uuid::new_v4();

    let assessment = sqlx::query_as::<_, RiskAssessment>(
        r#"INSERT INTO risk_assessments (id, tenant_id, resource_type, resource_id, risk_level, score, findings, status)
           VALUES ($1, 'default', $2, $3, 'low', 0.0, '{}', 'pending')
           RETURNING id, tenant_id, resource_type, resource_id,
           risk_level, score, findings, status, assessed_at, created_at"#,
    )
    .bind(id)
    .bind(req.resource_type)
    .bind(req.resource_id)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(assessment)))
}
