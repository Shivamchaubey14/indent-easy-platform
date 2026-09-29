import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { print } from 'graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyLocale } from '../../i18n';
import { gql } from '../../lib/api';
import type * as ApiModule from '../../lib/api';
import { renderScreen } from '../../test/render';
import { AuditPage } from './AuditPage';
import { FeatureFlagsPage } from './FeatureFlagsPage';
import { NumberSeriesPage } from './NumberSeriesPage';
import { SettingsPage } from './SettingsPage';

vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof ApiModule>()),
  gql: vi.fn(),
}));

/** Answers each GraphQL document by its operation name. */
function serve(answers: Record<string, unknown>) {
  vi.mocked(gql).mockImplementation((document: unknown, variables?: unknown) => {
    const name = /(?:query|mutation) (\w+)/.exec(print(document as never))?.[1] ?? '';
    const answer = answers[name];
    if (answer === undefined) throw new Error(`unexpected operation ${name}`);
    const value: unknown =
      typeof answer === 'function' ? (answer as (v: unknown) => unknown)(variables) : answer;
    return Promise.resolve(value);
  });
}

beforeEach(() => {
  applyLocale('en');
  vi.mocked(gql).mockReset();
});

describe('NumberSeriesPage', () => {
  it('shows the next number and refuses to move it backwards', async () => {
    const update = vi.fn(() => ({
      updateNumberSeries: { series: { id: 's1', preview: 'REQ0500' }, userErrors: [] },
    }));
    serve({
      AdminNumberSeries: {
        numberSeries: [
          {
            id: 's1',
            docType: 'INDENT',
            fiscalYear: null,
            prefix: 'REQ',
            padding: 4,
            nextValue: 459,
            resetPolicy: 'NEVER',
            preview: 'REQ0459',
            location: null,
          },
        ],
      },
      AdminUpdateNumberSeries: update,
    });
    await renderScreen(() => <NumberSeriesPage />);
    expect(await screen.findByText('REQ0459')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Edit: Indent' }));
    const dialog = await screen.findByRole('dialog');
    const next = within(dialog).getByLabelText(/^Next number/);
    await userEvent.clear(next);
    await userEvent.type(next, '400');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('The next number can only go up.')).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();

    await userEvent.clear(next);
    await userEvent.type(next, '500');
    expect(within(dialog).getByText('REQ0500')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        input: { id: 's1', prefix: 'REQ', padding: 4, nextValue: 500, resetPolicy: 'NEVER' },
      }),
    );
  });
});

describe('SettingsPage', () => {
  it('saves a value and shows the server refusal', async () => {
    const update = vi.fn((variables: unknown) =>
      (variables as { value: number }).value > 100
        ? {
            updateSetting: {
              setting: null,
              userErrors: [
                {
                  code: 'VALIDATION_FAILED',
                  message: 'validation.outOfRange',
                  field: ['input', 'value'],
                  details: null,
                },
              ],
            },
          }
        : { updateSetting: { setting: { key: 'k', value: 12, isDefault: false }, userErrors: [] } },
    );
    serve({
      AdminSettings: {
        settings: [
          {
            key: 'receiving.overReceiptTolerancePct',
            value: 10,
            defaultValue: 10,
            isDefault: true,
            source: 'GRN-005 (legacy 10%)',
            updatedAt: null,
            updatedBy: null,
            input: { kind: 'number', min: 0, max: 100, step: 0.5, unit: '%' },
          },
        ],
      },
      AdminUpdateSetting: update,
    });
    await renderScreen(() => <SettingsPage />);
    expect(await screen.findByText('Over-receipt tolerance')).toBeInTheDocument();
    const value = screen.getByLabelText('Value');
    await userEvent.clear(value);
    await userEvent.type(value, '150');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('This number is out of range.')).toBeInTheDocument();
    await userEvent.clear(value);
    await userEvent.type(value, '12');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith({
        key: 'receiving.overReceiptTolerancePct',
        value: 12,
      }),
    );
  });
});

describe('FeatureFlagsPage', () => {
  it('switches a flag and keeps its targeting rules', async () => {
    const set = vi.fn(() => ({ setFeatureFlag: { key: 'rfq', enabled: true, rules: null } }));
    serve({
      AdminFeatureFlags: {
        featureFlags: [
          {
            key: 'rfq',
            enabled: false,
            rules: { environments: ['dev'] },
            description: 'Requests for quotation',
          },
        ],
      },
      AdminSetFeatureFlag: set,
    });
    await renderScreen(() => <FeatureFlagsPage />);
    expect(await screen.findByText(/DEV|dev/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Requests for quotation'));
    await waitFor(() =>
      expect(set).toHaveBeenCalledWith({
        input: { key: 'rfq', enabled: true, rules: { environments: ['dev'] } },
      }),
    );
  });
});

describe('AuditPage', () => {
  it('shows the fields a change touched and the result of a tamper check', async () => {
    serve({
      AdminAuditLog: {
        auditLog: {
          totalCount: 1,
          pageInfo: { hasNextPage: false, endCursor: null },
          edges: [
            {
              node: {
                id: 'a1',
                occurredAt: '2026-09-29T05:00:00Z',
                action: 'SETTING_CHANGED',
                entityType: 'Setting',
                entityId: 'o1',
                entityNumber: 'receiving.overReceiptTolerancePct',
                before: { key: 'receiving.overReceiptTolerancePct', value: 10 },
                after: { key: 'receiving.overReceiptTolerancePct', value: 12.5 },
                requestId: 'req-1',
                channel: 'WEB',
                actor: { id: 'u1', displayName: 'Local Admin' },
              },
            },
          ],
        },
      },
      AdminAuditChainCheck: {
        auditChainCheck: { day: '2026-09-29', records: 9, intact: true, brokenAt: null },
      },
    });
    await renderScreen(() => <AuditPage />);
    const row = (await screen.findByText('SETTING_CHANGED')).closest('tr')!;
    expect(within(row).getByText('Local Admin')).toBeInTheDocument();
    await userEvent.click(within(row).getByRole('button', { name: 'Details' }));
    const changed = screen.getByRole('cell', { name: 'value' }).closest('tr')!;
    expect(within(changed).getByText('10')).toBeInTheDocument();
    expect(within(changed).getByText('12.5')).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'key' })).not.toBeInTheDocument(); // unchanged field

    await userEvent.click(screen.getByRole('button', { name: 'Check the day' }));
    expect(await screen.findByText('Intact')).toBeInTheDocument();
  });
});
