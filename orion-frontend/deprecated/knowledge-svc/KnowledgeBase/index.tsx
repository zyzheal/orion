/**
 * 知识库页面 (M28 Orion-Knowledge)
 * 通过 Orion-MF 微前端加载 orion-knowledge 子应用
 * 提供知识库的统一入口
 */
import React from 'react';
import SubAppRoute from '@/components/SubAppRoute';

/**
 * 知识库主页面
 *
 * 该页面作为 Knowledge Base (M28) 的主入口，
 * 通过 Orion-MF 微前端框架加载外部的 orion-knowledge 应用。
 *
 * 架构说明:
 * - 路由: /knowledge 和 /knowledge/*
 * - 子应用: orion-knowledge (独立部署)
 * - 集成方式: Orion-MF (Keep-Alive 模式)
 * - 通信方式: eventBus + 全局状态注入
 */
const KnowledgeBase: React.FC = () => {
  return <SubAppRoute />;
};

export default KnowledgeBase;
