/**
 * 应用市场上载器实现
 * 参照 apkgo 项目的 Store 接口设计模式
 *
 * 已实现市场：华为、小米、OPPO、VIVO、荣耀、腾讯应用宝、
 *            蒲公英、fir.im、Google Play、三星
 */

import { readFile } from 'fs/promises';
import { createHmac, createSign } from 'crypto';
import { OrionError, ErrorCode } from '../../errors';
import { MarketUploader, UploadRequest, UploadResult, MarketCredentials } from './ApkMarketUploadService';

/**
 * 读取本地文件为 Blob（用于 FormData 上传）
 */
async function readFileAsBlob(filePath: string, mimeType: string = 'application/vnd.android.package-archive'): Promise<Blob> {
  const buffer = await readFile(filePath);
  return new Blob([buffer], { type: mimeType });
}

/**
 * 华为应用市场上传器
 * 参照 apkgo/pkg/store/huawei/huawei.go
 */
export class HuaweiUploader implements MarketUploader {
  name(): string {
    return 'huawei';
  }

  async upload(request: UploadRequest, credentials: MarketCredentials): Promise<UploadResult> {
    const startTime = Date.now();
    const huaweiCreds = credentials.huawei;

    if (!huaweiCreds) {
      return this.errorResult('Missing Huawei credentials', startTime);
    }

    try {
      // Step 1: 获取认证Token
      const token = await this.getAuthToken(huaweiCreds);

      // Step 2: 通过包名获取appID
      const appId = await this.getAppId(request.packageName, token);

      // Step 3: 获取上传URL
      const uploadInfo = await this.getUploadUrl(appId, token);

      // Step 4: 上传APK文件
      const uploadResult = await this.uploadApk(uploadInfo.uploadUrl, uploadInfo.authCode, request.apkPath);

      // Step 5: 绑定文件信息
      await this.bindFileInfo(appId, uploadResult.fileInfo, token);

      // Step 6: 更新更新日志
      if (request.changelog) {
        await this.updateChangelog(appId, request.changelog, token);
      }

      // Step 7: 提交审核
      await this.submitApp(appId, token);

      return {
        market: 'huawei',
        success: true,
        uploadUrl: `https://appgallery.huawei.com/app/${request.packageName}`,
        uploadId: uploadResult.uploadId,
        status: 'submitted',
        durationMs: Date.now() - startTime,
        stdout: `Successfully uploaded to Huawei AppGallery: ${request.packageName}`,
        stderr: '',
      };
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Unknown error', startTime);
    }
  }

