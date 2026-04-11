/**
 * CloudEvent 实现 - 符合 CloudEvents 1.0 规范
 *
 * @see https://cloudevents.io/
 */

export type CloudEventType =
  | 'pipeline.run.created'
  | 'pipeline.run.started'
  | 'pipeline.run.completed'
  | 'pipeline.run.failed'
  | 'pipeline.stage.started'
  | 'pipeline.stage.completed'
  | 'pipeline.stage.failed'
  | 'deployment.started'
  | 'deployment.completed'
  | 'deployment.failed'
  | 'deployment.rolled_back'
  | 'code.pr.opened'
  | 'code.pr.merged'
  | 'code.pr.closed'
  | 'config.changed'
  | 'config.drift.detected'
  | 'incident.detected'
  | 'incident.resolved'
  | 'alert.triggered'
  | 'alert.resolved'
  | string; // 允许自定义事件类型

export interface CloudEventAttributes {
  /** CloudEvents 规范版本 */
  specversion: '1.0';
  /** 事件 ID，由生产者生成 */
  id: string;
  /** 事件类型 */
  type: CloudEventType;
  /** 事件源，URI 引用 */
  source: string;
  /** 事件发生时间 */
  time: string;
  /** 内容类型 */
  datacontenttype?: string;
  /** 内容编码 (可选) */
  datacontentencoding?: string;
  /** 数据类型 schema URL (可选) */
  dataschema?: string;
  /** 子类型标识 */
  subject?: string;
}

export interface CloudEventPayload<T = any> {
  /** 事件数据 */
  data: T;
  /** 数据类型 */
  datatype?: string;
  /** 数据 schema (可选) */
  dataschema?: string;
}

export interface CloudEventExtensions {
  /** 租户 ID */
  tenantId?: string;
  /** 用户 ID */
  userId?: string;
  /** 追踪 ID */
  traceId?: string;
  /** 事件版本 */
  version?: string;
  /** 优先级 */
  priority?: 'low' | 'normal' | 'high' | 'critical';
  /** 自定义扩展属性 */
  [key: string]: any;
}

/**
 * CloudEvent 完整结构
 */
export class CloudEvent<T = any> implements CloudEventAttributes, CloudEventPayload<T> {
  // 必需属性
  specversion: '1.0' = '1.0';
  id: string;
  type: CloudEventType;
  source: string;
  time: string;
  datacontenttype: string = 'application/json';
  data: T;

  // 可选属性
  datacontentencoding?: string;
  dataschema?: string;
  subject?: string;
  datatype?: string;

  // 扩展属性
  tenantId?: string;
  userId?: string;
  traceId?: string;
  version?: string = 'v1';
  priority?: 'low' | 'normal' | 'high' | 'critical' = 'normal';

  // 自定义扩展
  [key: string]: any;

  constructor(attributes: {
    id?: string;
    type: CloudEventType;
    source: string;
    time?: Date | string;
    data: T;
    subject?: string;
    extensions?: CloudEventExtensions;
  }) {
    this.id = attributes.id || this.generateId();
    this.type = attributes.type;
    this.source = attributes.source;
    this.time = attributes.time instanceof Date
      ? attributes.time.toISOString()
      : attributes.time || new Date().toISOString();
    this.data = attributes.data;
    this.subject = attributes.subject;

    // 应用扩展属性
    if (attributes.extensions) {
      this.tenantId = attributes.extensions.tenantId;
      this.userId = attributes.extensions.userId;
      this.traceId = attributes.extensions.traceId;
      this.version = attributes.extensions.version || this.version;
      this.priority = attributes.extensions.priority || this.priority;

      // 复制其他自定义扩展
      Object.entries(attributes.extensions).forEach(([key, value]) => {
        if (!['tenantId', 'userId', 'traceId', 'version', 'priority'].includes(key)) {
          this[key] = value;
        }
      });
    }
  }

