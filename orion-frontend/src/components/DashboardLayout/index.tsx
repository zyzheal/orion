/**
 * DashboardLayout Component
 * - Responsive grid layout for dashboard pages
 * - Configurable columns
 * - Auto-adjusts based on screen size
 */
import React, { useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface DashboardLayoutProps {
  /** Child elements (typically CardPanel or MetricCard) */
  children: React.ReactNode;
  /** Number of columns (default: responsive) */
  columns?: number;
  /** Column count overrides for breakpoints */
  breakpoints?: {
    xs?: number; // < 576px
    sm?: number; // >= 576px
    md?: number; // >= 768px
    lg?: number; // >= 992px
    xl?: number; // >= 1200px
    xxl?: number; // >= 1600px
  };
  /** Gap between items */
  gap?: number;
  /** Padding around the grid */
  padding?: number;
}

// ============================================================================
// Component
// ============================================================================

function DashboardLayout({
  children,
  columns = 3,
  breakpoints,
  gap = 16,
  padding = 0,
}: DashboardLayoutProps) {
  const style = useMemo(
    () => ({
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap: `${gap}px`,
      padding: `${padding}px`,
    }),
    [columns, gap, padding]
  );

  // Responsive style injection
  const responsiveCSS = useMemo(() => {
    if (!breakpoints) return '';

    const queries: string[] = [];

    if (breakpoints.xs !== undefined) {
      queries.push(
        `@media (max-width: 575px) { .orion-dashboard-grid { grid-template-columns: repeat(${breakpoints.xs}, 1fr) !important; } }`
      );
    }
    if (breakpoints.sm !== undefined) {
      queries.push(
        `@media (min-width: 576px) and (max-width: 767px) { .orion-dashboard-grid { grid-template-columns: repeat(${breakpoints.sm}, 1fr) !important; } }`
      );
    }
    if (breakpoints.md !== undefined) {
      queries.push(
        `@media (min-width: 768px) and (max-width: 991px) { .orion-dashboard-grid { grid-template-columns: repeat(${breakpoints.md}, 1fr) !important; } }`
      );
    }
    if (breakpoints.lg !== undefined) {
      queries.push(
        `@media (min-width: 992px) and (max-width: 1199px) { .orion-dashboard-grid { grid-template-columns: repeat(${breakpoints.lg}, 1fr) !important; } }`
      );
    }
    if (breakpoints.xl !== undefined) {
      queries.push(
        `@media (min-width: 1200px) { .orion-dashboard-grid { grid-template-columns: repeat(${breakpoints.xl}, 1fr) !important; } }`
      );
    }
    if (breakpoints.xxl !== undefined) {
      queries.push(
        `@media (min-width: 1600px) { .orion-dashboard-grid { grid-template-columns: repeat(${breakpoints.xxl}, 1fr) !important; } }`
      );
    }

    return queries.join('\n');
  }, [breakpoints]);

  return (
    <>
      {responsiveCSS && <style>{responsiveCSS}</style>}
      <div className="orion-dashboard-grid" style={style} data-testid="orion-dashboard-layout">
        {children}
      </div>
    </>
  );
}

export default DashboardLayout;