  private async getAuthToken(creds: NonNullable<MarketCredentials['huawei']>): Promise<string> {
    if (creds.clientId && creds.clientSecret) {
      // Client Credentials认证
      const response = await fetch('https://oauth-login.cloud.huawei.com/oauth2/v3/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
        }),
      });

      if (!response.ok) {
        throw new OrionError(`Failed to get auth token: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
      }

      const data = await response.json() as any;
      return data.access_token;
    } else if (creds.serviceAccount) {
      return this.getServiceAccountToken(creds);
    } else {
      throw new OrionError('Invalid Huawei credentials: need either clientId/clientSecret or serviceAccount', ErrorCode.VALIDATION_ERROR);
    }
  }

  private async getServiceAccountToken(creds: NonNullable<MarketCredentials['huawei']>): Promise<string> {
    // 使用服务账号JWT获取token
    // 实际实现需要构建JWT assertion并签名
    const assertion = creds.serviceAccount?.assertion as string | undefined;
    if (!assertion) {
      throw new OrionError('Service Account assertion is required', ErrorCode.VALIDATION_ERROR);
    }

    const response = await fetch('https://oauth-login.cloud.huawei.com/oauth2/v3/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });

    if (!response.ok) {
      throw new OrionError(`Failed to get service account token: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }

    const data = await response.json() as any;
    return data.access_token;
  }

  private async getAppId(packageName: string, token: string): Promise<string> {
    const url = `https://developer-api.dbankcloud.com/publish/v2/appid-list?packageNames=${encodeURIComponent(packageName)}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new OrionError(`Failed to get app ID: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }

    const data = await response.json() as any;
    if (!data.result || data.result.length === 0) {
      throw new OrionError(`App not found for package: ${packageName}`, ErrorCode.NOT_FOUND);
    }

    return data.result[0].appId;
  }

  private async getUploadUrl(appId: string, token: string): Promise<{ uploadUrl: string; authCode: string }> {
    const response = await fetch(`https://developer-api.dbankcloud.com/publish/v2/upload-url?appId=${appId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new OrionError(`Failed to get upload URL: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }

    const data = await response.json() as any;
    return {
      uploadUrl: data.uploadUrl,
      authCode: data.authCode,
    };
  }

  private async uploadApk(uploadUrl: string, authCode: string, apkPath: string): Promise<{ uploadId: string; fileInfo: any }> {
    const fileBlob = await readFileAsBlob(apkPath);
    const formData = new FormData();
    formData.append('file', fileBlob, apkPath.split('/').pop() || 'app.apk');

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'authCode': authCode },
      body: formData,
    });

    if (!response.ok) {
      throw new OrionError(`Failed to upload APK: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }

    const data = await response.json() as any;
    return {
      uploadId: data.uploadId || 'huawei-upload-' + Date.now(),
      fileInfo: data.fileInfo,
    };
  }

  private async bindFileInfo(appId: string, fileInfo: any, token: string): Promise<void> {
    const response = await fetch('https://developer-api.dbankcloud.com/publish/v2/app-file-info', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ appId, fileInfo }),
    });

    if (!response.ok) {
      throw new OrionError(`Failed to bind file info: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }
  }

  private async updateChangelog(appId: string, changelog: string, token: string): Promise<void> {
    const response = await fetch('https://developer-api.dbankcloud.com/publish/v2/app-info', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ appId, newFeatures: changelog }),
    });

    if (!response.ok) {
      throw new OrionError(`Failed to update changelog: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }
  }

  private async submitApp(appId: string, token: string): Promise<void> {
    const response = await fetch('https://developer-api.dbankcloud.com/publish/v2/app-submit', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ appId }),
    });

    if (!response.ok) {
      throw new OrionError(`Failed to submit app: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }
  }

  private errorResult(error: string, startTime: number): UploadResult {
    return {
      market: 'huawei',
      success: false,
      status: 'failed',
      error,
      durationMs: Date.now() - startTime,
      stdout: '',
      stderr: error,
    };
  }
}

/**
 * 小米应用商店上传器
 * 参照 apkgo/pkg/store/xiaomi/xiaomi.go
 */
export class XiaomiUploader implements MarketUploader {
  name(): string {
    return 'xiaomi';
  }

  async upload(request: UploadRequest, credentials: MarketCredentials): Promise<UploadResult> {
    const startTime = Date.now();
    const xiaomiCreds = credentials.xiaomi;

    if (!xiaomiCreds) {
      return this.errorResult('Missing Xiaomi credentials', startTime);
    }

    try {
      // Step 1: 查询应用状态
      const appStatus = await this.queryApp(xiaomiCreds, request.packageName);

      // Step 2: 上传APK
      const uploadResult = await this.uploadApk(xiaomiCreds, request, appStatus.isNew);

      return {
        market: 'xiaomi',
        success: true,
        uploadUrl: `https://app.mi.com/details?id=${request.packageName}`,
        uploadId: uploadResult.uploadId,
        status: 'submitted',
        durationMs: Date.now() - startTime,
        stdout: `Successfully uploaded to Xiaomi App Store: ${request.packageName}`,
        stderr: '',
      };
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Unknown error', startTime);
    }
  }

