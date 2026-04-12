package usecase

import (
	"github.com/google/wire"

	"github.com/orion-platform/orion-knowledge/repo/ipdb"
	mqRepo "github.com/orion-platform/orion-knowledge/repo/mq"
	"github.com/orion-platform/orion-knowledge/repo/pg"
	"github.com/orion-platform/orion-knowledge/store/rag"
	"github.com/orion-platform/orion-knowledge/store/s3"
)

var ProviderSet = wire.NewSet(
	pg.ProviderSet,
	mqRepo.ProviderSet,
	ipdb.ProviderSet,
	rag.ProviderSet,
	s3.ProviderSet,

	NewLLMUsecase,
	NewNodeUsecase,
	NewAppUsecase,
	NewConversationUsecase,
	NewUserUsecase,
	NewModelUsecase,
	NewKnowledgeBaseUsecase,
	NewChatUsecase,
	NewCrawlerUsecase,
	NewCreationUsecase,
	NewFileUsecase,
	NewSitemapUsecase,
	NewStatUseCase,
	NewCommentUsecase,
	NewWechatUsecase,
	NewWecomUsecase,
	NewWechatAppUsecase,
	NewAuthUsecase,
	NewNavUsecase,
)
