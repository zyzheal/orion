/**
 * ChatConfigService — 问答卡片和快捷命令配置管理
 *
 * 功能:
 * 1. 获取用户的问答卡片 / 快捷命令配置
 * 2. 更新单条配置
 * 3. 批量更新配置（事务）
 */

import {
  ChatOpsQuestionConfigRepository,
  ChatOpsQuestionConfigEntity,
  ChatOpsCommandConfigRepository,
  ChatOpsCommandConfigEntity,
} from '../../repositories/ChatOpsRepository';
import { DatabasePool } from '../database';

export interface QuestionConfig {
  key: string;
  icon: string;
  title: string;
  desc: string;
  question: string;
  enabled: boolean;
}

export interface CommandConfig {
  key: string;
  label: string;
  command: string;
  enabled: boolean;
}

export class ChatConfigService {
  private questionRepo: ChatOpsQuestionConfigRepository;
  private commandRepo: ChatOpsCommandConfigRepository;

  constructor(private pool: DatabasePool) {
    this.questionRepo = new ChatOpsQuestionConfigRepository(this.pool);
    this.commandRepo = new ChatOpsCommandConfigRepository(this.pool);
  }

  // ==================== Question Configs ====================

  async getQuestions(userId: string): Promise<QuestionConfig[]> {
    const entities = await this.questionRepo.findByUserId(userId);
    return entities.map(e => this.entityToQuestion(e));
  }

  async updateQuestion(userId: string, config: QuestionConfig): Promise<QuestionConfig> {
    const entity = await this.questionRepo.upsert({
      userId,
      key: config.key,
      icon: config.icon,
      title: config.title,
      description: config.desc,
      question: config.question,
      enabled: config.enabled,
    });
    return this.entityToQuestion(entity);
  }

  async batchUpdateQuestions(userId: string, configs: QuestionConfig[]): Promise<QuestionConfig[]> {
    return this.pool.transaction(async (client) => {
      const results: QuestionConfig[] = [];
      for (const config of configs) {
        const result = await client.query(
          `INSERT INTO chatops_question_configs (user_id, key, icon, title, description, question, enabled, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (user_id, key) DO UPDATE SET
             icon = $3, title = $4, description = $5, question = $6, enabled = $7, sort_order = $8, updated_at = NOW()
           RETURNING *`,
          [userId, config.key, config.icon, config.title, config.desc, config.question, config.enabled, results.length],
        );
        if (result.rows.length > 0) {
          results.push(this.rowToQuestion(result.rows[0]));
        }
      }
      return results;
    });
  }

  async deleteQuestion(userId: string, key: string): Promise<boolean> {
    return this.questionRepo.deleteByKey(userId, key);
  }

  // ==================== Command Configs ====================

  async getCommands(userId: string): Promise<CommandConfig[]> {
    const entities = await this.commandRepo.findByUserId(userId);
    return entities.map(e => this.entityToCommand(e));
  }

  async updateCommand(userId: string, config: CommandConfig): Promise<CommandConfig> {
    const entity = await this.commandRepo.upsert({
      userId,
      key: config.key,
      label: config.label,
      command: config.command,
      enabled: config.enabled,
    });
    return this.entityToCommand(entity);
  }

  async batchUpdateCommands(userId: string, configs: CommandConfig[]): Promise<CommandConfig[]> {
    return this.pool.transaction(async (client) => {
      const results: CommandConfig[] = [];
      for (const config of configs) {
        const result = await client.query(
          `INSERT INTO chatops_command_configs (user_id, key, label, command, enabled, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id, key) DO UPDATE SET
             label = $3, command = $4, enabled = $5, sort_order = $6, updated_at = NOW()
           RETURNING *`,
          [userId, config.key, config.label, config.command, config.enabled, results.length],
        );
        if (result.rows.length > 0) {
          results.push(this.rowToCommand(result.rows[0]));
        }
      }
      return results;
    });
  }

  async deleteCommand(userId: string, key: string): Promise<boolean> {
    return this.commandRepo.deleteByKey(userId, key);
  }

  // ==================== Mappers ====================

  private entityToQuestion(entity: ChatOpsQuestionConfigEntity): QuestionConfig {
    return {
      key: entity.key,
      icon: entity.icon,
      title: entity.title,
      desc: entity.description,
      question: entity.question,
      enabled: entity.enabled,
    };
  }

  private rowToQuestion(row: any): QuestionConfig {
    return {
      key: row.key,
      icon: row.icon || '',
      title: row.title || '',
      desc: row.description || '',
      question: row.question || '',
      enabled: row.enabled ?? true,
    };
  }

  private entityToCommand(entity: ChatOpsCommandConfigEntity): CommandConfig {
    return {
      key: entity.key,
      label: entity.label,
      command: entity.command,
      enabled: entity.enabled,
    };
  }

  private rowToCommand(row: any): CommandConfig {
    return {
      key: row.key,
      label: row.label || '',
      command: row.command || '',
      enabled: row.enabled ?? true,
    };
  }
}
