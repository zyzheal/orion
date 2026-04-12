package cache

import (
	"github.com/google/wire"

	"github.com/orion-platform/orion-knowledge/store/cache"
)

var ProviderSet = wire.NewSet(
	cache.NewCache,
	NewKBRepo,
	NewGeoCache,
)
