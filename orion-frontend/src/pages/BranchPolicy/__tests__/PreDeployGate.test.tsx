import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/tests/render';
import { MemoryRouter } from 'react-router-dom';
import PreDeployGate from '@/pages/BranchPolicy/PreDeployGate';

describe('PreDeployGate', () => {
  it('renders without crashing', () => {
    renderWithProviders(
      <MemoryRouter>
        <PreDeployGate />
      </MemoryRouter>,
    );
    expect(document.body).toBeTruthy();
  });
});
