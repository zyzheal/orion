module orion/backup-svc-go

go 1.22

require (
	github.com/gin-gonic/gin v1.10.0
	github.com/golang-migrate/migrate/v4 v4.18.1
	github.com/robfig/cron/v3 v3.0.1
	github.com/spf13/viper v1.21.0
	go.opentelemetry.io/otel v1.44.0
	go.opentelemetry.io/otel/trace v1.44.0
	go.uber.org/zap v1.28.0
	orion/go-common v0.0.0
)

replace orion/go-common => ../orion-go-common
