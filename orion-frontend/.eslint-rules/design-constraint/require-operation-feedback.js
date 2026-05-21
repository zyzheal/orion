/**
 * @fileoverview 要求异步操作必须有 success/error 反馈
 * @description 检测 onClick 回调中是否有 message.success 或 message.error 调用
 */
'use strict';

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: '要求异步操作必须有 success/error 反馈',
      category: 'Design Constraint',
      recommended: true,
    },
    messages: {
      missingFeedback: '异步操作必须包含 message.success 或 message.error 反馈',
    },
  },
  create(context) {
    let insideOnClick = false;
    let hasAsync = false;
    let hasMessageFeedback = false;
    let onClickStartLine = 0;

    return {
      // 标记是否在 onClick 属性内部
      Property(node) {
        if (node.key.name === 'onClick') {
          insideOnClick = true;
          onClickStartLine = node.loc?.start?.line || 0;
          hasAsync = false;
          hasMessageFeedback = false;

          // 检查函数表达式是否为 async
          if (node.value.type === 'ArrowFunctionExpression' || node.value.type === 'FunctionExpression') {
            if (node.value.async) {
              hasAsync = true;
            }
          }
        }
      },

      // 在 onClick 内部检测 message 调用
      CallExpression(node) {
        if (!insideOnClick) return;

        // 检查是否为 message.success 或 message.error
        if (node.callee.type === 'MemberExpression') {
          const objName = node.callee.object.name;
          const methodName = node.callee.property.name;
          if (objName === 'message' && (methodName === 'success' || methodName === 'error')) {
            hasMessageFeedback = true;
          }
        }
      },

      // 离开 onClick 属性时检查
      'Property:exit'(node) {
        if (node.key.name === 'onClick' && hasAsync && !hasMessageFeedback) {
          context.report({
            node,
            messageId: 'missingFeedback',
          });
        }
        insideOnClick = false;
      },
    };
  },
};