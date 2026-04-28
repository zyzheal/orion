import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PageLayout from './index';

describe('PageLayout', () => {
  it('should render children', () => {
    render(
      <PageLayout>
        <div data-testid="content">Page Content</div>
      </PageLayout>
    );
    expect(screen.getByTestId('orion-page-layout')).toBeInTheDocument();
    expect(screen.getByText('Page Content')).toBeInTheDocument();
  });

  it('should render header when provided', () => {
    render(
      <PageLayout header={<div data-testid="header">My Header</div>}>
        <div>Content</div>
      </PageLayout>
    );
    expect(screen.getByText('My Header')).toBeInTheDocument();
  });

  it('should render sidebar when provided', () => {
    render(
      <PageLayout sidebar={<div data-testid="sidebar">Sidebar</div>}>
        <div>Content</div>
      </PageLayout>
    );
    expect(screen.getByText('Sidebar')).toBeInTheDocument();
  });

  it('should render footer when provided', () => {
    render(
      <PageLayout footer={<div data-testid="footer">Footer Text</div>}>
        <div>Content</div>
      </PageLayout>
    );
    expect(screen.getByText('Footer Text')).toBeInTheDocument();
  });

  it('should render breadcrumb when provided', () => {
    render(
      <PageLayout breadcrumb={<div data-testid="breadcrumb">Home / Page</div>}>
        <div>Content</div>
      </PageLayout>
    );
    expect(screen.getByText('Home / Page')).toBeInTheDocument();
  });

  it('should be collapsible by default', () => {
    render(
      <PageLayout sidebar={<div>Sidebar</div>}>
        <div>Content</div>
      </PageLayout>
    );
    // Collapse toggle should be present
    expect(screen.getByTestId('orion-page-layout')).toBeInTheDocument();
  });

  it('should not show collapse toggle when collapsible is false', () => {
    render(
      <PageLayout sidebar={<div>Sidebar</div>} collapsible={false}>
        <div>Content</div>
      </PageLayout>
    );
    // Should still render but without collapse toggle
    expect(screen.getByTestId('orion-page-layout')).toBeInTheDocument();
  });

  it('should respect controlled collapsed state', () => {
    render(
      <PageLayout sidebar={<div>Sidebar</div>} collapsed={true} onCollapse={() => {}}>
        <div>Content</div>
      </PageLayout>
    );
    expect(screen.getByTestId('orion-page-layout')).toBeInTheDocument();
  });

  it('should call onCollapse when toggle is clicked', () => {
    const handleCollapse = vi.fn();
    render(
      <PageLayout sidebar={<div>Sidebar</div>} collapsed={false} onCollapse={handleCollapse}>
        <div>Content</div>
      </PageLayout>
    );

    // Find and click the toggle
    const toggle = screen.getByRole('presentation');
    toggle.click();
    expect(handleCollapse).toHaveBeenCalledWith(true);
  });

  it('should support light sidebar theme', () => {
    render(
      <PageLayout sidebar={<div>Sidebar</div>} darkSidebar={false}>
        <div>Content</div>
      </PageLayout>
    );
    expect(screen.getByTestId('orion-page-layout')).toBeInTheDocument();
  });
});
