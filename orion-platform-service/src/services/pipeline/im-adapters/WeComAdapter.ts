/**
 * WeComAdapter - 企业微信 Webhook 通知适配器
 *
 * 使用企业微信群机器人 Webhook 发送 Markdown 格式消息。
 * Webhook URL 格式: https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
 */

import { IMAdapter, IMNotificationConfig, IMNotificationPayload } from '../IMNotifier';
import { OrionError } from '../../../errors';

export class WeComAdapter implements IMAdapter {
  readonly platformType = 'wecom' as const;

  async send(config: IMNotificationConfig, payload: IMNotificationPayload): Promise<void> {
    const body = {
      msgtype: 'markdown',
      markdown: {
        content: this.buildMarkdownContent(payload),
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
      throw new OrionError(`WeCom webhook returned status ${response.status}: ${response.statusText}`, 'OPERATION_FAILED')
    }

    const result = await response.json() as Record<string, unknown>;
    if (result.errcode !== undefined && result.errcode !== 0) {
      throw new OrionError(`WeCom API error: ${JSON.stringify(result)}`, 'OPERATION_FAILED')
    }
  }

  private buildMarkdownContent(payload: IMNotificationPayload): string {
    const lines: string[] = [];

    const statusLabel = this.formatStatus(payload.status);
    lines.push(`### ${this.getStatusTag(payload.status)} Pipeline ${statusLabel}`);
    lines.push(`> **Pipeline**: ${payload.pipelineName}`);
    lines.push(`> **Run ID**: ${payload.runId}`);

    if (payload.duration) {
      lines.push(`> **耗时**: ${payload.duration}`);
    }
    if (payload.triggerBy) {
      lines.push(`> **触发人**: ${payload.triggerBy}`);
    }

    lines.push('');
    lines.push(`>[查看详情](#/pipelines/${payload.runId})`);

    return lines.join('\n');
  }

  private getStatusTag(status: string): string {
    switch (status) {
      case 'success': return '<font color="info">成功</font>';
      case 'failed': return '<font color="warning">失败</font>';
      case 'cancelled': return '<font color="comment">取消</font>';
      default: return status;
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
