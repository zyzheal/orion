mod db;
mod handlers;
mod models;

use axum::{routing::{get, post}, Router};
#[allow(unused_imports)]
use crate::models::*;
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://orion:orion@localhost/orion_security".to_string());

    let pool = db::create_pool(&database_url)
        .await
        .expect("failed to create database pool");

    let app = Router::new()
        .route("/healthz", get(healthz))
        .route("/api/v1/policies", get(handlers::policies::list_policies).post(handlers::policies::create_policy))
        .route("/api/v1/policies/{id}", get(handlers::policies::get_policy))
        .route("/api/v1/assessments", get(handlers::assessments::list_assessments).post(handlers::assessments::create_assessment))
        .route("/api/v1/audit-logs", get(handlers::audit::list_audit_logs).post(handlers::audit::create_audit_log))
        .with_state(pool);

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse()
        .unwrap_or(8080);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("security-svc listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn healthz() -> &'static str {
    "ok"
}
