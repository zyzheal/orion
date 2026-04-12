package mq

import (
	"github.com/google/wire"

	"github.com/orion-platform/orion-knowledge/repo/ipdb"
	"github.com/orion-platform/orion-knowledge/repo/mq"
	"github.com/orion-platform/orion-knowledge/repo/pg"
	"github.com/orion-platform/orion-knowledge/store/rag"
	"github.com/orion-platform/orion-knowledge/store/s3"
	"github.com/orion-platform/orion-knowledge/usecase"
)

type MQHandlers struct {
	RAGMQHandler        *RAGMQHandler
	RagDocUpdateHandler *RagDocUpdateHandler
	StatCronHandler     *CronHandler
}

var ProviderSet = wire.NewSet(
	pg.ProviderSet,
	rag.ProviderSet,
	mq.ProviderSet,
	ipdb.ProviderSet,
	s3.ProviderSet,

	usecase.NewLLMUsecase,
	usecase.NewStatUseCase,
	usecase.NewNodeUsecase,
	usecase.NewModelUsecase,

	NewRAGMQHandler,
	NewRagDocUpdateHandler,
	NewCronHandler,

	wire.Struct(new(MQHandlers), "*"),
)