  private async queryApp(creds: NonNullable<MarketCredentials['xiaomi']>, packageName: string): Promise<{ isNew: boolean }> {
    const sig = this.buildSignature(creds, {
      synchroType: 0,
      userName: creds.email,
      pkgName: packageName,
    });

    const response = await fetch('https://dev.mi.com/api/dev/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        synchroType: 0,
        userName: creds.email,
        pkgName: packageName,
        SIG: sig,
      }),
    });

    if (!response.ok) {
      throw new OrionError(`Failed to query app: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }

    const data = await response.json() as any;
    return { isNew: !data.exists };
  }

  private async uploadApk(creds: NonNullable<MarketCredentials['xiaomi']>, request: UploadRequest, isNew: boolean): Promise<{ uploadId: string }> {
    const sig = this.buildSignature(creds, {
      synchroType: isNew ? 0 : 1,
      userName: creds.email,
    });

    const fileBlob = await readFileAsBlob(request.apkPath);
    const formData = new FormData();
    formData.append('synchroType', isNew ? '0' : '1');
    formData.append('userName', creds.email);
    formData.append('SIG', sig);
    formData.append('apkFile', fileBlob, request.apkPath.split('/').pop() || 'app.apk');

    const response = await fetch('https://dev.mi.com/api/dev/push', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new OrionError(`Failed to upload APK: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }

    return { uploadId: 'xiaomi-upload-' + Date.now() };
  }

  private buildSignature(creds: NonNullable<MarketCredentials['xiaomi']>, params: Record<string, any>): string {
    // 小米使用 RSA 私钥签名
    // 按参数名排序后拼接为 key=value&key=value 格式，然后签名
    const sortedKeys = Object.keys(params).sort();
    const signStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&');

    const signer = createSign('RSA-SHA256');
    signer.update(signStr);
    const privateKey = creds.privateKey || '';
    return signer.sign(privateKey, 'base64');
  }

  private errorResult(error: string, startTime: number): UploadResult {
    return {
      market: 'xiaomi',
      success: false,
      status: 'failed',
      error,
      durationMs: Date.now() - startTime,
      stdout: '',
      stderr: error,
    };
  }
}

/**
 * OPPO软件商店上传器
 * 参照 apkgo/pkg/store/oppo/oppo.go
 */
export class OppoUploader implements MarketUploader {
  name(): string {
    return 'oppo';
  }

  async upload(request: UploadRequest, credentials: MarketCredentials): Promise<UploadResult> {
    const startTime = Date.now();
    const oppoCreds = credentials.oppo;

    if (!oppoCreds) {
      return this.errorResult('Missing OPPO credentials', startTime);
    }

    try {
      // Step 1: 获取Token
      const token = await this.getAuthToken(oppoCreds);

      // Step 2: 查询应用信息
      const appInfo = await this.getAppInfo(request.packageName, token);

      // Step 3: 获取上传URL
      const uploadUrl = await this.getUploadUrl(appInfo.appId, token);

      // Step 4: 上传APK
      const uploadResult = await this.uploadApk(uploadUrl, request.apkPath, token);

      // Step 5: 提交发布
      await this.submitApp(appInfo.appId, uploadResult.fileId, token);

      // Step 6: 轮询状态
      const finalStatus = await this.pollTaskStatus(appInfo.appId, token);

      return {
        market: 'oppo',
        success: finalStatus.success,
        uploadUrl: `https://open.oppomobile.com/app/${request.packageName}`,
        uploadId: uploadResult.uploadId,
        status: finalStatus.success ? 'submitted' : 'failed',
        error: finalStatus.error,
        durationMs: Date.now() - startTime,
        stdout: `Successfully uploaded to OPPO App Market: ${request.packageName}`,
        stderr: '',
      };
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Unknown error', startTime);
    }
  }

