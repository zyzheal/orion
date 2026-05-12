/**
 * FeishuAdapter - 飞书 Webhook 通知适配器
 *
 * 使用飞书自定义机器人 Webhook 发送交互式卡片消息。
 * Webhook URL 格式: https://open.feishu.cn/open-apis/bot/v2/hook/xxx
 */

import { IMAdapter, IMNotificationConfig, IMNotificationPayload } from '../IMNotifier';

export class FeishuAdapter implements IMAdapter {
  readonly platformType = 'feishu' as const;

  async send(config: IMNotificationConfig, payload: IMNotificationPayload): Promise<void> {
    const body = {
      msg_type: 'interactive',
      card: {
        header: {
          title: {
            tag: 'plain_text',
            content: payload.title,
          },
          template: this.getHeaderTemplate(payload.status),
        },
        elements: [
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: this.buildCardContent(payload),
            },
          },
          {
            tag: 'action',
            actions: [
              {
                tag: 'button',
                text: {
                  tag: 'plain_text',
                  content: '查看详情',
                },
                url: `#/pipelines/${payload.runId}`,
                type: 'primary',
              },
            ],
          },
        ],
      },
    };

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Feishu webhook returned status ${response.status}: ${response.statusText}`);
    }

    const result = await response.json() as Record<string, unknown>;
    if (result.code !== undefined && result.code !== 0) {
      throw new Error(`Feishu API error: ${JSON.stringify(result)}`);
    }
  }

  private buildCardContent(payload: IMNotificationPayload): string {
    const lines: string[] = [];

    const statusLabel = this.formatStatus(payload.status);
    lines.push(`**状态**: ${this.getStatusEmoji(payload.status)} ${statusLabel}`);
    lines.push(`**Pipeline**: ${payload.pipelineName}`);
    lines.push(`**Run ID**: ${payload.runId}`);

    if (payload.duration) {
      lines.push(`**耗时**: ${payload.duration}`);
    }
    if (payload.triggerBy) {
      lines.push(`**触发人**: ${payload.triggerBy}`);
    }

    return lines.join('\n');
  }

  private getHeaderTemplate(status: string): string {
    switch (status) {
      case 'success': return 'green';
      case 'failed': return 'red';
      case 'cancelled': return 'gray';
      default: return 'blue';
    }
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'success': return '\u2705';
      case 'failed': return '\u274c';
      case 'cancelled': return '\u23f9';
      default: return '\u26a0';
    }
  }

  private formatStatus(status: string): string {
    switch (status) {
      case 'success': return '执行成功';
      case 'failed': return '执行失败';
      case 'cancelled': return '已取消';
      default: return status;
    }
  }
}
