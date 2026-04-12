package v1

import (
	"github.com/google/wire"

	"github.com/orion-platform/orion-knowledge/handler"
	"github.com/orion-platform/orion-knowledge/middleware"
	"github.com/orion-platform/orion-knowledge/usecase"
)

type APIHandlers struct {
	UserHandler          *UserHandler
	KnowledgeBaseHandler *KnowledgeBaseHandler
	NodeHandler          *NodeHandler
	AppHandler           *AppHandler
	FileHandler          *FileHandler
	ModelHandler         *ModelHandler
	ConversationHandler  *ConversationHandler
	CrawlerHandler       *CrawlerHandler
	CreationHandler      *CreationHandler
	StatHandler          *StatHandler
	CommentHandler       *CommentHandler
	AuthV1Handler        *AuthV1Handler
	NavHandler           *NavHandler
}

var ProviderSet = wire.NewSet(
	middleware.ProviderSet,
	usecase.ProviderSet,

	handler.NewBaseHandler,
	NewNodeHandler,
	NewAppHandler,
	NewConversationHandler,
	NewUserHandler,
	NewFileHandler,
	NewModelHandler,
	NewKnowledgeBaseHandler,
	NewCrawlerHandler,
	NewCreationHandler,
	NewStatHandler,
	NewCommentHandler,
	NewAuthV1Handler,
	NewNavHandler,

	wire.Struct(new(APIHandlers), "*"),
)
