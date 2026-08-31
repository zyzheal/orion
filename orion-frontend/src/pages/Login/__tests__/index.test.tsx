/**
 * Tests for Login page
 */
import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { IntlProvider } from '@/i18n/IntlProvider';
import Login from '../index';

// Login 同时依赖两套上下文，缺一就抛：
//   - useLocation/useNavigate → 需要 MemoryRouter
//   - useIntl（index.tsx:69） → 需要 IntlProvider
// 旧写法只包了 Router，测试永远停在 "useIntl must be used within IntlProvider"。
const renderWithProviders = (ui: ReactElement) => {
  return render(
    <IntlProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </IntlProvider>,
  );
};

describe('Login', () => {
  it('renders without crashing', () => {
    renderWithProviders(<Login />);
    expect(document.body).toBeTruthy();
  });
});
