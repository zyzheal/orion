/**
 * DingTalkAdapter - 钉钉 Webhook 通知适配器
 *
 * 使用钉钉自定义机器人 Webhook 发送 Markdown 格式消息。
 * Webhook URL 格式: https://oapi.dingtalk.com/robot/send?access_token=xxx
 */

import { IMAdapter, IMNotificationConfig, IMNotificationPayload } from '../IMNotifier';

export class DingTalkAdapter implements IMAdapter {
  readonly platformType = 'dingtalk' as const;

  async send(config: IMNotificationConfig, payload: IMNotificationPayload): Promise<void> {
    const body = {
      msgtype: 'markdown',
      markdown: {
        title: payload.title,
        text: this.buildMarkdownText(payload),
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
      throw new Error(`DingTalk webhook returned status ${response.status}: ${response.statusText}`);
    }

    const result = await response.json() as Record<string, unknown>;
    if (result.errcode !== undefined && result.errcode !== 0) {
      throw new Error(`DingTalk API error: ${JSON.stringify(result)}`);
    }
  }

  private buildMarkdownText(payload: IMNotificationPayload): string {
    const lines: string[] = [];

    // 根据状态设置颜色前缀
    const statusEmoji = this.getStatusEmoji(payload.status);
    lines.push(`### ${statusEmoji} Pipeline ${this.formatStatus(payload.status)}`);
    lines.push('');
    lines.push(`**Pipeline**: ${payload.pipelineName}`);
    lines.push(`**Run ID**: ${payload.runId}`);

    if (payload.duration) {
      lines.push(`**耗时**: ${payload.duration}`);
    }
    if (payload.triggerBy) {
      lines.push(`**触发人**: ${payload.triggerBy}`);
    }

    lines.push('');
    lines.push(`[查看详情](#/pipelines/${payload.runId})`);

    return lines.join('\n');
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'success': return '\u2705'; // checkmark
      case 'failed': return '\u274c'; // cross mark
      case 'cancelled': return '\u23f9'; // stop button
      default: return '\u26a0'; // warning
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