  /**
   * 生成唯一事件 ID
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${random}`;
  }

  /**
   * 转换为 JSON
   */
  toJSON(): object {
    const result: any = {
      specversion: this.specversion,
      id: this.id,
      type: this.type,
      source: this.source,
      time: this.time,
      datacontenttype: this.datacontenttype,
      data: this.data,
    };

    // 添加可选属性
    if (this.datacontentencoding) result.datacontentencoding = this.datacontentencoding;
    if (this.dataschema) result.dataschema = this.dataschema;
    if (this.subject) result.subject = this.subject;
    if (this.datatype) result.datatype = this.datatype;

    // 添加扩展属性
    if (this.tenantId) result.tenantId = this.tenantId;
    if (this.userId) result.userId = this.userId;
    if (this.traceId) result.traceId = this.traceId;
    if (this.version) result.version = this.version;
    if (this.priority) result.priority = this.priority;

    // 添加其他自定义扩展
    Object.entries(this).forEach(([key, value]) => {
      if (!['specversion', 'id', 'type', 'source', 'time', 'datacontenttype',
             'data', 'datacontentencoding', 'dataschema', 'subject', 'datatype',
             'tenantId', 'userId', 'traceId', 'version', 'priority'].includes(key)) {
        result[key] = value;
      }
    });

    return result;
  }

  /**
   * 从 JSON 解析 CloudEvent
   */
  static fromJSON<T>(json: string): CloudEvent<T> {
    const obj = JSON.parse(json);
    return new CloudEvent<T>({
      id: obj.id,
      type: obj.type,
      source: obj.source,
      time: new Date(obj.time),
      data: obj.data,
      subject: obj.subject,
      extensions: {
        tenantId: obj.tenantId,
        userId: obj.userId,
        traceId: obj.traceId,
        version: obj.version,
        priority: obj.priority,
      },
    });
  }

  /**
   * 验证 CloudEvent 是否符合规范
   */
  validate(): boolean {
    if (!this.specversion || this.specversion !== '1.0') {
      throw new Error('Invalid specversion, must be 1.0');
    }
    if (!this.id) {
      throw new Error('Missing required attribute: id');
    }
    if (!this.type) {
      throw new Error('Missing required attribute: type');
    }
    if (!this.source) {
      throw new Error('Missing required attribute: source');
    }
    if (!this.time) {
      throw new Error('Missing required attribute: time');
    }
    if (this.data === undefined) {
      throw new Error('Missing required attribute: data');
    }
    return true;
  }
}

/**
 * CloudEvent 构建器
 */
export class CloudEventBuilder<T = any> {
  private id?: string;
  private type!: CloudEventType;
  private source!: string;
  private time?: Date | string;
  private data!: T;
  private subject?: string;
  private extensions?: CloudEventExtensions;

  /**
   * 设置事件 ID
   */
  withId(id: string): CloudEventBuilder<T> {
    this.id = id;
    return this;
  }

  /**
   * 设置事件类型
   */
  withType(type: CloudEventType): CloudEventBuilder<T> {
    this.type = type;
    return this;
  }

  /**
   * 设置事件源
   */
  withSource(source: string): CloudEventBuilder<T> {
    this.source = source;
    return this;
  }

  /**
   * 设置事件时间
   */
  withTime(time: Date | string): CloudEventBuilder<T> {
    this.time = time;
    return this;
  }

  /**
   * 设置事件数据
   */
  withData(data: T): CloudEventBuilder<T> {
    this.data = data;
    return this;
  }

  /**
   * 设置事件主题
   */
  withSubject(subject: string): CloudEventBuilder<T> {
    this.subject = subject;
    return this;
  }

  /**
   * 设置扩展属性
   */
  withExtensions(extensions: CloudEventExtensions): CloudEventBuilder<T> {
    this.extensions = extensions;
    return this;
  }

  /**
   * 构建 CloudEvent
   */
  build(): CloudEvent<T> {
    if (!this.type || !this.source || this.data === undefined) {
      throw new Error('Missing required attributes: type, source, or data');
    }

    return new CloudEvent<T>({
      id: this.id,
      type: this.type,
      source: this.source,
      time: this.time,
      data: this.data,
      subject: this.subject,
      extensions: this.extensions,
    });
  }
}
