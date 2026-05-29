module orion/approval-svc-go

go 1.25.0

require (
	github.com/gin-gonic/gin v1.10.0
	github.com/jmoiron/sqlx v1.4.0
	github.com/lib/pq v1.10.9
	github.com/spf13/viper v1.19.0
	orion/go-common v0.0.0
)

replace orion/go-common => ../orion-go-common
