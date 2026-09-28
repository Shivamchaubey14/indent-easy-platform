import { queryOptions } from '@tanstack/react-query';
import { graphql } from '../../generated/graphql';
import type { MppFilter, ProductFilter, VendorFilter } from '../../generated/graphql/graphql';
import { gql } from '../../lib/api';

/*
 * Catalogue masters (SRS §11.3): products, units and conversions, categories, external code
 * systems, vendors and MPPs. Server state lives in TanStack Query under the `masters` key; a save
 * invalidates it.
 */

export const CatalogReferenceQuery = graphql(`
  query CatalogReference {
    uoms {
      id
      code
      name
      nameHi
      decimalsAllowed
    }
    uomConversions {
      id
      factor
      from {
        id
        code
      }
      to {
        id
        code
      }
    }
    productCategories {
      id
      code
      name
      requiresInspection
      parent {
        id
        name
      }
      owner {
        id
        displayName
        employeeCode
      }
    }
    externalSystems {
      id
      code
      name
      displayPriority
    }
    locations(includeInactive: true) {
      id
      code
      name
      type
      active
    }
  }
`);

export const ProductsQuery = graphql(`
  query MasterProducts($filter: ProductFilter, $pagination: PaginationInput) {
    products(filter: $filter, pagination: $pagination) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          code
          name
          displayName
          sizeLabel
          isService
          status
          baseUom {
            id
            code
          }
          category {
            id
            name
          }
          standardPrice {
            amount
          }
        }
      }
    }
  }
`);

export const ProductQuery = graphql(`
  query MasterProduct($id: ID!) {
    product(id: $id) {
      id
      version
      code
      name
      nameHi
      displayName
      sizeLabel
      materialType
      hsnCode
      isStockItem
      isService
      batchTracked
      serialTracked
      reorderLevel
      status
      baseUom {
        id
      }
      category {
        id
      }
      standardPrice {
        amount
      }
      owner {
        id
        displayName
        employeeCode
      }
      externalCodes {
        system
        code
        name
        isPrimary
      }
      vendors {
        priority
        isPrimary
        leadTimeDays
        vendor {
          id
          code
          name
        }
      }
    }
  }
`);

export const SaveProductMutation = graphql(`
  mutation MasterSaveProduct($input: SaveProductInput!) {
    saveProduct(input: $input) {
      product {
        id
        version
      }
      userErrors {
        code
        message
        field
        details
      }
    }
  }
`);

export const VendorsQuery = graphql(`
  query MasterVendors($filter: VendorFilter, $pagination: PaginationInput) {
    vendors(filter: $filter, pagination: $pagination) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          code
          name
          gstin
          sapVendorCode
          status
          contacts {
            id
            email
            phone
          }
        }
      }
    }
  }
`);

export const VendorQuery = graphql(`
  query MasterVendor($id: ID!) {
    vendor(id: $id) {
      id
      version
      code
      name
      legalName
      gstin
      pan
      sapVendorCode
      paymentTermsDays
      address
      status
      contacts {
        id
        name
        email
        phone
        purposes
      }
      products {
        priority
        isPrimary
        leadTimeDays
        product {
          id
          code
          displayName
        }
      }
    }
  }
`);

export const SaveVendorMutation = graphql(`
  mutation MasterSaveVendor($input: SaveVendorInput!) {
    saveVendor(input: $input) {
      vendor {
        id
        version
      }
      userErrors {
        code
        message
        field
        details
      }
    }
  }
`);

export const SetVendorProductsMutation = graphql(`
  mutation MasterSetVendorProducts($input: SetVendorProductsInput!) {
    setVendorProducts(input: $input) {
      vendor {
        id
      }
      userErrors {
        code
        message
        field
        details
      }
    }
  }
`);

export const MppsQuery = graphql(`
  query MasterMpps($filter: MppFilter, $pagination: PaginationInput) {
    mpps(filter: $filter, pagination: $pagination) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          code
          name
          sahayakName
          sahayakMobile
          cycleBand
          village
          status
          bmc {
            id
            code
            name
          }
        }
      }
    }
  }
`);

export const SaveMppMutation = graphql(`
  mutation MasterSaveMpp($input: SaveMppInput!) {
    saveMpp(input: $input) {
      mpp {
        id
      }
      userErrors {
        code
        message
        field
        details
      }
    }
  }
`);

export const SaveUomMutation = graphql(`
  mutation MasterSaveUom($input: SaveUomInput!) {
    saveUom(input: $input) {
      uom {
        id
      }
      userErrors {
        code
        message
        field
        details
      }
    }
  }
`);

export const SaveUomConversionMutation = graphql(`
  mutation MasterSaveUomConversion($input: SaveUomConversionInput!) {
    saveUomConversion(input: $input) {
      conversion {
        id
      }
      userErrors {
        code
        message
        field
        details
      }
    }
  }
`);

