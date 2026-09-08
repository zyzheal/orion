export interface ModuleRef {
  module: string;
  references: number;
  risk: 'high' | 'medium' | 'low';
  files: number;
  lines: number;
  hasInterface: boolean;
}

export interface FrontendRef {
  component: string;
  references: number;
  type: 'page' | 'component' | 'hook';
}

export interface BootLevel {
  level: string;
  status: 'pass' | 'partial' | 'fail';
  desc: string;
}
