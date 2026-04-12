package migration

import (
	"github.com/google/wire"

	"github.com/orion-platform/orion-knowledge/migration/fns"
	"github.com/orion-platform/orion-knowledge/usecase"
)

var ProviderSet = wire.NewSet(
	// pg.ProviderSet,
	usecase.ProviderSet,
	fns.ProviderSet,

	wire.Struct(new(MigrationFuncs), "*"),

	NewManager,
)
