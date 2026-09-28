import { describe, expect, it } from 'vitest';
import {
  saveMppInputSchema,
  saveProductInputSchema,
  saveUomConversionInputSchema,
  saveVendorInputSchema,
  setVendorProductsInputSchema,
} from './catalog.js';

const messages = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((i) => i.message) ?? [];

const product = {
  code: ' cf-001 ',
  name: ' Cattle Feed ',
  baseUomId: 'uom-1',
  isStockItem: true,
  isService: false,
};

describe('catalogue inputs', () => {
  it('normalises a product: code upper-case, blanks dropped, flags defaulted', () => {
    const parsed = saveProductInputSchema.parse({ ...product, sizeLabel: '', hsnCode: '2309' });
    expect(parsed).toMatchObject({
      code: 'CF-001',
      name: 'Cattle Feed',
      hsnCode: '2309',
      batchTracked: false,
      status: 'ACTIVE',
    });
    expect(parsed.sizeLabel).toBeUndefined();
  });

  it('refuses a stocked service', () => {
    const result = saveProductInputSchema.safeParse({ ...product, isService: true });
    expect(messages(result)).toEqual(['validation.serviceNotStock']);
  });

  it('allows one primary code per external system and no repeated codes', () => {
    const result = saveProductInputSchema.safeParse({
      ...product,
      externalCodes: [
        { system: 'sap', code: '1000123', name: 'CATTLE FEED 50KG' },
        { system: 'SAP', code: '1000123', name: 'CATTLE FEED' },
        { system: 'NDDB', name: 'Cattle feed' },
      ],
    });
    expect(messages(result)).toEqual(['validation.onePrimaryPerSystem', 'validation.duplicate']);
  });

  it('checks GSTIN format and that the PAN inside it matches', () => {
    const base = { name: 'Genflow AI', contacts: [] };
    expect(
      saveVendorInputSchema.safeParse({ ...base, gstin: '09AAACB1234C1Z5', pan: 'aaacb1234c' })
        .success,
    ).toBe(true);
    expect(messages(saveVendorInputSchema.safeParse({ ...base, gstin: '09AAACB1234' }))).toEqual([
      'validation.gstin',
    ]);
    expect(
      messages(
        saveVendorInputSchema.safeParse({ ...base, gstin: '09AAACB1234C1Z5', pan: 'ZZZZZ9999Z' }),
      ),
    ).toEqual(['validation.panGstinMismatch']);
  });

  it('needs an e-mail or a phone on every vendor contact', () => {
    const result = saveVendorInputSchema.safeParse({
      name: 'V',
      contacts: [{ name: 'Accounts', email: '', purposes: ['ACCOUNTS'] }],
    });
    expect(messages(result)).toEqual(['validation.contactChannel']);
  });

  it('refuses the same product twice in a vendor mapping', () => {
    const result = setVendorProductsInputSchema.safeParse({
      vendorId: 'v',
      items: [{ productId: 'p' }, { productId: 'p', priority: 2 }],
    });
    expect(messages(result)).toEqual(['validation.duplicate']);
  });

  it('refuses a conversion to the same unit and a zero factor', () => {
    expect(
      messages(
        saveUomConversionInputSchema.safeParse({ fromUomId: 'a', toUomId: 'a', factor: '0' }),
      ),
    ).toEqual(['validation.mustBePositive', 'validation.sameUom']);
  });

  it('stores the Sahayak mobile in E.164', () => {
    const parsed = saveMppInputSchema.parse({
      code: '00123',
      name: 'Rampur',
      bmcLocationId: 'l',
      sahayakMobile: '+91 98765 43210',
    });
    expect(parsed.sahayakMobile).toBe('+919876543210');
  });
});
