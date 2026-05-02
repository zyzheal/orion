/**
 * ChatOps Action Types — shared across components and store
 */

import React from 'react';
import { ArrowRightOutlined, ExportOutlined } from '@ant-design/icons';

/** Target for action navigation (internal or external) */
export interface ActionTarget {
  /** Internal resource type, e.g. 'deployment', 'alert', 'pipeline' */
  resourceType?: string;
  /** Resource ID for internal routing */
  resourceId?: string;
  /** External full URL (mutually exclusive with resourceType) */
  externalUrl?: string;
  /** Open in new tab/window */
  openInNewTab?: boolean;
}

/** Extended action with optional navigation target */
export interface ExtendedAction {
  label: string;
  command: string;
  params: Record<string, unknown>;
  /** If present, clicking this action navigates instead of executing a command */
  target?: ActionTarget;
}

/** Type guard to check if action has a navigation target */
export function hasTarget(action: ExtendedAction): action is ExtendedAction & { target: ActionTarget } {
  return !!action.target;
}

/** Get a small icon indicating the action type (navigation or command) */
export function getActionIcon(action: ExtendedAction): React.ReactNode {
  if (hasTarget(action)) {
    if (action.target?.externalUrl) {
      return <ExportOutlined style={{ fontSize: 10, marginLeft: 4, opacity: 0.5 }} />;
    }
    return <ArrowRightOutlined style={{ fontSize: 10, marginLeft: 4, opacity: 0.5 }} />;
  }
  return null;
}