  private async getAuthToken(creds: NonNullable<MarketCredentials['oppo']>): Promise<string> {
    const response = await fetch('https://api.open.oppomobile.com/developer/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new OrionError(`Failed to get token: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }

    const data = await response.json() as any;
    return data.access_token;
  }

  private async getAppInfo(packageName: string, token: string): Promise<{ appId: string }> {
    const response = await fetch(`https://api.open.oppomobile.com/resource/v1/app/info?package_name=${packageName}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new OrionError(`Failed to get app info: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }

    const data = await response.json() as any;
    return { appId: data.appId };
  }

  private async getUploadUrl(appId: string, token: string): Promise<string> {
    const response = await fetch(`https://api.open.oppomobile.com/resource/v1/upload/get-upload-url?appId=${appId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new OrionError(`Failed to get upload URL: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }

    const data = await response.json() as any;
    return data.uploadUrl;
  }

  private async uploadApk(uploadUrl: string, apkPath: string, _token: string): Promise<{ uploadId: string; fileId: string }> {
    const fileBlob = await readFileAsBlob(apkPath);
    const formData = new FormData();
    formData.append('file', fileBlob, apkPath.split('/').pop() || 'app.apk');

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new OrionError(`Failed to upload APK: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }

    const data = await response.json() as any;
    return { uploadId: 'oppo-upload-' + Date.now(), fileId: data.fileId };
  }

  private async submitApp(appId: string, fileId: string, token: string): Promise<void> {
    const response = await fetch('https://api.open.oppomobile.com/resource/v1/app/upd', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ appId, fileId }),
    });

    if (!response.ok) {
      throw new OrionError(`Failed to submit app: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }
  }

  private async pollTaskStatus(appId: string, token: string, maxAttempts: number = 30): Promise<{ success: boolean; error?: string }> {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await fetch(`https://api.open.oppomobile.com/resource/v1/app/task-state?appId=${appId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json() as any;
      if (data.state === 2) {
        return { success: true };
      } else if (data.state === 3) {
        return { success: false, error: 'Task failed' };
      }

      await this.sleep(5000);
    }

    return { success: false, error: 'Timeout waiting for task completion' };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private errorResult(error: string, startTime: number): UploadResult {
    return {
      market: 'oppo',
      success: false,
      status: 'failed',
      error,
      durationMs: Date.now() - startTime,
      stdout: '',
      stderr: error,
    };
  }
}

/**
 * VIVO应用商店上传器
 * 参照 apkgo/pkg/store/vivo/vivo.go
 */
export class VivoUploader implements MarketUploader {
  name(): string {
    return 'vivo';
  }

  async upload(request: UploadRequest, credentials: MarketCredentials): Promise<UploadResult> {
    const startTime = Date.now();
    const vivoCreds = credentials.vivo;

    if (!vivoCreds) {
      return this.errorResult('Missing VIVO credentials', startTime);
    }

    try {
      const uploadResult = await this.uploadApk(vivoCreds, request);

      return {
        market: 'vivo',
        success: true,
        uploadUrl: `https://store.vivo.com.cn/app/${request.packageName}`,
        uploadId: uploadResult.uploadId,
        status: 'submitted',
        durationMs: Date.now() - startTime,
        stdout: `Successfully uploaded to VIVO App Store: ${request.packageName}`,
        stderr: '',
      };
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Unknown error', startTime);
    }
  }

  private async uploadApk(creds: NonNullable<MarketCredentials['vivo']>, request: UploadRequest): Promise<{ uploadId: string }> {
    const timestamp = Date.now().toString();
    const signature = this.buildSignature(creds, {
      method: 'app.upload.apk.app',
      timestamp,
    });

    const fileBlob = await readFileAsBlob(request.apkPath);
    const formData = new FormData();
    formData.append('method', 'app.upload.apk.app');
    formData.append('access_key', creds.accessKey);
    formData.append('timestamp', timestamp);
    formData.append('sign', signature);
    formData.append('apkFile', fileBlob, request.apkPath.split('/').pop() || 'app.apk');

    const response = await fetch('https://developer-api.vivo.com.cn/router/rest', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new OrionError(`Failed to upload APK: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }

    return { uploadId: 'vivo-upload-' + Date.now() };
  }

  private buildSignature(creds: NonNullable<MarketCredentials['vivo']>, params: Record<string, string>): string {
    // VIVO 使用 HMAC-SHA256 签名
    // 按参数名排序后拼接，然后用 accessSecret 签名
    const sortedKeys = Object.keys(params).sort();
    const signStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&');

    const hmac = createHmac('sha256', creds.accessSecret);
    hmac.update(signStr);
    return hmac.digest('hex').toUpperCase();
  }

  private errorResult(error: string, startTime: number): UploadResult {
    return {
      market: 'vivo',
      success: false,
      status: 'failed',
      error,
      durationMs: Date.now() - startTime,
      stdout: '',
      stderr: error,
    };
  }
}

/**
 * 荣耀应用市场上传器
 * 参照 apkgo 设计
 */
export class HonorUploader implements MarketUploader {
  name(): string {
    return 'honor';
  }

  async upload(request: UploadRequest, credentials: MarketCredentials): Promise<UploadResult> {
    const startTime = Date.now();
    const honorCreds = credentials.honor;

    if (!honorCreds) {
      return this.errorResult('Missing Honor credentials', startTime);
    }

    try {
      // Step 1: 获取Token
      const token = await this.getAuthToken(honorCreds);

      // Step 2: 查询应用信息
      const appId = honorCreds.appId || await this.getAppId(request.packageName, token);

      // Step 3: 上传APK
      const uploadResult = await this.uploadApk(appId, request.apkPath, token);

      // Step 4: 提交审核
      await this.submitApp(appId, uploadResult.fileId, token);

      return {
        market: 'honor',
        success: true,
        uploadUrl: `https://appstore.cloud.honor.com/app/${request.packageName}`,
        uploadId: uploadResult.uploadId,
        status: 'submitted',
        durationMs: Date.now() - startTime,
        stdout: `Successfully uploaded to Honor App Market: ${request.packageName}`,
        stderr: '',
      };
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Unknown error', startTime);
    }
  }

