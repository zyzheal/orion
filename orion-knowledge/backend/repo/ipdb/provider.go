package ipdb

import (
	"github.com/google/wire"

	ipdbStore "github.com/orion-platform/orion-knowledge/store/ipdb"
)

var ProviderSet = wire.NewSet(
	ipdbStore.NewIPDB,

	NewIPAddressRepo,
)
