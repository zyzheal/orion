import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/tests/render';
import { MemoryRouter } from 'react-router-dom';
import DeployAudit from '@/pages/BranchPolicy/DeployAudit';

describe('DeployAudit', () => {
  it('renders without crashing', () => {
    renderWithProviders(
      <MemoryRouter>
        <DeployAudit />
      </MemoryRouter>,
    );
    expect(document.body).toBeTruthy();
  });
});