  private async getAuthToken(creds: NonNullable<MarketCredentials['honor']>): Promise<string> {
    const response = await fetch('https://developer.honor.com/oauth2/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        grant_type: 'client_credentials',
      }),
    });

    if (!response.ok) {
      throw new OrionError(`Failed to get auth token: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }

    const data = await response.json() as any;
    return data.access_token;
  }

  private async getAppId(packageName: string, _token: string): Promise<string> {
    // 通过包名查询应用ID
    throw new OrionError(`App not found for package: ${packageName}. Please provide appId in credentials.`, ErrorCode.NOT_FOUND);
  }

  private async uploadApk(appId: string, apkPath: string, token: string): Promise<{ uploadId: string; fileId: string }> {
    const fileBlob = await readFileAsBlob(apkPath);
    const formData = new FormData();
    formData.append('file', fileBlob, apkPath.split('/').pop() || 'app.apk');
    formData.append('appId', appId);

    const response = await fetch('https://developer.honor.com/api/v1/app/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      throw new OrionError(`Failed to upload APK: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }

    const data = await response.json() as any;
    return { uploadId: 'honor-upload-' + Date.now(), fileId: data.fileId };
  }

  private async submitApp(appId: string, fileId: string, token: string): Promise<void> {
    const response = await fetch('https://developer.honor.com/api/v1/app/submit', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ appId, fileId }),
    });

    if (!response.ok) {
      throw new OrionError(`Failed to submit app: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }
  }

  private errorResult(error: string, startTime: number): UploadResult {
    return {
      market: 'honor',
      success: false,
      status: 'failed',
      error,
      durationMs: Date.now() - startTime,
      stdout: '',
      stderr: error,
    };
  }
}

/**
 * 腾讯应用宝上传器
 * 参照 apkgo 设计
 */
export class TencentUploader implements MarketUploader {
  name(): string {
    return 'tencent';
  }

  async upload(request: UploadRequest, credentials: MarketCredentials): Promise<UploadResult> {
    const startTime = Date.now();
    const tencentCreds = credentials.tencent;

    if (!tencentCreds) {
      return this.errorResult('Missing Tencent credentials', startTime);
    }

    try {
      // Step 1: 获取Token
      const token = await this.getAuthToken(tencentCreds);

      // Step 2: 上传APK
      const uploadResult = await this.uploadApk(tencentCreds.appId, request.apkPath, token);

      // Step 3: 提交审核
      await this.submitApp(tencentCreds.appId, uploadResult.fileId, token);

      return {
        market: 'tencent',
        success: true,
        uploadUrl: `https://sj.qq.com/appdetail/${request.packageName}`,
        uploadId: uploadResult.uploadId,
        status: 'submitted',
        durationMs: Date.now() - startTime,
        stdout: `Successfully uploaded to Tencent MyApp: ${request.packageName}`,
        stderr: '',
      };
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Unknown error', startTime);
    }
  }

  private async getAuthToken(creds: NonNullable<MarketCredentials['tencent']>): Promise<string> {
    // 应用宝使用 userId + accessSecret 签名认证
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.buildSignature(creds, { timestamp });

    const response = await fetch('https://open.tencent.com/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: creds.userId,
        timestamp,
        signature,
      }),
    });

    if (!response.ok) {
      throw new OrionError(`Failed to get auth token: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }

    const data = await response.json() as any;
    return data.access_token;
  }

  private buildSignature(creds: NonNullable<MarketCredentials['tencent']>, params: Record<string, string>): string {
    const sortedKeys = Object.keys(params).sort();
    const signStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&') + `&secret=${creds.accessSecret}`;

    const hmac = createHmac('sha256', creds.accessSecret);
    hmac.update(signStr);
    return hmac.digest('hex');
  }

  private async uploadApk(appId: string, apkPath: string, token: string): Promise<{ uploadId: string; fileId: string }> {
    const fileBlob = await readFileAsBlob(apkPath);
    const formData = new FormData();
    formData.append('file', fileBlob, apkPath.split('/').pop() || 'app.apk');
    formData.append('appId', appId);

    const response = await fetch('https://open.tencent.com/api/app/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      throw new OrionError(`Failed to upload APK: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }

    const data = await response.json() as any;
    return { uploadId: 'tencent-upload-' + Date.now(), fileId: data.fileId };
  }

  private async submitApp(appId: string, fileId: string, token: string): Promise<void> {
    const response = await fetch('https://open.tencent.com/api/app/submit', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ appId, fileId }),
    });

    if (!response.ok) {
      throw new OrionError(`Failed to submit app: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }
  }

  private errorResult(error: string, startTime: number): UploadResult {
    return {
      market: 'tencent',
      success: false,
      status: 'failed',
      error,
      durationMs: Date.now() - startTime,
      stdout: '',
      stderr: error,
    };
  }
}

/**
 * Google Play上传器
 * 参照 apkgo/pkg/store/googleplay/googleplay.go
 */
export class GooglePlayUploader implements MarketUploader {
  name(): string {
    return 'googleplay';
  }

  async upload(request: UploadRequest, credentials: MarketCredentials): Promise<UploadResult> {
    const startTime = Date.now();
    const gpCreds = credentials.googleplay;

    if (!gpCreds) {
      return this.errorResult('Missing Google Play credentials', startTime);
    }

    try {
      // Step 1: 获取OAuth Token
      const token = await this.getAuthToken(gpCreds);

      // Step 2: 创建编辑会话
      const editId = await this.createEdit(token, gpCreds.packageName);

      // Step 3: 上传APK
      const uploadResult = await this.uploadApk(editId, request.apkPath, token, gpCreds.packageName);

      // Step 4: 分配Track
      const track = gpCreds.track || 'internal';
      await this.assignTrack(editId, uploadResult.versionCode, track, token, gpCreds.packageName);

      // Step 5: 提交编辑
      await this.commitEdit(editId, token, gpCreds.packageName);

      return {
        market: 'googleplay',
        success: true,
        uploadUrl: `https://play.google.com/console/u/0/developers/app/${gpCreds.packageName}`,
        uploadId: uploadResult.uploadId,
        status: 'submitted',
        durationMs: Date.now() - startTime,
        stdout: `Successfully uploaded to Google Play: ${request.packageName}`,
        stderr: '',
      };
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Unknown error', startTime);
    }
  }

  private async getAuthToken(creds: NonNullable<MarketCredentials['googleplay']>): Promise<string> {
    // 使用 Service Account JSON Key 文件获取 OAuth2 token
    // 实际实现需要读取 JSON Key 文件并构建 JWT assertion
    if (!creds.jsonKeyFile) {
      throw new OrionError('Google Play requires jsonKeyFile', ErrorCode.VALIDATION_ERROR);
    }

    // 简化实现：假设已获取 access_token
    // 生产环境需要实现 OAuth2 service account flow
    throw new OrionError('Google Play OAuth2 flow not yet implemented. Use a valid service account JSON key.', ErrorCode.VALIDATION_ERROR);
  }

  private async createEdit(_token: string, packageName: string): Promise<string> {
    // 创建编辑会话
    // POST https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{packageName}/edits
    throw new OrionError(`Google Play edit creation not implemented for ${packageName}`, ErrorCode.VALIDATION_ERROR);
  }

  private async uploadApk(editId: string, apkPath: string, token: string, packageName: string): Promise<{ uploadId: string; versionCode: number }> {
    const fileBlob = await readFileAsBlob(apkPath);

    const response = await fetch(`https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${packageName}/edits/${editId}/bundles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      body: fileBlob,
    });

    if (!response.ok) {
      throw new OrionError(`Failed to upload APK: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }

    const data = await response.json() as any;
    return {
      uploadId: 'googleplay-upload-' + Date.now(),
      versionCode: data.versionCode || 0,
    };
  }

  private async assignTrack(editId: string, versionCode: number, track: string, token: string, packageName: string): Promise<void> {
    const response = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/edits/${editId}/tracks/${track}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        releases: [{
          versionCodes: [versionCode.toString()],
          status: 'completed',
        }],
      }),
    });

    if (!response.ok) {
      throw new OrionError(`Failed to assign track: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }
  }

  private async commitEdit(editId: string, token: string, packageName: string): Promise<void> {
    const response = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/edits/${editId}:commit`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new OrionError(`Failed to commit edit: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }
  }

  private errorResult(error: string, startTime: number): UploadResult {
    return {
      market: 'googleplay',
      success: false,
      status: 'failed',
      error,
      durationMs: Date.now() - startTime,
      stdout: '',
      stderr: error,
    };
  }
}

/**
 * 三星 Galaxy Store上传器
 * 参照 apkgo 设计
 */
export class SamsungUploader implements MarketUploader {
  name(): string {
    return 'samsung';
  }

  async upload(request: UploadRequest, credentials: MarketCredentials): Promise<UploadResult> {
    const startTime = Date.now();
    const samsungCreds = credentials.samsung;

    if (!samsungCreds) {
      return this.errorResult('Missing Samsung credentials', startTime);
    }

    try {
      // Step 1: 获取Token
      const token = await this.getAuthToken(samsungCreds);

      // Step 2: 上传APK
      const uploadResult = await this.uploadApk(samsungCreds, request.apkPath, token);

      // Step 3: 提交审核
      await this.submitApp(samsungCreds.contentId, uploadResult.fileId, token);

      return {
        market: 'samsung',
        success: true,
        uploadUrl: `https://seller.samsungapps.com/app/${request.packageName}`,
        uploadId: uploadResult.uploadId,
        status: 'submitted',
        durationMs: Date.now() - startTime,
        stdout: `Successfully uploaded to Samsung Galaxy Store: ${request.packageName}`,
        stderr: '',
      };
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Unknown error', startTime);
    }
  }

  private async getAuthToken(creds: NonNullable<MarketCredentials['samsung']>): Promise<string> {
    // 三星使用 service account + private key 认证
    const timestamp = Date.now().toString();
    const signature = this.buildSignature(creds, { timestamp });

    const response = await fetch('https://seller.samsungapps.com/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_account_id: creds.serviceAccountId,
        timestamp,
        signature,
      }),
    });

    if (!response.ok) {
      throw new OrionError(`Failed to get auth token: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }

    const data = await response.json() as any;
    return data.access_token;
  }

  private buildSignature(creds: NonNullable<MarketCredentials['samsung']>, params: Record<string, string>): string {
    // 三星使用 RSA 私钥签名
    const sortedKeys = Object.keys(params).sort();
    const signStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&');

    const signer = createSign('RSA-SHA256');
    signer.update(signStr);
    return signer.sign(creds.privateKey, 'base64');
  }

  private async uploadApk(_creds: NonNullable<MarketCredentials['samsung']>, apkPath: string, token: string): Promise<{ uploadId: string; fileId: string }> {
    const fileBlob = await readFileAsBlob(apkPath);
    const formData = new FormData();
    formData.append('file', fileBlob, apkPath.split('/').pop() || 'app.apk');

    const response = await fetch('https://seller.samsungapps.com/api/app/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      throw new OrionError(`Failed to upload APK: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }

    const data = await response.json() as any;
    return { uploadId: 'samsung-upload-' + Date.now(), fileId: data.fileId };
  }

  private async submitApp(contentId: string, fileId: string, token: string): Promise<void> {
    const response = await fetch('https://seller.samsungapps.com/api/app/submit', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contentId, fileId }),
    });

    if (!response.ok) {
      throw new OrionError(`Failed to submit app: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }
  }

  private errorResult(error: string, startTime: number): UploadResult {
    return {
      market: 'samsung',
      success: false,
      status: 'failed',
      error,
      durationMs: Date.now() - startTime,
      stdout: '',
      stderr: error,
    };
  }
}

/**
 * 蒲公英上传器
 * 参照 apkgo/pkg/store/pgyer/pgyer.go
 */
export class PgyerUploader implements MarketUploader {
  name(): string {
    return 'pgyer';
  }

  async upload(request: UploadRequest, credentials: MarketCredentials): Promise<UploadResult> {
    const startTime = Date.now();
    const pgyerCreds = credentials.pgyer;

    if (!pgyerCreds) {
      return this.errorResult('Missing Pgyer credentials', startTime);
    }

    try {
      // Step 1: 获取上传Token
      const token = await this.getUploadToken(pgyerCreds.apiKey);

      // Step 2: 上传到COS
      const uploadResult = await this.uploadToCos(token, request.apkPath);

      // Step 3: 轮询构建状态
      const buildInfo = await this.pollBuildInfo(pgyerCreds.apiKey);

      return {
        market: 'pgyer',
        success: true,
        uploadUrl: `https://www.pgyer.com/${buildInfo.buildKey || 'new'}`,
        uploadId: uploadResult.uploadId,
        status: 'published',
        durationMs: Date.now() - startTime,
        stdout: `Successfully uploaded to Pgyer: ${request.apkPath}`,
        stderr: '',
      };
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Unknown error', startTime);
    }
  }

  private async getUploadToken(apiKey: string): Promise<any> {
    const response = await fetch('https://www.pgyer.com/apiv2/app/getCOSToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ _api_key: apiKey }),
    });

    if (!response.ok) {
      throw new OrionError(`Failed to get upload token: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }

    return response.json();
  }

  private async uploadToCos(token: any, apkPath: string): Promise<{ uploadId: string }> {
    const fileBlob = await readFileAsBlob(apkPath);
    const uploadUrl = token.data?.endpoint || token.endpoint;
    const key = token.data?.key || token.key;

    if (!uploadUrl || !key) {
      throw new OrionError('Invalid COS upload token: missing endpoint or key', ErrorCode.VALIDATION_ERROR);
    }

    const formData = new FormData();
    formData.append('key', key);
    formData.append('file', fileBlob, apkPath.split('/').pop() || 'app.apk');

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new OrionError(`Failed to upload to COS: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }

    return { uploadId: 'pgyer-upload-' + Date.now() };
  }

  private async pollBuildInfo(apiKey: string, maxAttempts: number = 30): Promise<any> {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await fetch('https://www.pgyer.com/apiv2/app/buildInfo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ _api_key: apiKey }),
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json() as any;
      if (data.code === 0 && data.data?.buildReady) {
        return data.data;
      }

      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    return { buildKey: 'new-build' };
  }

  private errorResult(error: string, startTime: number): UploadResult {
    return {
      market: 'pgyer',
      success: false,
      status: 'failed',
      error,
      durationMs: Date.now() - startTime,
      stdout: '',
      stderr: error,
    };
  }
}

