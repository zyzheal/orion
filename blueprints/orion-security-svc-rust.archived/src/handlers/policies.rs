use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{CreatePolicyRequest, PaginationParams, Policy};

pub async fn list_policies(
    State(pool): State<PgPool>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let offset = params.offset() as i64;
    let limit = params.limit() as i64;

    let policies = sqlx::query_as::<_, Policy>(
        r#"SELECT id, tenant_id, name, description, rules, status,
           enforcement_level, created_at, updated_at
           FROM policies ORDER BY created_at DESC OFFSET $1 LIMIT $2"#,
    )
    .bind(offset)
    .bind(limit)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({ "data": policies })))
}

pub async fn get_policy(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Policy>, StatusCode> {
    let policy = sqlx::query_as::<_, Policy>(
        r#"SELECT id, tenant_id, name, description, rules, status,
           enforcement_level, created_at, updated_at
           FROM policies WHERE id = $1"#,
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    policy.map(Json).ok_or(StatusCode::NOT_FOUND)
}

pub async fn create_policy(
    State(pool): State<PgPool>,
    Json(req): Json<CreatePolicyRequest>,
) -> Result<(StatusCode, Json<Policy>), StatusCode> {
    let id = Uuid::new_v4();
    let enforcement = req.enforcement_level.unwrap_or_else(|| "warn".to_string());

    let policy = sqlx::query_as::<_, Policy>(
        r#"INSERT INTO policies (id, tenant_id, name, description, rules, status, enforcement_level)
           VALUES ($1, 'default', $2, $3, $4, 'draft', $5)
           RETURNING id, tenant_id, name, description, rules, status,
           enforcement_level, created_at, updated_at"#,
    )
    .bind(id)
    .bind(req.name)
    .bind(req.description)
    .bind(req.rules)
    .bind(enforcement)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(policy)))
}
