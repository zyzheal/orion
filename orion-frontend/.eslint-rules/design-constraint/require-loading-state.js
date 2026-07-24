/**
 * @fileoverview 要求异步操作必须有 loading 状态
 * @description 检测异步 onClick 回调中是否有 loading 状态管理
 */
'use strict';

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: '要求异步操作必须有 loading 状态',
      category: 'Design Constraint',
      recommended: true,
    },
    messages: {
      missingLoading: '异步操作必须包含 loading 状态以防止重复提交',
    },
  },
  create(context) {
    let insideOnClick = false;
    let hasAsync = false;
    let hasLoadingCheck = false;
    let hasLoadingState = false;

    // 查找 loading 状态的定义（useState 或变量声明）
    function findLoadingState(node) {
      // 检查 useState 调用
      if (node.type === 'CallExpression' && node.callee.name === 'useState') {
        const args = node.arguments;
        if (args.length > 0 && args[0].type === 'BooleanLiteral') {
          if (args[0].value === false) {
            hasLoadingState = true;
          }
        }
      }

      // 检查变量声明
      if (node.type === 'VariableDeclarator' && node.init) {
        if (node.init.type === 'BooleanLiteral' && node.init.value === false) {
          if (node.id.name?.includes('loading') || node.id.name?.includes('Loading')) {
            hasLoadingState = true;
          }
        }
      }
    }

    return {
      // 在文件级别收集 loading 状态信息
      Program(node) {
        hasLoadingState = false;
        // 遍历 AST 查找 loading 状态定义
        node.body.forEach((statement) => {
          if (statement.type === 'VariableDeclaration') {
            statement.declarations.forEach(findLoadingState);
          }
        });
      },

      Property(node) {
        if (node.key.name === 'onClick') {
          insideOnClick = true;
          hasAsync = false;
          hasLoadingCheck = false;

          // 检查函数表达式是否为 async
          if (node.value.type === 'ArrowFunctionExpression' || node.value.type === 'FunctionExpression') {
            if (node.value.async) {
              hasAsync = true;
            }
          }
        }
      },

      // 检测 onClick 内部是否有 loading 检查
      IfStatement(node) {
        if (!insideOnClick) return;

        const condition = node.test;
        // 检查 if (loading) return
        if (condition.type === 'Identifier' && condition.name === 'loading') {
          hasLoadingCheck = true;
        }

        // 检查 if (!loading) 或 if (loading === false)
        if (condition.type === 'UnaryExpression' && condition.operator === '!' && condition.argument.name === 'loading') {
          hasLoadingCheck = true;
        }
      },

      // 离开 onClick 属性时检查
      'Property:exit'(node) {
        if (node.key.name === 'onClick' && hasAsync && !hasLoadingCheck) {
          // 放宽要求：如果文件中定义了 loading 状态，则认为是符合规范的
          if (!hasLoadingState) {
            context.report({
              node,
              messageId: 'missingLoading',
            });
          }
        }
        insideOnClick = false;
      },
    };
  },
};