export const DeleteUomConversionMutation = graphql(`
  mutation MasterDeleteUomConversion($id: ID!) {
    deleteUomConversion(id: $id) {
      deletedId
      userErrors {
        code
        message
        field
        details
      }
    }
  }
`);

export const SaveProductCategoryMutation = graphql(`
  mutation MasterSaveProductCategory($input: SaveProductCategoryInput!) {
    saveProductCategory(input: $input) {
      category {
        id
      }
      userErrors {
        code
        message
        field
        details
      }
    }
  }
`);

export const SaveExternalSystemMutation = graphql(`
  mutation MasterSaveExternalSystem($input: SaveExternalSystemInput!) {
    saveExternalSystem(input: $input) {
      externalSystem {
        id
      }
      userErrors {
        code
        message
        field
        details
      }
    }
  }
`);

export const PAGE_SIZE = 25;

/** Units, conversions, categories, code systems and locations: small, read together, cached. */
export const catalogReferenceQuery = queryOptions({
  queryKey: ['masters', 'reference'],
  queryFn: () => gql(CatalogReferenceQuery),
  staleTime: 60_000,
});

export const productsQuery = (filter: ProductFilter, after: string | null, first = PAGE_SIZE) =>
  queryOptions({
    queryKey: ['masters', 'products', filter, after, first],
    queryFn: () => gql(ProductsQuery, { filter, pagination: { first, after } }),
  });

export const productQuery = (id: string) =>
  queryOptions({
    queryKey: ['masters', 'product', id],
    queryFn: async () => (await gql(ProductQuery, { id })).product,
  });

export const vendorsQuery = (filter: VendorFilter, after: string | null) =>
  queryOptions({
    queryKey: ['masters', 'vendors', filter, after],
    queryFn: () => gql(VendorsQuery, { filter, pagination: { first: PAGE_SIZE, after } }),
  });

export const vendorQuery = (id: string) =>
  queryOptions({
    queryKey: ['masters', 'vendor', id],
    queryFn: async () => (await gql(VendorQuery, { id })).vendor,
  });

export const mppsQuery = (filter: MppFilter, after: string | null) =>
  queryOptions({
    queryKey: ['masters', 'mpps', filter, after],
    queryFn: () => gql(MppsQuery, { filter, pagination: { first: PAGE_SIZE, after } }),
  });

// ---- Imports (SRS OP-12) ------------------------------------------------------------------------

export const ImportBatchesQuery = graphql(`
  query MasterImportBatches($kinds: [ImportKind!]!) {
    importBatches(kinds: $kinds, first: 10) {
      id
      kind
      fileName
      status
      createdAt
      summary {
        created
        updated
        unchanged
        deactivated
        rejected
        warnings
      }
    }
  }
`);

export const ImportBatchQuery = graphql(`
  query MasterImportBatch($id: ID!) {
    importBatch(id: $id) {
      id
      kind
      fileName
      status
      previewOnly
      totalRows
      processedRows
      progressPct
      createdAt
      completedAt
      summary {
        created
        updated
        unchanged
        deactivated
        rejected
        warnings
      }
      errors(first: 50) {
        totalCount
        edges {
          node {
            rowIndex
            field
            value
            rule
            message
            suggestion
            critical
          }
        }
      }
      resultDocument {
        fileName
        status
        downloadUrl
      }
    }
  }
`);

export const StartImportMutation = graphql(`
  mutation MasterStartImport($input: StartImportInput!) {
    startImport(input: $input) {
      batch {
        id
      }
      userErrors {
        code
        message
        field
        details
      }
    }
  }
`);

export const CommitImportMutation = graphql(`
  mutation MasterCommitImport($batchId: ID!) {
    commitImport(input: { batchId: $batchId }) {
      batch {
        id
        status
      }
      userErrors {
        code
        message
        field
        details
      }
    }
  }
`);

export const DiscardImportMutation = graphql(`
  mutation MasterDiscardImport($batchId: ID!) {
    discardImport(batchId: $batchId) {
      batch {
        id
        status
      }
      userErrors {
        code
        message
        field
        details
      }
    }
  }
`);

/** Statuses in which the worker still has the batch; the screen polls while it is in one. */
export const IMPORT_WORKING = ['UPLOADED', 'VALIDATING', 'PROCESSING'];

export const importBatchQuery = (id: string) =>
  queryOptions({
    queryKey: ['masters', 'import', id],
    queryFn: async () => (await gql(ImportBatchQuery, { id })).importBatch,
    refetchInterval: (query) =>
      query.state.data && IMPORT_WORKING.includes(query.state.data.status) ? 1500 : false,
  });
