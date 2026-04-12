package pg

import (
	"context"

	"github.com/orion-platform/orion-knowledge/consts"
	"github.com/orion-platform/orion-knowledge/domain"
	"github.com/orion-platform/orion-knowledge/log"
	"github.com/orion-platform/orion-knowledge/store/pg"
)

type SystemSettingRepo struct {
	db     *pg.DB
	logger *log.Logger
}

func NewSystemSettingRepo(db *pg.DB, logger *log.Logger) *SystemSettingRepo {
	return &SystemSettingRepo{
		db:     db,
		logger: logger.WithModule("repo.pg.system_setting"),
	}
}

func (r *SystemSettingRepo) GetSystemSetting(ctx context.Context, key consts.SystemSettingKey) (*domain.SystemSetting, error) {
	var setting domain.SystemSetting
	result := r.db.WithContext(ctx).Where("key = ?", key).First(&setting)
	if result.Error != nil {
		return nil, result.Error
	}

	return &setting, nil
}

func (r *SystemSettingRepo) UpdateSystemSetting(ctx context.Context, key, value string) error {
	return r.db.WithContext(ctx).Model(&domain.SystemSetting{}).Where("key = ?", key).Update("value", value).Error
}
