import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/tests/render';
import { MemoryRouter } from 'react-router-dom';
import SyncPolicyList from '@/pages/BranchPolicy/SyncPolicyList';

describe('SyncPolicyList', () => {
  it('renders without crashing', () => {
    renderWithProviders(
      <MemoryRouter>
        <SyncPolicyList />
      </MemoryRouter>,
    );
    expect(document.body).toBeTruthy();
  });
});
