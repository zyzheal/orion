/**
 * Props Type Detector (NEW)
 * Detects: missing-props-type
 *
 * Detects:
 * 1. Component props using `any` type (explicit)
 * 2. Component props with no type annotation (implicit any)
 * 3. Destructured props without type annotation
 * 4. Interface/type with `any` property types
 * 5. React.FC without generic type parameter
 */

import * as ts from 'typescript';
import { BaseDetector, InteractionIssue } from './base';

/**
 * Check if a type node represents `any`.
 */
function isAnyType(typeNode: ts.TypeNode): boolean {
  if (typeNode.kind === ts.SyntaxKind.AnyKeyword) return true;
  if (ts.isTypeReferenceNode(typeNode)) {
    // Type reference to 'any' (e.g., props: any)
    const name = typeNode.typeName;
    if (ts.isIdentifier(name) && name.text === 'any') return true;
  }
  return false;
}

/**
 * Check if a parameter has no type annotation.
 */
function hasNoType(param: ts.ParameterDeclaration): boolean {
  return !param.type;
}

/**
 * Check if a parameter's type is `any`.
 */
function hasAnyType(param: ts.ParameterDeclaration): boolean {
  return !!param.type && isAnyType(param.type);
}

export class MissingPropsTypeDetector extends BaseDetector {
  private reported = new Set<string>();

  supportsSinglePass(): boolean {
    return true;
  }

  analyze(): InteractionIssue[] {
    this.issues = [];
    this.reported = new Set<string>();
    const visit = (node: ts.Node) => {
      this.visitNode(node);
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(this.sourceFile, visit);
    return this.issues;
  }

  private report(compName: string, line: number, column: number, message: string, suggestion: string, severity: 'P1' | 'P2' = 'P2') {
    const key = `props-${compName}-${line}`;
    if (!this.reported.has(key)) {
      this.reported.add(key);
      this.issues.push({
        file: this.filePath, line, column,
        type: 'missing-props-type', severity,
        message, suggestion,
      });
    }
  }

  visitNode(node: ts.Node): void {
    // 1. Function declaration: function Component(props: any) or function Component({ a, b })
    if (ts.isFunctionDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
      const compName = node.name.text;
      if (/^[A-Z]/.test(compName) && node.parameters.length > 0) {
        const param = node.parameters[0];
        if (hasAnyType(param)) {
          const { line, column } = this.getLineColumn(node);
          this.report(compName, line, column, `组件 ${compName} 的 props 使用了 any 类型`, '定义明确的 Props interface 替代 any', 'P1');
        } else if (hasNoType(param)) {
          const { line, column } = this.getLineColumn(node);
          if (ts.isObjectBindingPattern(param.name)) {
            this.report(compName, line, column, `组件 ${compName} 的解构 props 缺少类型注解`, '添加 Props 类型: ({ prop1, prop2 }: ComponentProps)', 'P1');
          } else {
            this.report(compName, line, column, `组件 ${compName} 的 props 参数缺少类型注解`, '添加 Props 类型: (props: ComponentProps)', 'P2');
          }
        }
      }
    }

    // 2. Arrow function component: const Component = (props) => {...}
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isVariableDeclaration(decl) && ts.isIdentifier(decl.name)) {
          const compName = decl.name.text;
          if (/^[A-Z]/.test(compName) && decl.initializer) {
            const init = decl.initializer;
            if (ts.isArrowFunction(init) && init.parameters.length > 0) {
              const param = init.parameters[0];
              if (hasNoType(param) && ts.isObjectBindingPattern(param.name)) {
                const { line, column } = this.getLineColumn(decl);
                this.report(compName, line, column, `组件 ${compName} 的解构 props 缺少类型注解`, '添加 Props 类型: ({ prop1, prop2 }: ComponentProps)', 'P1');
              } else if (hasNoType(param) && ts.isIdentifier(param.name)) {
                const { line, column } = this.getLineColumn(decl);
                this.report(compName, line, column, `组件 ${compName} 的 props 参数缺少类型注解`, '添加 Props 类型: (props: ComponentProps)', 'P2');
              } else if (hasAnyType(param)) {
                const { line, column } = this.getLineColumn(decl);
                this.report(compName, line, column, `组件 ${compName} 的 props 使用了 any 类型`, '定义明确的 Props interface 替代 any', 'P1');
              }
            }
            // React.FC without generic
            if (ts.isArrowFunction(init) && decl.type) {
              const typeText = decl.type.getText(this.sourceFile);
              if (/React\.FC$|React\.FunctionComponent$/.test(typeText)) {
                const { line, column } = this.getLineColumn(decl);
                this.report(compName, line, column, `组件 ${compName} 使用 React.FC 但未指定 Props 泛型`, '使用 React.FC<PropsType> 替代 React.FC', 'P1');
              }
            }
          }
        }
      }
    }

    // 3. Interface with any property types
    if (ts.isInterfaceDeclaration(node) && node.name) {
      const interfaceName = node.name.text;
      if (/Props$/.test(interfaceName) || /Config$/.test(interfaceName)) {
        for (const member of node.members) {
          if (ts.isPropertySignature(member) && member.type) {
            if (member.type.kind === ts.SyntaxKind.AnyKeyword) {
              const propName = ts.isIdentifier(member.name) ? member.name.text : 'unknown';
              const { line, column } = this.getLineColumn(member);
              this.report(`${interfaceName}.${propName}`, line, column, `接口 ${interfaceName} 的属性 ${propName} 使用了 any 类型`, '为该属性定义更具体的类型', 'P2');
            }
          }
        }
      }
    }

    // 4. Type alias with any property
    if (ts.isTypeAliasDeclaration(node) && node.name) {
      const typeName = node.name.text;
      if (/Props$/.test(typeName) && ts.isTypeLiteralNode(node.type)) {
        for (const member of node.type.members) {
          if (ts.isPropertySignature(member) && member.type) {
            if (member.type.kind === ts.SyntaxKind.AnyKeyword) {
              const propName = ts.isIdentifier(member.name) ? member.name.text : 'unknown';
              const { line, column } = this.getLineColumn(member);
              this.report(`${typeName}.${propName}`, line, column, `类型 ${typeName} 的属性 ${propName} 使用了 any 类型`, '为该属性定义更具体的类型', 'P2');
            }
          }
        }
      }
    }
  }
}
