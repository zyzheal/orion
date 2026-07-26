module orion/orion-approval-svc-go

go 1.25

require (
	github.com/gin-gonic/gin v1.10.0
	github.com/google/uuid v1.6.0
	github.com/jmoiron/sqlx v1.4.0
	github.com/nats-io/nats.go v1.52.0
	go.uber.org/zap v1.28.0
	orion/go-common v0.0.0
)

replace orion/go-common => ../../orion-go-common

