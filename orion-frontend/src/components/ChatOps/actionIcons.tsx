/**
 * Action Icons — getActionIcon for action buttons
 *
 * Extracted from types.tsx to keep pure type definitions separate from React components.
 */

import React from 'react';
import { ArrowRightOutlined, ExportOutlined } from '@ant-design/icons';
import { hasTarget } from './types';
import type { ExtendedAction } from './types';

/** Get a small icon indicating the action type (navigation or command) */
export function getActionIcon(action: ExtendedAction): React.ReactNode {
  if (hasTarget(action)) {
    if (action.target.externalUrl) {
      return <ExportOutlined style={{ fontSize: 10, marginLeft: 4, opacity: 0.5 }} />;
    }
    return <ArrowRightOutlined style={{ fontSize: 10, marginLeft: 4, opacity: 0.5 }} />;
  }
  return null;
}
