/**
 * PageLayout Component
 * - Header + sidebar + content area
 * - Responsive design (collapsible sidebar)
 * - Reusable page-level layout
 */
import React, { useState } from 'react';
import { Layout as AntLayout } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';

// ============================================================================
// Types
// ============================================================================

export interface PageLayoutProps {
  /** Header content */
  header?: React.ReactNode;
  /** Sidebar content */
  sidebar?: React.ReactNode;
  /** Page content */
  children: React.ReactNode;
  /** Footer content */
  footer?: React.ReactNode;
  /** Whether sidebar is initially collapsed */
  defaultCollapsed?: boolean;
  /** Sidebar width when expanded */
  sidebarWidth?: number;
  /** Sidebar width when collapsed */
  collapsedWidth?: number;
  /** Whether to show collapse toggle */
  collapsible?: boolean;
  /** Controlled collapsed state */
  collapsed?: boolean;
  /** Handler for collapse toggle */
  onCollapse?: (collapsed: boolean) => void;
  /** Breadcrumb content */
  breadcrumb?: React.ReactNode;
  /** Whether to use dark sidebar */
  darkSidebar?: boolean;
}

// ============================================================================
// Component
// ============================================================================

function PageLayout({
  header,
  sidebar,
  children,
  footer,
  defaultCollapsed = false,
  sidebarWidth = 240,
  collapsedWidth = 64,
  collapsible = true,
  collapsed: controlledCollapsed,
  onCollapse,
  breadcrumb,
  darkSidebar = true,
}: PageLayoutProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);

  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const handleToggle = () => {
    const newCollapsed = !isCollapsed;
    if (onCollapse) {
      onCollapse(newCollapsed);
    } else {
      setInternalCollapsed(newCollapsed);
    }
  };

  return (
    <AntLayout
      style={{ minHeight: '100vh' }}
      className="orion-page-layout"
      data-testid="orion-page-layout"
    >
      {/* Header */}
      {header && (
        <AntLayout.Header
          style={{
            padding: '0 24px',
            height: 64,
            lineHeight: '64px',
            background: 'var(--bg-elevated, #ffffff)',
            borderBottom: '1px solid var(--border-light, #f0f0f0)',
            display: 'flex',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          {header}
        </AntLayout.Header>
      )}

      <AntLayout style={{ flex: 1 }}>
        {/* Sidebar */}
        {sidebar && (
          <AntLayout.Sider
            trigger={null}
            collapsible
            collapsed={isCollapsed}
            width={sidebarWidth}
            collapsedWidth={collapsedWidth}
            theme={darkSidebar ? 'dark' : 'light'}
            style={{
              overflow: 'auto',
              height: 'calc(100vh - 64px)',
              position: 'sticky',
              top: 64,
              background: darkSidebar
                ? 'var(--color-neutral-900, #1f1f1f)'
                : 'var(--bg-elevated, #ffffff)',
            }}
          >
            {/* Collapse toggle */}
            {collapsible && (
              <div
                style={{
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: darkSidebar ? 'rgba(255,255,255,0.65)' : 'var(--text-secondary, #595959)',
                  borderBottom: '1px solid var(--border-light, #f0f0f0)',
                }}
                onClick={handleToggle}
              >
                {isCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              </div>
            )}

            {/* Sidebar content */}
            <div style={{ padding: isCollapsed ? '8px 0' : '8px' }}>{sidebar}</div>
          </AntLayout.Sider>
        )}

        {/* Main content area */}
        <AntLayout.Content
          style={{
            padding: 24,
            minHeight: 'calc(100vh - 64px)',
            background: 'var(--bg-secondary, #fafafa)',
          }}
        >
          {/* Breadcrumb */}
          {breadcrumb && (
            <div
              style={{
                marginBottom: 16,
                padding: '12px 16px',
                background: 'var(--bg-elevated, #ffffff)',
                borderRadius: 'var(--radius-md, 6px)',
              }}
            >
              {breadcrumb}
            </div>
          )}

          {/* Page content */}
          <div
            style={{
              background: 'var(--bg-elevated, #ffffff)',
              borderRadius: 'var(--radius-md, 6px)',
              padding: 24,
              minHeight: 'calc(100vh - 160px)',
              boxShadow: 'var(--shadow-card, 0 1px 2px rgba(0,0,0,0.03))',
            }}
          >
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div
              style={{
                marginTop: 16,
                textAlign: 'center',
                color: 'var(--text-tertiary, #8c8c8c)',
                fontSize: 12,
              }}
            >
              {footer}
            </div>
          )}
        </AntLayout.Content>
      </AntLayout>
    </AntLayout>
  );
}

export default PageLayout;
