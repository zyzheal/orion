module orion-tool-svc-go

go 1.23

require (
	github.com/gin-gonic/gin v1.10.0
	github.com/google/uuid v1.6.0
	github.com/jmoiron/sqlx v1.4.0
	github.com/lib/pq v1.10.9
	go.uber.org/zap v1.27.0
	gopkg.in/yaml.v3 v3.0.1
	orion/go-common v0.0.0
)

replace orion/go-common => ../orion-go-common
