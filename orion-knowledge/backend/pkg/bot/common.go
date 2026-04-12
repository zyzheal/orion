package bot

import (
	"context"

	"github.com/orion-platform/orion-knowledge/domain"
)

type GetQAFun func(ctx context.Context, msg string, info domain.ConversationInfo, ConversationID string) (chan string, error)
