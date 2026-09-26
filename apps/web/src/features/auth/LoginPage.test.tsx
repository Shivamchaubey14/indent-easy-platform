import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyLocale } from '../../i18n';
import { AuthError, signIn } from '../../lib/auth';
import type * as AuthModule from '../../lib/auth';
import { renderScreen } from '../../test/render';
import { LoginPage } from './LoginPage';

vi.mock('../../lib/auth', async (original) => ({
  ...(await original<typeof AuthModule>()),
  signIn: vi.fn(),
}));

const identifier = () =>
  screen.getByRole('textbox', { name: 'E-mail or employee code (required)' });

async function fillAndSubmit() {
  await userEvent.type(identifier(), 'store@shwetdhara.in');
  await userEvent.type(screen.getByLabelText(/^Password/), 'the password');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

beforeEach(() => {
  applyLocale('en');
  vi.mocked(signIn).mockReset();
});

describe('LoginPage', () => {
  it('shows field errors from the shared validation rules without calling the server', async () => {
    await renderScreen(() => <LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findAllByText('This field is required.')).toHaveLength(2);
    expect(identifier()).toHaveAttribute('aria-invalid', 'true');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('switches to Hindi, including validation messages', async () => {
    await renderScreen(() => <LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: 'हिं' }));
    expect(document.documentElement.lang).toBe('hi');
    await userEvent.click(screen.getByRole('button', { name: 'साइन इन करें' }));
    expect(await screen.findAllByText('यह फ़ील्ड आवश्यक है।')).toHaveLength(2);
  });

  it('signs in and returns to the page the user asked for', async () => {
    vi.mocked(signIn).mockResolvedValue({ mustChangePassword: false });
    await renderScreen(() => <LoginPage redirectTo="/indents" />);
    await fillAndSubmit();
    expect(signIn).toHaveBeenCalledWith({
      identifier: 'store@shwetdhara.in',
      password: 'the password',
    });
    expect(await screen.findByTestId('navigated')).toHaveTextContent('/indents');
  });

  it('sends a user with a temporary password to change it first', async () => {
    vi.mocked(signIn).mockResolvedValue({ mustChangePassword: true });
    await renderScreen(() => <LoginPage redirectTo="/indents" />);
    await fillAndSubmit();
    expect(await screen.findByTestId('navigated')).toHaveTextContent('/change-password');
  });

  it.each([
    [
      { code: 'AUTH_INVALID_CREDENTIALS' },
      'The e-mail address, employee code or password is incorrect.',
    ],
    [{ code: 'AUTH_ACCOUNT_LOCKED', retryAfter: 840 }, 'locked for 14 minutes'],
    [{ code: 'NETWORK_ERROR' }, 'The server could not be reached.'],
  ])('explains a refusal (%j)', async (problem, message) => {
    vi.mocked(signIn).mockRejectedValue(new AuthError(problem));
    await renderScreen(() => <LoginPage />);
    await fillAndSubmit();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });
});
