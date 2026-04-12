package mq

import (
	"github.com/google/wire"

	"github.com/orion-platform/orion-knowledge/mq"
	"github.com/orion-platform/orion-knowledge/repo/cache"
)

var ProviderSet = wire.NewSet(
	mq.ProviderSet,

	cache.ProviderSet,
	NewRAGRepository,
)
