package pg

import (
	"github.com/google/wire"

	"github.com/orion-platform/orion-knowledge/store/pg"
)

var ProviderSet = wire.NewSet(
	pg.ProviderSet,

	NewNodeRepository,
	NewAppRepository,
	NewConversationRepository,
	NewUserRepository,
	NewUserAccessRepository,
	NewModelRepository,
	NewKnowledgeBaseRepository,
	NewStatRepository,
	NewCommentRepository,
	NewPromptRepo,
	NewBlockWordRepo,
	NewAuthRepo,
	NewWechatRepository,
	NewAPITokenRepo,
	NewSystemSettingRepo,
	NewMCPRepository,
	NewNavRepository,
)
