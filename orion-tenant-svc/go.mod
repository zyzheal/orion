module orion/tenant-svc

go 1.22

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/jmoiron/sqlx v1.4.0
	github.com/lib/pq v1.10.9
	github.com/spf13/viper v1.19.0
	go.uber.org/zap v1.27.0
	github.com/prometheus/client_golang v1.18.0
	go.opentelemetry.io/otel v1.24.0
	go.opentelemetry.io/otel/sdk v1.24.0
	go.opentelemetry.io/otel/trace v1.24.0
	go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin v0.49.0
	github.com/golang-jwt/jwt/v5 v5.2.1
	github.com/redis/go-redis/v9 v9.5.1
	github.com/stretchr/testify v1.9.0
)
