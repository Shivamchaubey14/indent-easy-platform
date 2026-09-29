import { queryOptions } from '@tanstack/react-query';
import { graphql } from '../../generated/graphql';
import type { UserFilter } from '../../generated/graphql/graphql';
import { gql } from '../../lib/api';

/*
 * Administration: users, roles and organisation masters (SRS §11.2). Lists are server state in
 * TanStack Query; after a save the affected lists are invalidated.
 */

export const UsersQuery = graphql(`
  query AdminUsers($filter: UserFilter, $pagination: PaginationInput) {
    users(filter: $filter, pagination: $pagination) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          email
          displayName
          employeeCode
          status
          lastLoginAt
          primaryLocation {
            id
            name
          }
          roles {
            role {
              id
              code
              name
            }
          }
        }
      }
    }
  }
`);

export const UserQuery = graphql(`
  query AdminUser($id: ID!) {
    user(id: $id) {
      id
      email
      displayName
      mobile
      employeeCode
      status
      version
      preferredLocale
      deliveryPointCode
      lastLoginAt
      primaryLocation {
        id
        name
        code
      }
      locations {
        id
        name
        code
      }
      department {
        id
        name
      }
      designation {
        id
        name
      }
      reportsTo {
        id
        displayName
        employeeCode
      }
      roles {
        role {
          id
          code
          name
        }
        scopeLocations {
          id
          code
          name
        }
        scopeDepartments {
          id
          name
        }
        scopeCategories {
          id
          name
        }
        validFrom
        validTo
      }
    }
  }
`);

export const ReferenceDataQuery = graphql(`
  query AdminReferenceData {
    roles {
      id
      code
      name
      description
      isSystem
      permissions
      userCount
    }
    permissionCatalogue
    locations(includeInactive: true) {
      id
      code
      name
      nameHi
      type
      sapPlantCode
      address
      excludedFromCrossView
      active
    }
    departments {
      id
      code
      name
    }
    designations {
      id
      code
      name
    }
    productCategories {
      id
      code
      name
    }
  }
`);

export const CreateUserMutation = graphql(`
  mutation AdminCreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      user {
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

export const UpdateUserMutation = graphql(`
  mutation AdminUpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      user {
        id
        version
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

export const SetUserRolesMutation = graphql(`
  mutation AdminSetUserRoles($input: SetUserRolesInput!) {
    setUserRoles(input: $input) {
      user {
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

export const UnlockUserMutation = graphql(`
  mutation AdminUnlockUser($id: ID!) {
    unlockUser(id: $id) {
      user {
        id
        version
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

export const ForcePasswordResetMutation = graphql(`
  mutation AdminForcePasswordReset($id: ID!) {
    forcePasswordReset(id: $id) {
      user {
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

export const SaveRoleMutation = graphql(`
  mutation AdminSaveRole($input: SaveRoleInput!) {
    saveRole(input: $input) {
      role {
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

export const SaveLocationMutation = graphql(`
  mutation AdminSaveLocation($input: SaveLocationInput!) {
    saveLocation(input: $input) {
      location {
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

export const SaveDepartmentMutation = graphql(`
  mutation AdminSaveDepartment($input: SaveDepartmentInput!) {
    saveDepartment(input: $input) {
      department {
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

export const SaveDesignationMutation = graphql(`
  mutation AdminSaveDesignation($input: SaveDesignationInput!) {
    saveDesignation(input: $input) {
      designation {
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

export const usersQuery = (filter: UserFilter, after: string | null) =>
  queryOptions({
    queryKey: ['admin', 'users', filter, after],
    queryFn: () => gql(UsersQuery, { filter, pagination: { first: PAGE_SIZE, after } }),
  });

export const userQuery = (id: string) =>
  queryOptions({
    queryKey: ['admin', 'user', id],
    queryFn: async () => (await gql(UserQuery, { id })).user,
  });

/** Roles, the permission catalogue and the organisation masters: small and read together. */
export const referenceDataQuery = queryOptions({
  queryKey: ['admin', 'reference'],
  queryFn: () => gql(ReferenceDataQuery),
  staleTime: 60_000,
});

// ---- Number series, settings, feature flags, audit (SRS §11.18, §11.19) ------------------------

export const NumberSeriesQuery = graphql(`
  query AdminNumberSeries {
    numberSeries {
      id
      docType
      fiscalYear
      prefix
      padding
      nextValue
      resetPolicy
      preview
      location {
        id
        name
      }
    }
  }
`);

export const UpdateNumberSeriesMutation = graphql(`
  mutation AdminUpdateNumberSeries($input: UpdateNumberSeriesInput!) {
    updateNumberSeries(input: $input) {
      series {
        id
        preview
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

export const SettingsQuery = graphql(`
  query AdminSettings {
    settings {
      key
      value
      defaultValue
      isDefault
      source
      updatedAt
      updatedBy {
        id
        displayName
      }
      input {
        kind
        min
        max
        step
        unit
      }
    }
  }
`);

export const UpdateSettingMutation = graphql(`
  mutation AdminUpdateSetting($key: String!, $value: JSON!) {
    updateSetting(input: { key: $key, value: $value }) {
      setting {
        key
        value
        isDefault
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

export const FeatureFlagsQuery = graphql(`
  query AdminFeatureFlags {
    featureFlags {
      key
      enabled
      rules
      description
    }
  }
`);

export const SetFeatureFlagMutation = graphql(`
  mutation AdminSetFeatureFlag($input: SetFeatureFlagInput!) {
    setFeatureFlag(input: $input) {
      key
      enabled
      rules
    }
  }
`);

export const AuditLogQuery = graphql(`
  query AdminAuditLog($filter: AuditFilter, $pagination: PaginationInput) {
    auditLog(filter: $filter, pagination: $pagination) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          occurredAt
          action
          entityType
          entityId
          entityNumber
          before
          after
          requestId
          channel
          actor {
            id
            displayName
          }
        }
      }
    }
  }
`);

export const AuditChainCheckQuery = graphql(`
  query AdminAuditChainCheck($day: Date!) {
    auditChainCheck(day: $day) {
      day
      records
      intact
      brokenAt
    }
  }
`);
