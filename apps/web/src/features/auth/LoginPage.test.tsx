import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyLocale } from '../../i18n';
import { UiProviders } from '../../components/UiProviders';
import { LoginPage } from './LoginPage';

const renderPage = () =>
  render(
    <UiProviders>
      <LoginPage />
    </UiProviders>,
  );

beforeEach(() => applyLocale('en'));

describe('LoginPage', () => {
  it('shows field errors from the shared validation rules', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findAllByText('This field is required.')).toHaveLength(2);
    expect(screen.getByRole('textbox', { name: 'E-mail address (required)' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('rejects an invalid e-mail address', async () => {
    renderPage();
    await userEvent.type(
      screen.getByRole('textbox', { name: 'E-mail address (required)' }),
      'not-an-email',
    );
    await userEvent.type(screen.getByLabelText(/^Password/), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid e-mail address.')).toBeInTheDocument();
  });

  it('switches to Hindi, including validation messages', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'हिं' }));
    expect(document.documentElement.lang).toBe('hi');
    await userEvent.click(screen.getByRole('button', { name: 'साइन इन करें' }));
    expect(await screen.findAllByText('यह फ़ील्ड आवश्यक है।')).toHaveLength(2);
    // The component library's own words follow the language too.
    expect(screen.getByRole('textbox', { name: /(आवश्यक)/ })).toBeInTheDocument();
  });

  it('explains that sign-in is not available yet, without sending anything', async () => {
    renderPage();
    await userEvent.type(
      screen.getByRole('textbox', { name: 'E-mail address (required)' }),
      'store@shwetdhara.in',
    );
    await userEvent.type(screen.getByLabelText(/^Password/), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Sign-in is being built');
  });
});
