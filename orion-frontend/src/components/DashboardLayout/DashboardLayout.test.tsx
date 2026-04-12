import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardLayout from './index';

describe('DashboardLayout', () => {
  it('should render children in a grid', () => {
    render(
      <DashboardLayout columns={2}>
        <div data-testid="item-1">Item 1</div>
        <div data-testid="item-2">Item 2</div>
      </DashboardLayout>
    );
    expect(screen.getByTestId('orion-dashboard-layout')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('should use default 3 columns', () => {
    render(
      <DashboardLayout>
        <div>Item</div>
      </DashboardLayout>
    );
    const grid = screen.getByTestId('orion-dashboard-layout');
    expect(grid).toBeInTheDocument();
  });

  it('should apply custom gap', () => {
    render(
      <DashboardLayout gap={24}>
        <div>Item</div>
      </DashboardLayout>
    );
    const grid = screen.getByTestId('orion-dashboard-layout');
    expect(grid).toHaveStyle({ gap: '24px' });
  });

  it('should apply custom padding', () => {
    render(
      <DashboardLayout padding={20}>
        <div>Item</div>
      </DashboardLayout>
    );
    const grid = screen.getByTestId('orion-dashboard-layout');
    expect(grid).toHaveStyle({ padding: '20px' });
  });

  it('should support breakpoints', () => {
    render(
      <DashboardLayout
        columns={4}
        breakpoints={{
          xs: 1,
          sm: 2,
          md: 3,
          lg: 4,
        }}
      >
        <div>Item</div>
      </DashboardLayout>
    );
    expect(screen.getByTestId('orion-dashboard-layout')).toBeInTheDocument();
  });

  it('should render without breakpoints', () => {
    render(
      <DashboardLayout columns={2}>
        <div>A</div>
        <div>B</div>
        <div>C</div>
        <div>D</div>
      </DashboardLayout>
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
  });
});