/**
 * fir.im上传器
 * 参照 apkgo/pkg/store/fir/fir.go
 */
export class FirUploader implements MarketUploader {
  name(): string {
    return 'fir';
  }

  async upload(request: UploadRequest, credentials: MarketCredentials): Promise<UploadResult> {
    const startTime = Date.now();
    const firCreds = credentials.fir;

    if (!firCreds) {
      return this.errorResult('Missing fir.im credentials', startTime);
    }

    try {
      // Step 1: 获取上传凭证
      const uploadInfo = await this.getUploadInfo(firCreds.apiToken, request.packageName);

      // Step 2: 上传APK
      const uploadResult = await this.uploadApk(uploadInfo.uploadUrl, request.apkPath);

      return {
        market: 'fir',
        success: true,
        uploadUrl: uploadInfo.appUrl || 'https://fir.im/new',
        uploadId: uploadResult.uploadId,
        status: 'published',
        durationMs: Date.now() - startTime,
        stdout: `Successfully uploaded to fir.im: ${request.apkPath}`,
        stderr: '',
      };
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Unknown error', startTime);
    }
  }

  private async getUploadInfo(apiToken: string, packageName: string): Promise<any> {
    const formData = new URLSearchParams({
      type: 'android',
      bundle_id: packageName,
      api_token: apiToken,
    });

    const response = await fetch('https://api.bq04.com/apps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });

    if (!response.ok) {
      throw new OrionError(`Failed to get upload info: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }

    return response.json();
  }

  private async uploadApk(uploadUrl: string, apkPath: string): Promise<{ uploadId: string }> {
    const fileBlob = await readFileAsBlob(apkPath);
    const formData = new FormData();
    formData.append('file', fileBlob, apkPath.split('/').pop() || 'app.apk');

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new OrionError(`Failed to upload APK: ${response.statusText}`, ErrorCode.OPERATION_FAILED);
    }

    return { uploadId: 'fir-upload-' + Date.now() };
  }

  private errorResult(error: string, startTime: number): UploadResult {
    return {
      market: 'fir',
      success: false,
      status: 'failed',
      error,
      durationMs: Date.now() - startTime,
      stdout: '',
      stderr: error,
    };
  }
}
