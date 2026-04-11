/**
 * Orion API Gateway - 入口文件
 *
 * 启动 API 网关服务
 */

import { createApp } from './app';
import { getConfig } from './config';

async function main() {
  const config = getConfig();

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Orion API Gateway                                    ║
║                                                           ║
║   Version: 1.0.0                                          ║
║   Environment: ${process.env.NODE_ENV || 'development'}                              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

  try {
    // 创建应用
    const { app } = await createApp({ logger: true });

    // 启动服务器
    await app.listen({
      port: config.port,
      host: config.host,
    });

    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ✅ Server is running                                    ║
║                                                           ║
║   📍 Address: http://${config.host}:${config.port}                         ║
║   🏥 Health:  http://${config.host}:${config.port}/healthz                  ║
║   📖 Version: http://${config.host}:${config.port}/version                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

    // 监听 NATS 连接（如果配置了）
    if (config.nats.servers.length > 0) {
      console.log(`📡 NATS Servers: ${config.nats.servers.join(', ')}`);
      // 这里可以添加 NATS 连接逻辑
    }

    // 打印路由信息
    console.log('📋 Registered Routes:');
    app.printRoutes();
  } catch (error) {
    console.error('Failed to start API Gateway:', error);
    process.exit(1);
  }
}

// 启动应用
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
