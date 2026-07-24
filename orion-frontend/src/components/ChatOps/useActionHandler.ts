/**
 * useActionHandler — unified action handler for ChatOps components.
 *
 * Handles three cases:
 * 1. Action has externalUrl → opens in new tab (with security validation)
 * 2. Action has resourceType + resourceId → navigates via React Router
 * 3. Action has no target → executes command via chatOpsStore
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatOpsStore } from '@/stores/chatOpsStore';
import type { ExtendedAction } from './types';
import { hasTarget } from './types';
import { isSafeExternalUrl } from './actionSecurity';
import { buildInternalRoute } from './internalRoutes';

export function useActionHandler() {
  const navigate = useNavigate();
  const { executeAction } = useChatOpsStore();

  return useCallback(
    (action: ExtendedAction) => {
      // Case: action has a navigation target
      if (hasTarget(action)) {
        const { target } = action;

        // External URL
        if (target.externalUrl) {
          if (isSafeExternalUrl(target.externalUrl)) {
            if (target.openInNewTab) {
              window.open(target.externalUrl, '_blank', 'noopener,noreferrer');
            } else {
              // Use window.open instead of window.location.href to maintain
              // browser history consistency and avoid losing chat context
              window.open(target.externalUrl, '_self');
            }
            return;
          }
          // Unsafe URL — log warning and fall through to command execution
          console.warn('[ChatOps] Blocked unsafe external URL');
        }

        // Internal resource route
        if (target.resourceType && target.resourceId) {
          const route = buildInternalRoute(target.resourceType, target.resourceId);
          if (route) {
            navigate(route);
            return;
          }
          // Unknown resource type — fall through to command execution
        }
      }

      // Default: execute command
      executeAction(action.command, action.params);
    },
    [navigate, executeAction]
  );
}
