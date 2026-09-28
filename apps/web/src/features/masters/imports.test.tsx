import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { print } from 'graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyLocale } from '../../i18n';
import { downloadFile, gql, rest, uploadDocument } from '../../lib/api';
import type * as ApiModule from '../../lib/api';
import { renderScreen } from '../../test/render';
import { ImportsPage } from './ImportsPage';

vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof ApiModule>()),
  gql: vi.fn(),
  rest: vi.fn(),
  uploadDocument: vi.fn(),
  downloadFile: vi.fn(),
}));

const me = (permissions: string[]) => ({
  me: {
    id: 'me',
    displayName: 'Admin',
    email: 'admin@shwetdhara.local',
    employeeCode: null,
    homeWorkspace: 'ADMIN',
    permissions,
    primaryLocation: null,
  },
});

const summary = { created: 2, updated: 1, unchanged: 0, deactivated: 1, rejected: 1, warnings: 0 };

const batch = (status: string) => ({
  importBatch: {
    id: 'b1',
    kind: 'MPP_MASTER',
    fileName: 'mpps.xlsx',
    status,
    previewOnly: status === 'PREVIEW_READY',
    totalRows: 5,
    processedRows: 5,
    progressPct: 100,
    createdAt: '2026-09-28T09:00:00Z',
    completedAt: null,
    summary,
    errors: {
      totalCount: 1,
      edges: [
        {
          node: {
            rowIndex: 4,
            field: 'BMC/MCC Code',
            value: 'NO-SUCH',
            rule: 'UNKNOWN_BMC',
            message: 'No BMC or MCC with this code.',
            suggestion: 'Use the location code shown in Administration › Locations.',
            critical: true,
          },
        },
      ],
    },
    resultDocument: {
      fileName: 'mpps - result.xlsx',
      status: 'AVAILABLE',
      downloadUrl: 'http://storage/report',
    },
  },
});

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
  vi.mocked(rest).mockReset();
  vi.mocked(uploadDocument).mockReset();
  vi.mocked(downloadFile).mockReset();
  vi.mocked(uploadDocument).mockResolvedValue({
    documentId: 'd1',
    status: 'PENDING_SCAN',
    fileName: 'mpps.xlsx',
  });
  vi.mocked(rest).mockResolvedValue({
    documentId: 'd1',
    status: 'AVAILABLE',
    fileName: 'mpps.xlsx',
  });
});

const file = () =>
  new File([new Uint8Array([0x50, 0x4b, 3, 4])], 'mpps.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

describe('ImportsPage', () => {
  it('offers only the imports the user may run and downloads their template', async () => {
    serve({ Me: me(['mpp:import', 'mpp:read']), MasterImportBatches: { importBatches: [] } });
    await renderScreen(() => <ImportsPage />);
    const kind = await screen.findByLabelText('What to import');
    expect(
      within(kind)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['MPPs']);
    await userEvent.click(
      screen.getByRole('button', { name: 'Download template with current data' }),
    );
    expect(downloadFile).toHaveBeenCalledWith('/api/v1/imports/templates/MPP_MASTER');
  });

  it('uploads, waits for the safety check, previews, and applies on request', async () => {
    const start = vi.fn(() => ({ startImport: { batch: { id: 'b1' }, userErrors: [] } }));
    const commit = vi.fn(() => ({
      commitImport: { batch: { id: 'b1', status: 'PROCESSING' }, userErrors: [] },
    }));
    serve({
      Me: me(['mpp:import']),
      MasterImportBatches: { importBatches: [] },
      MasterStartImport: start,
      MasterImportBatch: batch('PREVIEW_READY'),
      MasterCommitImport: commit,
    });
    await renderScreen(() => <ImportsPage />);
    await userEvent.upload(await screen.findByLabelText('Choose a file'), file());
    await userEvent.click(screen.getByLabelText(/^Deactivate MPPs missing/));
    await userEvent.click(screen.getByRole('button', { name: 'Check file' }));

    await waitFor(() =>
      expect(start).toHaveBeenCalledWith({
        input: {
          kind: 'MPP_MASTER',
          documentId: 'd1',
          previewOnly: true,
          force: false,
          options: { deactivateMissing: true },
        },
      }),
    );
    expect(uploadDocument).toHaveBeenCalledWith(expect.any(File), 'IMPORT_FILE');
    expect(rest).toHaveBeenCalledWith('/api/v1/files/d1');

    expect(await screen.findByText('Preview ready')).toBeInTheDocument();
    expect(screen.getByText('No BMC or MCC with this code.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download report' })).toHaveAttribute(
      'href',
      'http://storage/report',
    );
    const deactivated = screen.getByText('Deactivated').closest('div')!;
    expect(within(deactivated).getByText('1')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Apply import' }));
    await waitFor(() => expect(commit).toHaveBeenCalledWith({ batchId: 'b1' }));
  });

  it('offers to check an already imported file again without uploading it again', async () => {
    const start = vi.fn((variables: unknown) =>
      (variables as { input: { force: boolean } }).input.force
        ? { startImport: { batch: { id: 'b1' }, userErrors: [] } }
        : {
            startImport: {
              batch: null,
              userErrors: [
                {
                  code: 'RECONCILIATION_DUPLICATE_FILE',
                  message: 'validation.importDuplicateFile',
                  field: ['input', 'documentId'],
                  details: null,
                },
              ],
            },
          },
    );
    serve({
      Me: me(['mpp:import']),
      MasterImportBatches: { importBatches: [] },
      MasterStartImport: start,
      MasterImportBatch: batch('PREVIEW_READY'),
    });
    await renderScreen(() => <ImportsPage />);
    await userEvent.upload(await screen.findByLabelText('Choose a file'), file());
    await userEvent.click(screen.getByRole('button', { name: 'Check file' }));
    expect(await screen.findByText('This file was already imported.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Check it again anyway' }));
    await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    expect(start).toHaveBeenLastCalledWith({
      input: expect.objectContaining({ documentId: 'd1', force: true }),
    });
    expect(uploadDocument).toHaveBeenCalledTimes(1);
  });

  it('explains a file the safety check rejected', async () => {
    vi.mocked(rest).mockResolvedValue({
      documentId: 'd1',
      status: 'QUARANTINED',
      fileName: 'x.xlsx',
    });
    serve({ Me: me(['mpp:import']), MasterImportBatches: { importBatches: [] } });
    await renderScreen(() => <ImportsPage />);
    await userEvent.upload(await screen.findByLabelText('Choose a file'), file());
    await userEvent.click(screen.getByRole('button', { name: 'Check file' }));
    expect(
      await screen.findByText('The file was rejected by the safety check.'),
    ).toBeInTheDocument();
  });
});
