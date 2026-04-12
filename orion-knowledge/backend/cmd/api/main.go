package main

import (
	"fmt"

	"github.com/orion-platform/orion-knowledge/setup"
)

// @title Orion Knowledge API
// @version 1.0
// @description Orion Knowledge API documentation
// @BasePath /
// @securityDefinitions.apikey	bearerAuth
// @in	header
// @name	Authorization
// @description	Type "Bearer" + a space + your token to authorize
func main() {
	app, err := createApp()
	if err != nil {
		panic(err)
	}
	if err := setup.CheckInitCert(); err != nil {
		panic(err)
	}
	port := app.Config.HTTP.Port
	app.Logger.Info(fmt.Sprintf("Starting server on port %d", port))
	app.HTTPServer.Echo.Logger.Fatal(app.HTTPServer.Echo.Start(fmt.Sprintf(":%d", port)))
}
