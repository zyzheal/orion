package pg

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/orion-platform/orion-knowledge/domain"
	"github.com/orion-platform/orion-knowledge/log"
	"github.com/orion-platform/orion-knowledge/store/pg"
	"gorm.io/gorm"
)

type BlockWordRepo struct {
	db     *pg.DB
	logger *log.Logger
}

type BlockWords struct {
	Words []string
}

func NewBlockWordRepo(db *pg.DB, logger *log.Logger) *BlockWordRepo {
	return &BlockWordRepo{
		db:     db,
		logger: logger,
	}
}

func (r *BlockWordRepo) GetBlockWords(ctx context.Context, kbID string) ([]string, error) {
	var setting domain.Setting
	var words BlockWords
	err := r.db.WithContext(ctx).Table("settings").
		Where("kb_id = ? AND key = ?", kbID, domain.SettingBlockWords).
		First(&setting).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	if err := json.Unmarshal(setting.Value, &words); err != nil {
		return nil, err
	}
	return words.Words, nil
}
