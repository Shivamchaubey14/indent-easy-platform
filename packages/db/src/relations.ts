import { relations } from 'drizzle-orm/relations';
import {
  organizationInOrg,
  regionInOrg,
  roleInIdentity,
  userRoleInIdentity,
  appUserInIdentity,
  sessionInIdentity,
  refreshTokenInIdentity,
  mfaFactorInIdentity,
  passwordResetTokenInIdentity,
  apiClientInIdentity,
  departmentInOrg,
  employeeInOrg,
  uomInCatalog,
  uomConversionInCatalog,
  productInCatalog,
  productCategoryInCatalog,
  externalSystemInCatalog,
  vendorInCatalog,
  vendorContactInCatalog,
  productExternalCodeInCatalog,
  locationInOrg,
  mppInCatalog,
  workflowDefinitionInWorkflow,
  workflowVersionInWorkflow,
  workflowInstanceInWorkflow,
  approvalGroupInWorkflow,
  approvalActionInWorkflow,
  approvalTaskInWorkflow,
  indentInIndent,
  indentLineInIndent,
  purchaseRequestLineInProcurement,
  purchaseRequestInProcurement,
  documentInDocs,
  quotationInProcurement,
  rfqInProcurement,
  quotationLineInProcurement,
  purchaseOrderInProcurement,
  purchaseOrderLineInProcurement,
  sapPoLineInProcurement,
  documentVersionInDocs,
  grnInReceiving,
  grnLineInReceiving,
  documentTypeInDocs,
  warehouseInOrg,
  inspectionInReceiving,
  transferOrderLineInLogistics,
  transferOrderInLogistics,
  stnReceiptInLogistics,
  stnReceiptLineInLogistics,
  stnLineInLogistics,
  stnInLogistics,
  stockAdjustmentInInventory,
  stockAdjustmentLineInInventory,
  advanceSaleLineInMpp,
  advanceSaleInMpp,
  generalSaleInMpp,
  generalSaleLineInMpp,
  reconciliationRecordInRecon,
  reconciliationSheetInRecon,
  paymentCycleInRecon,
  invoiceInFinance,
  invoiceLineInFinance,
  paymentRecordInFinance,
  matchResultInFinance,
  grnVerificationInFinance,
  notificationInNotify,
  pushDeviceInNotify,
  importBatchInIo,
  importErrorInIo,
  importRowAuditInIo,
  savedFilterInIo,
  stockStatementEntryInReporting,
  stockStatementInReporting,
  mppSaleRowInReporting,
  exportJobInIo,
  delegationInWorkflow,
  stockStatementCellAuditInReporting,
  otherSaleInMpp,
  otherSaleLineInMpp,
  designationInOrg,
  numberSeriesInConfig,
  holidayInConfig,
  transitDiscrepancyInLogistics,
  batchInInventory,
  stockCountInInventory,
  cycleMonthInRecon,
  podInMpp,
  notificationTemplateInNotify,
  notificationRuleInNotify,
  userLocationInIdentity,
  permissionInIdentity,
  rolePermissionInIdentity,
  regionMemberInOrg,
  poLineAllocationInProcurement,
  grnLineSerialInReceiving,
  saleProductAliasInReporting,
  notificationPreferenceInNotify,
  documentLinkInDocs,
  physicalCountInInventory,
  vendorProductInCatalog,
  stockCountLineInInventory,
  statementLocationStateInReporting,
  featureFlagInConfig,
  reportProductInReporting,
  locationNotificationInRecon,
  settingInConfig,
  cycleProductSummaryInRecon,
  saleEntryInRecon,
  mppProductLedgerInRecon,
  stockBalanceInInventory,
} from './schema.js';

export const regionInOrgRelations = relations(regionInOrg, ({ one, many }) => ({
  organizationInOrg: one(organizationInOrg, {
    fields: [regionInOrg.organizationId],
    references: [organizationInOrg.id],
  }),
  locationInOrgs: many(locationInOrg),
  regionMemberInOrgs: many(regionMemberInOrg),
}));

export const organizationInOrgRelations = relations(organizationInOrg, ({ many }) => ({
  regionInOrgs: many(regionInOrg),
  roleInIdentities: many(roleInIdentity),
  apiClientInIdentities: many(apiClientInIdentity),
  employeeInOrgs: many(employeeInOrg),
  productInCatalogs: many(productInCatalog),
  externalSystemInCatalogs: many(externalSystemInCatalog),
  productExternalCodeInCatalogs: many(productExternalCodeInCatalog),
  vendorInCatalogs: many(vendorInCatalog),
  mppInCatalogs: many(mppInCatalog),
  indentLineInIndents: many(indentLineInIndent),
  workflowDefinitionInWorkflows: many(workflowDefinitionInWorkflow),
  purchaseRequestInProcurements: many(purchaseRequestInProcurement),
  rfqInProcurements: many(rfqInProcurement),
  documentTypeInDocs: many(documentTypeInDocs),
  documentInDocs: many(documentInDocs),
  grnInReceivings: many(grnInReceiving),
  transferOrderInLogistics: many(transferOrderInLogistics),
  stnInLogistics: many(stnInLogistics),
  stockAdjustmentInInventories: many(stockAdjustmentInInventory),
  advanceSaleInMpps: many(advanceSaleInMpp),
  invoiceInFinances: many(invoiceInFinance),
  notificationInNotifies: many(notificationInNotify),
  exportJobInIos: many(exportJobInIo),
  approvalTaskInWorkflows: many(approvalTaskInWorkflow),
  delegationInWorkflows: many(delegationInWorkflow),
  sapPoLineInProcurements: many(sapPoLineInProcurement),
  purchaseOrderInProcurements: many(purchaseOrderInProcurement),
  stnReceiptInLogistics: many(stnReceiptInLogistics),
  locationInOrgs: many(locationInOrg),
  warehouseInOrgs: many(warehouseInOrg),
  departmentInOrgs: many(departmentInOrg),
  designationInOrgs: many(designationInOrg),
  appUserInIdentities: many(appUserInIdentity),
  numberSeriesInConfigs: many(numberSeriesInConfig),
  holidayInConfigs: many(holidayInConfig),
  uomInCatalogs: many(uomInCatalog),
  productCategoryInCatalogs: many(productCategoryInCatalog),
  indentInIndents: many(indentInIndent),
  workflowInstanceInWorkflows: many(workflowInstanceInWorkflow),
  transitDiscrepancyInLogistics: many(transitDiscrepancyInLogistics),
  batchInInventories: many(batchInInventory),
  stockCountInInventories: many(stockCountInInventory),
  cycleMonthInRecons: many(cycleMonthInRecon),
  paymentCycleInRecons: many(paymentCycleInRecon),
  generalSaleInMpps: many(generalSaleInMpp),
  podInMpps: many(podInMpp),
  reconciliationSheetInRecons: many(reconciliationSheetInRecon),
  notificationTemplateInNotifies: many(notificationTemplateInNotify),
  notificationRuleInNotifies: many(notificationRuleInNotify),
  importBatchInIos: many(importBatchInIo),
  stockStatementInReportings: many(stockStatementInReporting),
  otherSaleInMpps: many(otherSaleInMpp),
  saleProductAliasInReportings: many(saleProductAliasInReporting),
  physicalCountInInventories: many(physicalCountInInventory),
  featureFlagInConfigs: many(featureFlagInConfig),
  reportProductInReportings: many(reportProductInReporting),
  settingInConfigs: many(settingInConfig),
  saleEntryInRecons: many(saleEntryInRecon),
  mppProductLedgerInRecons: many(mppProductLedgerInRecon),
  stockBalanceInInventories: many(stockBalanceInInventory),
}));

export const roleInIdentityRelations = relations(roleInIdentity, ({ one, many }) => ({
  organizationInOrg: one(organizationInOrg, {
    fields: [roleInIdentity.organizationId],
    references: [organizationInOrg.id],
  }),
  userRoleInIdentities: many(userRoleInIdentity),
  approvalTaskInWorkflows: many(approvalTaskInWorkflow),
  rolePermissionInIdentities: many(rolePermissionInIdentity),
}));

export const userRoleInIdentityRelations = relations(userRoleInIdentity, ({ one }) => ({
  roleInIdentity: one(roleInIdentity, {
    fields: [userRoleInIdentity.roleId],
    references: [roleInIdentity.id],
  }),
  appUserInIdentity: one(appUserInIdentity, {
    fields: [userRoleInIdentity.userId],
    references: [appUserInIdentity.id],
  }),
}));

export const appUserInIdentityRelations = relations(appUserInIdentity, ({ one, many }) => ({
  userRoleInIdentities: many(userRoleInIdentity),
  sessionInIdentities: many(sessionInIdentity),
  mfaFactorInIdentities: many(mfaFactorInIdentity),
  passwordResetTokenInIdentities: many(passwordResetTokenInIdentity),
  employeeInOrgs: many(employeeInOrg),
  productInCatalogs: many(productInCatalog),
  workflowVersionInWorkflows: many(workflowVersionInWorkflow),
  approvalActionInWorkflows_actorId: many(approvalActionInWorkflow, {
    relationName: 'approvalActionInWorkflow_actorId_appUserInIdentity_id',
  }),
  approvalActionInWorkflows_onBehalfOfId: many(approvalActionInWorkflow, {
    relationName: 'approvalActionInWorkflow_onBehalfOfId_appUserInIdentity_id',
  }),
  purchaseRequestInProcurements: many(purchaseRequestInProcurement),
  documentVersionInDocs: many(documentVersionInDocs),
  documentInDocs: many(documentInDocs, {
    relationName: 'documentInDocs_ownerId_appUserInIdentity_id',
  }),
  inspectionInReceivings: many(inspectionInReceiving),
  stockAdjustmentInInventories_approvedBy: many(stockAdjustmentInInventory, {
    relationName: 'stockAdjustmentInInventory_approvedBy_appUserInIdentity_id',
  }),
  stockAdjustmentInInventories_requestedBy: many(stockAdjustmentInInventory, {
    relationName: 'stockAdjustmentInInventory_requestedBy_appUserInIdentity_id',
  }),
  reconciliationRecordInRecons: many(reconciliationRecordInRecon),
  advanceSaleInMpps: many(advanceSaleInMpp),
  paymentRecordInFinances: many(paymentRecordInFinance),
  matchResultInFinances: many(matchResultInFinance),
  grnVerificationInFinances: many(grnVerificationInFinance),
  notificationInNotifies: many(notificationInNotify),
  pushDeviceInNotifies: many(pushDeviceInNotify),
  savedFilterInIos: many(savedFilterInIo),
  exportJobInIos: many(exportJobInIo),
  approvalTaskInWorkflows_actedBy: many(approvalTaskInWorkflow, {
    relationName: 'approvalTaskInWorkflow_actedBy_appUserInIdentity_id',
  }),
  approvalTaskInWorkflows_assigneeUserId: many(approvalTaskInWorkflow, {
    relationName: 'approvalTaskInWorkflow_assigneeUserId_appUserInIdentity_id',
  }),
  approvalTaskInWorkflows_onBehalfOfUserId: many(approvalTaskInWorkflow, {
    relationName: 'approvalTaskInWorkflow_onBehalfOfUserId_appUserInIdentity_id',
  }),
  delegationInWorkflows_delegateId: many(delegationInWorkflow, {
    relationName: 'delegationInWorkflow_delegateId_appUserInIdentity_id',
  }),
  delegationInWorkflows_delegatorId: many(delegationInWorkflow, {
    relationName: 'delegationInWorkflow_delegatorId_appUserInIdentity_id',
  }),
  stockStatementCellAuditInReportings: many(stockStatementCellAuditInReporting),
  stnReceiptInLogistics: many(stnReceiptInLogistics),
  departmentInOrg: one(departmentInOrg, {
    fields: [appUserInIdentity.departmentId],
    references: [departmentInOrg.id],
  }),
  designationInOrg: one(designationInOrg, {
    fields: [appUserInIdentity.designationId],
    references: [designationInOrg.id],
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [appUserInIdentity.organizationId],
    references: [organizationInOrg.id],
  }),
  locationInOrg: one(locationInOrg, {
    fields: [appUserInIdentity.primaryLocationId],
    references: [locationInOrg.id],
  }),
  appUserInIdentity: one(appUserInIdentity, {
    fields: [appUserInIdentity.reportsToId],
    references: [appUserInIdentity.id],
    relationName: 'appUserInIdentity_reportsToId_appUserInIdentity_id',
  }),
  appUserInIdentities: many(appUserInIdentity, {
    relationName: 'appUserInIdentity_reportsToId_appUserInIdentity_id',
  }),
  documentInDoc_sealDocumentId: one(documentInDocs, {
    fields: [appUserInIdentity.sealDocumentId],
    references: [documentInDocs.id],
    relationName: 'appUserInIdentity_sealDocumentId_documentInDocs_id',
  }),
  documentInDoc_signatureDocumentId: one(documentInDocs, {
    fields: [appUserInIdentity.signatureDocumentId],
    references: [documentInDocs.id],
    relationName: 'appUserInIdentity_signatureDocumentId_documentInDocs_id',
  }),
  productCategoryInCatalogs: many(productCategoryInCatalog),
  indentInIndents: many(indentInIndent),
  transitDiscrepancyInLogistics: many(transitDiscrepancyInLogistics),
  cycleMonthInRecons_createdBy: many(cycleMonthInRecon, {
    relationName: 'cycleMonthInRecon_createdBy_appUserInIdentity_id',
  }),
  cycleMonthInRecons_lockedBy: many(cycleMonthInRecon, {
    relationName: 'cycleMonthInRecon_lockedBy_appUserInIdentity_id',
  }),
  generalSaleInMpps: many(generalSaleInMpp),
  podInMpps: many(podInMpp),
  reconciliationSheetInRecons: many(reconciliationSheetInRecon),
  importBatchInIos: many(importBatchInIo),
  stockStatementInReportings_finalizedBy: many(stockStatementInReporting, {
    relationName: 'stockStatementInReporting_finalizedBy_appUserInIdentity_id',
  }),
  stockStatementInReportings_generatedBy: many(stockStatementInReporting, {
    relationName: 'stockStatementInReporting_generatedBy_appUserInIdentity_id',
  }),
  otherSaleInMpps: many(otherSaleInMpp),
  userLocationInIdentities: many(userLocationInIdentity),
  notificationPreferenceInNotifies: many(notificationPreferenceInNotify),
  physicalCountInInventories: many(physicalCountInInventory),
  stockCountLineInInventories: many(stockCountLineInInventory),
  statementLocationStateInReportings: many(statementLocationStateInReporting),
  locationNotificationInRecons: many(locationNotificationInRecon),
}));

export const sessionInIdentityRelations = relations(sessionInIdentity, ({ one, many }) => ({
  appUserInIdentity: one(appUserInIdentity, {
    fields: [sessionInIdentity.userId],
    references: [appUserInIdentity.id],
  }),
  refreshTokenInIdentities: many(refreshTokenInIdentity),
  pushDeviceInNotifies: many(pushDeviceInNotify),
}));

export const refreshTokenInIdentityRelations = relations(
  refreshTokenInIdentity,
  ({ one, many }) => ({
    refreshTokenInIdentity: one(refreshTokenInIdentity, {
      fields: [refreshTokenInIdentity.replacedById],
      references: [refreshTokenInIdentity.id],
      relationName: 'refreshTokenInIdentity_replacedById_refreshTokenInIdentity_id',
    }),
    refreshTokenInIdentities: many(refreshTokenInIdentity, {
      relationName: 'refreshTokenInIdentity_replacedById_refreshTokenInIdentity_id',
    }),
    sessionInIdentity: one(sessionInIdentity, {
      fields: [refreshTokenInIdentity.sessionId],
      references: [sessionInIdentity.id],
    }),
  }),
);

export const mfaFactorInIdentityRelations = relations(mfaFactorInIdentity, ({ one }) => ({
  appUserInIdentity: one(appUserInIdentity, {
    fields: [mfaFactorInIdentity.userId],
    references: [appUserInIdentity.id],
  }),
}));

export const passwordResetTokenInIdentityRelations = relations(
  passwordResetTokenInIdentity,
  ({ one }) => ({
    appUserInIdentity: one(appUserInIdentity, {
      fields: [passwordResetTokenInIdentity.userId],
      references: [appUserInIdentity.id],
    }),
  }),
);

export const apiClientInIdentityRelations = relations(apiClientInIdentity, ({ one }) => ({
  organizationInOrg: one(organizationInOrg, {
    fields: [apiClientInIdentity.organizationId],
    references: [organizationInOrg.id],
  }),
}));

export const employeeInOrgRelations = relations(employeeInOrg, ({ one, many }) => ({
  departmentInOrg: one(departmentInOrg, {
    fields: [employeeInOrg.departmentId],
    references: [departmentInOrg.id],
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [employeeInOrg.organizationId],
    references: [organizationInOrg.id],
  }),
  appUserInIdentity: one(appUserInIdentity, {
    fields: [employeeInOrg.userId],
    references: [appUserInIdentity.id],
  }),
  indentInIndents: many(indentInIndent),
}));

export const departmentInOrgRelations = relations(departmentInOrg, ({ one, many }) => ({
  employeeInOrgs: many(employeeInOrg),
  organizationInOrg: one(organizationInOrg, {
    fields: [departmentInOrg.organizationId],
    references: [organizationInOrg.id],
  }),
  appUserInIdentities: many(appUserInIdentity),
  indentInIndents: many(indentInIndent),
}));

export const uomConversionInCatalogRelations = relations(uomConversionInCatalog, ({ one }) => ({
  uomInCatalog_fromUomId: one(uomInCatalog, {
    fields: [uomConversionInCatalog.fromUomId],
    references: [uomInCatalog.id],
    relationName: 'uomConversionInCatalog_fromUomId_uomInCatalog_id',
  }),
  productInCatalog: one(productInCatalog, {
    fields: [uomConversionInCatalog.productId],
    references: [productInCatalog.id],
  }),
  uomInCatalog_toUomId: one(uomInCatalog, {
    fields: [uomConversionInCatalog.toUomId],
    references: [uomInCatalog.id],
    relationName: 'uomConversionInCatalog_toUomId_uomInCatalog_id',
  }),
}));

export const uomInCatalogRelations = relations(uomInCatalog, ({ one, many }) => ({
  uomConversionInCatalogs_fromUomId: many(uomConversionInCatalog, {
    relationName: 'uomConversionInCatalog_fromUomId_uomInCatalog_id',
  }),
  uomConversionInCatalogs_toUomId: many(uomConversionInCatalog, {
    relationName: 'uomConversionInCatalog_toUomId_uomInCatalog_id',
  }),
  productInCatalogs: many(productInCatalog),
  indentLineInIndents: many(indentLineInIndent),
  purchaseOrderLineInProcurements: many(purchaseOrderLineInProcurement),
  advanceSaleLineInMpps: many(advanceSaleLineInMpp),
  organizationInOrg: one(organizationInOrg, {
    fields: [uomInCatalog.organizationId],
    references: [organizationInOrg.id],
  }),
}));

export const productInCatalogRelations = relations(productInCatalog, ({ one, many }) => ({
  uomConversionInCatalogs: many(uomConversionInCatalog),
  uomInCatalog: one(uomInCatalog, {
    fields: [productInCatalog.baseUomId],
    references: [uomInCatalog.id],
  }),
  productCategoryInCatalog: one(productCategoryInCatalog, {
    fields: [productInCatalog.categoryId],
    references: [productCategoryInCatalog.id],
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [productInCatalog.organizationId],
    references: [organizationInOrg.id],
  }),
  appUserInIdentity: one(appUserInIdentity, {
    fields: [productInCatalog.ownerUserId],
    references: [appUserInIdentity.id],
  }),
  productExternalCodeInCatalogs: many(productExternalCodeInCatalog),
  indentLineInIndents: many(indentLineInIndent),
  purchaseRequestLineInProcurements: many(purchaseRequestLineInProcurement),
  quotationLineInProcurements: many(quotationLineInProcurement),
  purchaseOrderLineInProcurements: many(purchaseOrderLineInProcurement),
  grnLineInReceivings: many(grnLineInReceiving),
  transferOrderLineInLogistics: many(transferOrderLineInLogistics),
  stnLineInLogistics: many(stnLineInLogistics),
  stockAdjustmentLineInInventories: many(stockAdjustmentLineInInventory),
  advanceSaleLineInMpps: many(advanceSaleLineInMpp),
  generalSaleLineInMpps: many(generalSaleLineInMpp),
  reconciliationRecordInRecons: many(reconciliationRecordInRecon),
  invoiceLineInFinances: many(invoiceLineInFinance),
  stockStatementEntryInReportings: many(stockStatementEntryInReporting),
  mppSaleRowInReportings: many(mppSaleRowInReporting),
  sapPoLineInProcurements: many(sapPoLineInProcurement),
  otherSaleLineInMpps: many(otherSaleLineInMpp),
  batchInInventories: many(batchInInventory),
  grnLineSerialInReceivings: many(grnLineSerialInReceiving),
  saleProductAliasInReportings: many(saleProductAliasInReporting),
  physicalCountInInventories: many(physicalCountInInventory),
  vendorProductInCatalogs: many(vendorProductInCatalog),
  stockCountLineInInventories: many(stockCountLineInInventory),
  reportProductInReportings: many(reportProductInReporting),
  cycleProductSummaryInRecons: many(cycleProductSummaryInRecon),
  saleEntryInRecons: many(saleEntryInRecon),
  mppProductLedgerInRecons: many(mppProductLedgerInRecon),
  stockBalanceInInventories: many(stockBalanceInInventory),
}));

export const productCategoryInCatalogRelations = relations(
  productCategoryInCatalog,
  ({ one, many }) => ({
    productInCatalogs: many(productInCatalog),
    organizationInOrg: one(organizationInOrg, {
      fields: [productCategoryInCatalog.organizationId],
      references: [organizationInOrg.id],
    }),
    appUserInIdentity: one(appUserInIdentity, {
      fields: [productCategoryInCatalog.ownerUserId],
      references: [appUserInIdentity.id],
    }),
    productCategoryInCatalog: one(productCategoryInCatalog, {
      fields: [productCategoryInCatalog.parentId],
      references: [productCategoryInCatalog.id],
      relationName: 'productCategoryInCatalog_parentId_productCategoryInCatalog_id',
    }),
    productCategoryInCatalogs: many(productCategoryInCatalog, {
      relationName: 'productCategoryInCatalog_parentId_productCategoryInCatalog_id',
    }),
  }),
);

export const externalSystemInCatalogRelations = relations(
  externalSystemInCatalog,
  ({ one, many }) => ({
    organizationInOrg: one(organizationInOrg, {
      fields: [externalSystemInCatalog.organizationId],
      references: [organizationInOrg.id],
    }),
    productExternalCodeInCatalogs: many(productExternalCodeInCatalog),
  }),
);

export const vendorContactInCatalogRelations = relations(vendorContactInCatalog, ({ one }) => ({
  vendorInCatalog: one(vendorInCatalog, {
    fields: [vendorContactInCatalog.vendorId],
    references: [vendorInCatalog.id],
  }),
}));

export const vendorInCatalogRelations = relations(vendorInCatalog, ({ one, many }) => ({
  vendorContactInCatalogs: many(vendorContactInCatalog),
  organizationInOrg: one(organizationInOrg, {
    fields: [vendorInCatalog.organizationId],
    references: [organizationInOrg.id],
  }),
  quotationInProcurements: many(quotationInProcurement),
  rfqInProcurements: many(rfqInProcurement),
  grnInReceivings: many(grnInReceiving),
  invoiceInFinances: many(invoiceInFinance),
  purchaseOrderInProcurements: many(purchaseOrderInProcurement),
  vendorProductInCatalogs: many(vendorProductInCatalog),
}));

export const productExternalCodeInCatalogRelations = relations(
  productExternalCodeInCatalog,
  ({ one }) => ({
    externalSystemInCatalog: one(externalSystemInCatalog, {
      fields: [productExternalCodeInCatalog.externalSystemId],
      references: [externalSystemInCatalog.id],
    }),
    organizationInOrg: one(organizationInOrg, {
      fields: [productExternalCodeInCatalog.organizationId],
      references: [organizationInOrg.id],
    }),
    productInCatalog: one(productInCatalog, {
      fields: [productExternalCodeInCatalog.productId],
      references: [productInCatalog.id],
    }),
  }),
);

export const mppInCatalogRelations = relations(mppInCatalog, ({ one, many }) => ({
  locationInOrg: one(locationInOrg, {
    fields: [mppInCatalog.bmcLocationId],
    references: [locationInOrg.id],
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [mppInCatalog.organizationId],
    references: [organizationInOrg.id],
  }),
  reconciliationRecordInRecons: many(reconciliationRecordInRecon),
  advanceSaleInMpps: many(advanceSaleInMpp),
  generalSaleInMpps: many(generalSaleInMpp),
  saleEntryInRecons: many(saleEntryInRecon),
  mppProductLedgerInRecons: many(mppProductLedgerInRecon),
}));

export const locationInOrgRelations = relations(locationInOrg, ({ one, many }) => ({
  mppInCatalogs: many(mppInCatalog),
  transferOrderInLogistics_destLocationId: many(transferOrderInLogistics, {
    relationName: 'transferOrderInLogistics_destLocationId_locationInOrg_id',
  }),
  transferOrderInLogistics_sourceLocationId: many(transferOrderInLogistics, {
    relationName: 'transferOrderInLogistics_sourceLocationId_locationInOrg_id',
  }),
  reconciliationRecordInRecons: many(reconciliationRecordInRecon),
  advanceSaleInMpps: many(advanceSaleInMpp),
  stockStatementEntryInReportings: many(stockStatementEntryInReporting),
  mppSaleRowInReportings: many(mppSaleRowInReporting),
  purchaseOrderInProcurements_billToLocationId: many(purchaseOrderInProcurement, {
    relationName: 'purchaseOrderInProcurement_billToLocationId_locationInOrg_id',
  }),
  purchaseOrderInProcurements_shipToLocationId: many(purchaseOrderInProcurement, {
    relationName: 'purchaseOrderInProcurement_shipToLocationId_locationInOrg_id',
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [locationInOrg.organizationId],
    references: [organizationInOrg.id],
  }),
  regionInOrg: one(regionInOrg, {
    fields: [locationInOrg.regionId],
    references: [regionInOrg.id],
  }),
  warehouseInOrgs: many(warehouseInOrg),
  appUserInIdentities: many(appUserInIdentity),
  numberSeriesInConfigs: many(numberSeriesInConfig),
  holidayInConfigs: many(holidayInConfig),
  indentInIndents: many(indentInIndent),
  generalSaleInMpps: many(generalSaleInMpp),
  otherSaleInMpps: many(otherSaleInMpp),
  userLocationInIdentities: many(userLocationInIdentity),
  regionMemberInOrgs: many(regionMemberInOrg),
  physicalCountInInventories: many(physicalCountInInventory),
  statementLocationStateInReportings: many(statementLocationStateInReporting),
  locationNotificationInRecons: many(locationNotificationInRecon),
  saleEntryInRecons: many(saleEntryInRecon),
}));

export const workflowVersionInWorkflowRelations = relations(
  workflowVersionInWorkflow,
  ({ one, many }) => ({
    workflowDefinitionInWorkflow: one(workflowDefinitionInWorkflow, {
      fields: [workflowVersionInWorkflow.definitionId],
      references: [workflowDefinitionInWorkflow.id],
    }),
    appUserInIdentity: one(appUserInIdentity, {
      fields: [workflowVersionInWorkflow.publishedBy],
      references: [appUserInIdentity.id],
    }),
    workflowInstanceInWorkflows: many(workflowInstanceInWorkflow),
  }),
);

export const workflowDefinitionInWorkflowRelations = relations(
  workflowDefinitionInWorkflow,
  ({ one, many }) => ({
    workflowVersionInWorkflows: many(workflowVersionInWorkflow),
    organizationInOrg: one(organizationInOrg, {
      fields: [workflowDefinitionInWorkflow.organizationId],
      references: [organizationInOrg.id],
    }),
  }),
);

export const approvalGroupInWorkflowRelations = relations(
  approvalGroupInWorkflow,
  ({ one, many }) => ({
    workflowInstanceInWorkflow: one(workflowInstanceInWorkflow, {
      fields: [approvalGroupInWorkflow.instanceId],
      references: [workflowInstanceInWorkflow.id],
    }),
    approvalTaskInWorkflows: many(approvalTaskInWorkflow),
  }),
);

export const workflowInstanceInWorkflowRelations = relations(
  workflowInstanceInWorkflow,
  ({ one, many }) => ({
    approvalGroupInWorkflows: many(approvalGroupInWorkflow),
    stockAdjustmentInInventories: many(stockAdjustmentInInventory),
    approvalTaskInWorkflows: many(approvalTaskInWorkflow),
    purchaseOrderInProcurements: many(purchaseOrderInProcurement),
    indentInIndents: many(indentInIndent),
    organizationInOrg: one(organizationInOrg, {
      fields: [workflowInstanceInWorkflow.organizationId],
      references: [organizationInOrg.id],
    }),
    workflowInstanceInWorkflow: one(workflowInstanceInWorkflow, {
      fields: [workflowInstanceInWorkflow.previousInstanceId],
      references: [workflowInstanceInWorkflow.id],
      relationName: 'workflowInstanceInWorkflow_previousInstanceId_workflowInstanceInWorkflow_id',
    }),
    workflowInstanceInWorkflows: many(workflowInstanceInWorkflow, {
      relationName: 'workflowInstanceInWorkflow_previousInstanceId_workflowInstanceInWorkflow_id',
    }),
    workflowVersionInWorkflow: one(workflowVersionInWorkflow, {
      fields: [workflowInstanceInWorkflow.versionId],
      references: [workflowVersionInWorkflow.id],
    }),
  }),
);

export const approvalActionInWorkflowRelations = relations(approvalActionInWorkflow, ({ one }) => ({
  appUserInIdentity_actorId: one(appUserInIdentity, {
    fields: [approvalActionInWorkflow.actorId],
    references: [appUserInIdentity.id],
    relationName: 'approvalActionInWorkflow_actorId_appUserInIdentity_id',
  }),
  appUserInIdentity_onBehalfOfId: one(appUserInIdentity, {
    fields: [approvalActionInWorkflow.onBehalfOfId],
    references: [appUserInIdentity.id],
    relationName: 'approvalActionInWorkflow_onBehalfOfId_appUserInIdentity_id',
  }),
  approvalTaskInWorkflow: one(approvalTaskInWorkflow, {
    fields: [approvalActionInWorkflow.taskId],
    references: [approvalTaskInWorkflow.id],
  }),
}));

export const approvalTaskInWorkflowRelations = relations(
  approvalTaskInWorkflow,
  ({ one, many }) => ({
    approvalActionInWorkflows: many(approvalActionInWorkflow),
    appUserInIdentity_actedBy: one(appUserInIdentity, {
      fields: [approvalTaskInWorkflow.actedBy],
      references: [appUserInIdentity.id],
      relationName: 'approvalTaskInWorkflow_actedBy_appUserInIdentity_id',
    }),
    roleInIdentity: one(roleInIdentity, {
      fields: [approvalTaskInWorkflow.assigneeRoleId],
      references: [roleInIdentity.id],
    }),
    appUserInIdentity_assigneeUserId: one(appUserInIdentity, {
      fields: [approvalTaskInWorkflow.assigneeUserId],
      references: [appUserInIdentity.id],
      relationName: 'approvalTaskInWorkflow_assigneeUserId_appUserInIdentity_id',
    }),
    approvalGroupInWorkflow: one(approvalGroupInWorkflow, {
      fields: [approvalTaskInWorkflow.groupId],
      references: [approvalGroupInWorkflow.id],
    }),
    workflowInstanceInWorkflow: one(workflowInstanceInWorkflow, {
      fields: [approvalTaskInWorkflow.instanceId],
      references: [workflowInstanceInWorkflow.id],
    }),
    appUserInIdentity_onBehalfOfUserId: one(appUserInIdentity, {
      fields: [approvalTaskInWorkflow.onBehalfOfUserId],
      references: [appUserInIdentity.id],
      relationName: 'approvalTaskInWorkflow_onBehalfOfUserId_appUserInIdentity_id',
    }),
    organizationInOrg: one(organizationInOrg, {
      fields: [approvalTaskInWorkflow.organizationId],
      references: [organizationInOrg.id],
    }),
  }),
);

export const indentLineInIndentRelations = relations(indentLineInIndent, ({ one, many }) => ({
  indentInIndent: one(indentInIndent, {
    fields: [indentLineInIndent.indentId],
    references: [indentInIndent.id],
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [indentLineInIndent.organizationId],
    references: [organizationInOrg.id],
  }),
  productInCatalog: one(productInCatalog, {
    fields: [indentLineInIndent.productId],
    references: [productInCatalog.id],
  }),
  uomInCatalog: one(uomInCatalog, {
    fields: [indentLineInIndent.uomId],
    references: [uomInCatalog.id],
  }),
  purchaseRequestLineInProcurements: many(purchaseRequestLineInProcurement),
  transferOrderLineInLogistics: many(transferOrderLineInLogistics),
  poLineAllocationInProcurements: many(poLineAllocationInProcurement),
}));

export const indentInIndentRelations = relations(indentInIndent, ({ one, many }) => ({
  indentLineInIndents: many(indentLineInIndent),
  workflowInstanceInWorkflow: one(workflowInstanceInWorkflow, {
    fields: [indentInIndent.workflowInstanceId],
    references: [workflowInstanceInWorkflow.id],
  }),
  departmentInOrg: one(departmentInOrg, {
    fields: [indentInIndent.departmentId],
    references: [departmentInOrg.id],
  }),
  locationInOrg: one(locationInOrg, {
    fields: [indentInIndent.locationId],
    references: [locationInOrg.id],
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [indentInIndent.organizationId],
    references: [organizationInOrg.id],
  }),
  appUserInIdentity: one(appUserInIdentity, {
    fields: [indentInIndent.requestedByUserId],
    references: [appUserInIdentity.id],
  }),
  employeeInOrg: one(employeeInOrg, {
    fields: [indentInIndent.requestedForEmployeeId],
    references: [employeeInOrg.id],
  }),
}));

export const purchaseRequestLineInProcurementRelations = relations(
  purchaseRequestLineInProcurement,
  ({ one }) => ({
    indentLineInIndent: one(indentLineInIndent, {
      fields: [purchaseRequestLineInProcurement.indentLineId],
      references: [indentLineInIndent.id],
    }),
    purchaseRequestInProcurement: one(purchaseRequestInProcurement, {
      fields: [purchaseRequestLineInProcurement.prId],
      references: [purchaseRequestInProcurement.id],
    }),
    productInCatalog: one(productInCatalog, {
      fields: [purchaseRequestLineInProcurement.productId],
      references: [productInCatalog.id],
    }),
  }),
);

export const purchaseRequestInProcurementRelations = relations(
  purchaseRequestInProcurement,
  ({ one, many }) => ({
    purchaseRequestLineInProcurements: many(purchaseRequestLineInProcurement),
    appUserInIdentity: one(appUserInIdentity, {
      fields: [purchaseRequestInProcurement.createdBy],
      references: [appUserInIdentity.id],
    }),
    organizationInOrg: one(organizationInOrg, {
      fields: [purchaseRequestInProcurement.organizationId],
      references: [organizationInOrg.id],
    }),
    rfqInProcurements: many(rfqInProcurement),
  }),
);

export const quotationInProcurementRelations = relations(
  quotationInProcurement,
  ({ one, many }) => ({
    documentInDoc: one(documentInDocs, {
      fields: [quotationInProcurement.documentId],
      references: [documentInDocs.id],
    }),
    rfqInProcurement: one(rfqInProcurement, {
      fields: [quotationInProcurement.rfqId],
      references: [rfqInProcurement.id],
    }),
    vendorInCatalog: one(vendorInCatalog, {
      fields: [quotationInProcurement.vendorId],
      references: [vendorInCatalog.id],
    }),
    quotationLineInProcurements: many(quotationLineInProcurement),
  }),
);

export const documentInDocsRelations = relations(documentInDocs, ({ one, many }) => ({
  quotationInProcurements: many(quotationInProcurement),
  documentVersionInDocs: many(documentVersionInDocs),
  organizationInOrg: one(organizationInOrg, {
    fields: [documentInDocs.organizationId],
    references: [organizationInOrg.id],
  }),
  appUserInIdentity: one(appUserInIdentity, {
    fields: [documentInDocs.ownerId],
    references: [appUserInIdentity.id],
    relationName: 'documentInDocs_ownerId_appUserInIdentity_id',
  }),
  documentTypeInDoc: one(documentTypeInDocs, {
    fields: [documentInDocs.typeId],
    references: [documentTypeInDocs.id],
  }),
  grnInReceivings: many(grnInReceiving),
  stnInLogistics: many(stnInLogistics),
  advanceSaleInMpps: many(advanceSaleInMpp),
  invoiceInFinances: many(invoiceInFinance),
  exportJobInIos: many(exportJobInIo),
  appUserInIdentities_sealDocumentId: many(appUserInIdentity, {
    relationName: 'appUserInIdentity_sealDocumentId_documentInDocs_id',
  }),
  appUserInIdentities_signatureDocumentId: many(appUserInIdentity, {
    relationName: 'appUserInIdentity_signatureDocumentId_documentInDocs_id',
  }),
  podInMpps: many(podInMpp),
  reconciliationSheetInRecons: many(reconciliationSheetInRecon),
  importBatchInIos_fileDocumentId: many(importBatchInIo, {
    relationName: 'importBatchInIo_fileDocumentId_documentInDocs_id',
  }),
  importBatchInIos_resultDocumentId: many(importBatchInIo, {
    relationName: 'importBatchInIo_resultDocumentId_documentInDocs_id',
  }),
  stockStatementInReportings: many(stockStatementInReporting),
  otherSaleInMpps: many(otherSaleInMpp),
  documentLinkInDocs: many(documentLinkInDocs),
}));

export const rfqInProcurementRelations = relations(rfqInProcurement, ({ one, many }) => ({
  quotationInProcurements: many(quotationInProcurement),
  vendorInCatalog: one(vendorInCatalog, {
    fields: [rfqInProcurement.awardedVendorId],
    references: [vendorInCatalog.id],
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [rfqInProcurement.organizationId],
    references: [organizationInOrg.id],
  }),
  purchaseRequestInProcurement: one(purchaseRequestInProcurement, {
    fields: [rfqInProcurement.prId],
    references: [purchaseRequestInProcurement.id],
  }),
}));

export const quotationLineInProcurementRelations = relations(
  quotationLineInProcurement,
  ({ one }) => ({
    productInCatalog: one(productInCatalog, {
      fields: [quotationLineInProcurement.productId],
      references: [productInCatalog.id],
    }),
    quotationInProcurement: one(quotationInProcurement, {
      fields: [quotationLineInProcurement.quotationId],
      references: [quotationInProcurement.id],
    }),
  }),
);

export const purchaseOrderLineInProcurementRelations = relations(
  purchaseOrderLineInProcurement,
  ({ one, many }) => ({
    purchaseOrderInProcurement: one(purchaseOrderInProcurement, {
      fields: [purchaseOrderLineInProcurement.poId],
      references: [purchaseOrderInProcurement.id],
    }),
    productInCatalog: one(productInCatalog, {
      fields: [purchaseOrderLineInProcurement.productId],
      references: [productInCatalog.id],
    }),
    sapPoLineInProcurement: one(sapPoLineInProcurement, {
      fields: [purchaseOrderLineInProcurement.sapPoLineId],
      references: [sapPoLineInProcurement.id],
    }),
    uomInCatalog: one(uomInCatalog, {
      fields: [purchaseOrderLineInProcurement.uomId],
      references: [uomInCatalog.id],
    }),
    grnLineInReceivings: many(grnLineInReceiving),
    invoiceLineInFinances: many(invoiceLineInFinance),
    matchResultInFinances: many(matchResultInFinance),
    poLineAllocationInProcurements: many(poLineAllocationInProcurement),
  }),
);

export const purchaseOrderInProcurementRelations = relations(
  purchaseOrderInProcurement,
  ({ one, many }) => ({
    purchaseOrderLineInProcurements: many(purchaseOrderLineInProcurement),
    grnInReceivings: many(grnInReceiving),
    invoiceInFinances: many(invoiceInFinance),
    locationInOrg_billToLocationId: one(locationInOrg, {
      fields: [purchaseOrderInProcurement.billToLocationId],
      references: [locationInOrg.id],
      relationName: 'purchaseOrderInProcurement_billToLocationId_locationInOrg_id',
    }),
    organizationInOrg: one(organizationInOrg, {
      fields: [purchaseOrderInProcurement.organizationId],
      references: [organizationInOrg.id],
    }),
    locationInOrg_shipToLocationId: one(locationInOrg, {
      fields: [purchaseOrderInProcurement.shipToLocationId],
      references: [locationInOrg.id],
      relationName: 'purchaseOrderInProcurement_shipToLocationId_locationInOrg_id',
    }),
    vendorInCatalog: one(vendorInCatalog, {
      fields: [purchaseOrderInProcurement.vendorId],
      references: [vendorInCatalog.id],
    }),
    workflowInstanceInWorkflow: one(workflowInstanceInWorkflow, {
      fields: [purchaseOrderInProcurement.workflowInstanceId],
      references: [workflowInstanceInWorkflow.id],
    }),
  }),
);

export const sapPoLineInProcurementRelations = relations(
  sapPoLineInProcurement,
  ({ one, many }) => ({
    purchaseOrderLineInProcurements: many(purchaseOrderLineInProcurement),
    importBatchInIo: one(importBatchInIo, {
      fields: [sapPoLineInProcurement.importBatchId],
      references: [importBatchInIo.id],
    }),
    organizationInOrg: one(organizationInOrg, {
      fields: [sapPoLineInProcurement.organizationId],
      references: [organizationInOrg.id],
    }),
    productInCatalog: one(productInCatalog, {
      fields: [sapPoLineInProcurement.productId],
      references: [productInCatalog.id],
    }),
  }),
);

export const documentVersionInDocsRelations = relations(documentVersionInDocs, ({ one }) => ({
  documentInDoc: one(documentInDocs, {
    fields: [documentVersionInDocs.documentId],
    references: [documentInDocs.id],
  }),
  appUserInIdentity: one(appUserInIdentity, {
    fields: [documentVersionInDocs.uploadedBy],
    references: [appUserInIdentity.id],
  }),
}));

export const grnLineInReceivingRelations = relations(grnLineInReceiving, ({ one, many }) => ({
  grnInReceiving: one(grnInReceiving, {
    fields: [grnLineInReceiving.grnId],
    references: [grnInReceiving.id],
  }),
  purchaseOrderLineInProcurement: one(purchaseOrderLineInProcurement, {
    fields: [grnLineInReceiving.poLineId],
    references: [purchaseOrderLineInProcurement.id],
  }),
  productInCatalog: one(productInCatalog, {
    fields: [grnLineInReceiving.productId],
    references: [productInCatalog.id],
  }),
  grnLineSerialInReceivings: many(grnLineSerialInReceiving),
}));

export const grnInReceivingRelations = relations(grnInReceiving, ({ one, many }) => ({
  grnLineInReceivings: many(grnLineInReceiving),
  organizationInOrg: one(organizationInOrg, {
    fields: [grnInReceiving.organizationId],
    references: [organizationInOrg.id],
  }),
  documentInDoc: one(documentInDocs, {
    fields: [grnInReceiving.pdfDocumentId],
    references: [documentInDocs.id],
  }),
  purchaseOrderInProcurement: one(purchaseOrderInProcurement, {
    fields: [grnInReceiving.poId],
    references: [purchaseOrderInProcurement.id],
  }),
  grnInReceiving: one(grnInReceiving, {
    fields: [grnInReceiving.reversalOfId],
    references: [grnInReceiving.id],
    relationName: 'grnInReceiving_reversalOfId_grnInReceiving_id',
  }),
  grnInReceivings: many(grnInReceiving, {
    relationName: 'grnInReceiving_reversalOfId_grnInReceiving_id',
  }),
  vendorInCatalog: one(vendorInCatalog, {
    fields: [grnInReceiving.vendorId],
    references: [vendorInCatalog.id],
  }),
  warehouseInOrg: one(warehouseInOrg, {
    fields: [grnInReceiving.warehouseId],
    references: [warehouseInOrg.id],
  }),
  inspectionInReceivings: many(inspectionInReceiving),
  grnVerificationInFinances: many(grnVerificationInFinance),
}));

export const documentTypeInDocsRelations = relations(documentTypeInDocs, ({ one, many }) => ({
  organizationInOrg: one(organizationInOrg, {
    fields: [documentTypeInDocs.organizationId],
    references: [organizationInOrg.id],
  }),
  documentInDocs: many(documentInDocs),
}));

export const warehouseInOrgRelations = relations(warehouseInOrg, ({ one, many }) => ({
  grnInReceivings: many(grnInReceiving),
  stnInLogistics_destWarehouseId: many(stnInLogistics, {
    relationName: 'stnInLogistics_destWarehouseId_warehouseInOrg_id',
  }),
  stnInLogistics_sourceWarehouseId: many(stnInLogistics, {
    relationName: 'stnInLogistics_sourceWarehouseId_warehouseInOrg_id',
  }),
  stockAdjustmentInInventories: many(stockAdjustmentInInventory),
  advanceSaleInMpps: many(advanceSaleInMpp),
  stnReceiptInLogistics: many(stnReceiptInLogistics),
  locationInOrg: one(locationInOrg, {
    fields: [warehouseInOrg.locationId],
    references: [locationInOrg.id],
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [warehouseInOrg.organizationId],
    references: [organizationInOrg.id],
  }),
  stockCountInInventories: many(stockCountInInventory),
  otherSaleInMpps: many(otherSaleInMpp),
  stockBalanceInInventories: many(stockBalanceInInventory),
}));

export const inspectionInReceivingRelations = relations(inspectionInReceiving, ({ one }) => ({
  grnInReceiving: one(grnInReceiving, {
    fields: [inspectionInReceiving.grnId],
    references: [grnInReceiving.id],
  }),
  appUserInIdentity: one(appUserInIdentity, {
    fields: [inspectionInReceiving.inspectorId],
    references: [appUserInIdentity.id],
  }),
}));

export const transferOrderLineInLogisticsRelations = relations(
  transferOrderLineInLogistics,
  ({ one, many }) => ({
    indentLineInIndent: one(indentLineInIndent, {
      fields: [transferOrderLineInLogistics.indentLineId],
      references: [indentLineInIndent.id],
    }),
    productInCatalog: one(productInCatalog, {
      fields: [transferOrderLineInLogistics.productId],
      references: [productInCatalog.id],
    }),
    transferOrderInLogistic: one(transferOrderInLogistics, {
      fields: [transferOrderLineInLogistics.transferId],
      references: [transferOrderInLogistics.id],
    }),
    stnLineInLogistics: many(stnLineInLogistics),
  }),
);

export const transferOrderInLogisticsRelations = relations(
  transferOrderInLogistics,
  ({ one, many }) => ({
    transferOrderLineInLogistics: many(transferOrderLineInLogistics),
    locationInOrg_destLocationId: one(locationInOrg, {
      fields: [transferOrderInLogistics.destLocationId],
      references: [locationInOrg.id],
      relationName: 'transferOrderInLogistics_destLocationId_locationInOrg_id',
    }),
    organizationInOrg: one(organizationInOrg, {
      fields: [transferOrderInLogistics.organizationId],
      references: [organizationInOrg.id],
    }),
    locationInOrg_sourceLocationId: one(locationInOrg, {
      fields: [transferOrderInLogistics.sourceLocationId],
      references: [locationInOrg.id],
      relationName: 'transferOrderInLogistics_sourceLocationId_locationInOrg_id',
    }),
    stnInLogistics: many(stnInLogistics),
  }),
);

export const stnReceiptLineInLogisticsRelations = relations(
  stnReceiptLineInLogistics,
  ({ one }) => ({
    stnReceiptInLogistic: one(stnReceiptInLogistics, {
      fields: [stnReceiptLineInLogistics.receiptId],
      references: [stnReceiptInLogistics.id],
    }),
    stnLineInLogistic: one(stnLineInLogistics, {
      fields: [stnReceiptLineInLogistics.stnLineId],
      references: [stnLineInLogistics.id],
    }),
  }),
);

export const stnReceiptInLogisticsRelations = relations(stnReceiptInLogistics, ({ one, many }) => ({
  stnReceiptLineInLogistics: many(stnReceiptLineInLogistics),
  organizationInOrg: one(organizationInOrg, {
    fields: [stnReceiptInLogistics.organizationId],
    references: [organizationInOrg.id],
  }),
  appUserInIdentity: one(appUserInIdentity, {
    fields: [stnReceiptInLogistics.receivedBy],
    references: [appUserInIdentity.id],
  }),
  stnInLogistic: one(stnInLogistics, {
    fields: [stnReceiptInLogistics.stnId],
    references: [stnInLogistics.id],
  }),
  warehouseInOrg: one(warehouseInOrg, {
    fields: [stnReceiptInLogistics.warehouseId],
    references: [warehouseInOrg.id],
  }),
}));

export const stnLineInLogisticsRelations = relations(stnLineInLogistics, ({ one, many }) => ({
  stnReceiptLineInLogistics: many(stnReceiptLineInLogistics),
  productInCatalog: one(productInCatalog, {
    fields: [stnLineInLogistics.productId],
    references: [productInCatalog.id],
  }),
  stnInLogistic: one(stnInLogistics, {
    fields: [stnLineInLogistics.stnId],
    references: [stnInLogistics.id],
  }),
  transferOrderLineInLogistic: one(transferOrderLineInLogistics, {
    fields: [stnLineInLogistics.toLineId],
    references: [transferOrderLineInLogistics.id],
  }),
  transitDiscrepancyInLogistics: many(transitDiscrepancyInLogistics),
}));

export const stnInLogisticsRelations = relations(stnInLogistics, ({ one, many }) => ({
  stnLineInLogistics: many(stnLineInLogistics),
  warehouseInOrg_destWarehouseId: one(warehouseInOrg, {
    fields: [stnInLogistics.destWarehouseId],
    references: [warehouseInOrg.id],
    relationName: 'stnInLogistics_destWarehouseId_warehouseInOrg_id',
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [stnInLogistics.organizationId],
    references: [organizationInOrg.id],
  }),
  documentInDoc: one(documentInDocs, {
    fields: [stnInLogistics.pdfDocumentId],
    references: [documentInDocs.id],
  }),
  warehouseInOrg_sourceWarehouseId: one(warehouseInOrg, {
    fields: [stnInLogistics.sourceWarehouseId],
    references: [warehouseInOrg.id],
    relationName: 'stnInLogistics_sourceWarehouseId_warehouseInOrg_id',
  }),
  transferOrderInLogistic: one(transferOrderInLogistics, {
    fields: [stnInLogistics.transferId],
    references: [transferOrderInLogistics.id],
  }),
  stnReceiptInLogistics: many(stnReceiptInLogistics),
}));

export const stockAdjustmentLineInInventoryRelations = relations(
  stockAdjustmentLineInInventory,
  ({ one }) => ({
    stockAdjustmentInInventory: one(stockAdjustmentInInventory, {
      fields: [stockAdjustmentLineInInventory.adjustmentId],
      references: [stockAdjustmentInInventory.id],
    }),
    productInCatalog: one(productInCatalog, {
      fields: [stockAdjustmentLineInInventory.productId],
      references: [productInCatalog.id],
    }),
  }),
);

export const stockAdjustmentInInventoryRelations = relations(
  stockAdjustmentInInventory,
  ({ one, many }) => ({
    stockAdjustmentLineInInventories: many(stockAdjustmentLineInInventory),
    appUserInIdentity_approvedBy: one(appUserInIdentity, {
      fields: [stockAdjustmentInInventory.approvedBy],
      references: [appUserInIdentity.id],
      relationName: 'stockAdjustmentInInventory_approvedBy_appUserInIdentity_id',
    }),
    organizationInOrg: one(organizationInOrg, {
      fields: [stockAdjustmentInInventory.organizationId],
      references: [organizationInOrg.id],
    }),
    appUserInIdentity_requestedBy: one(appUserInIdentity, {
      fields: [stockAdjustmentInInventory.requestedBy],
      references: [appUserInIdentity.id],
      relationName: 'stockAdjustmentInInventory_requestedBy_appUserInIdentity_id',
    }),
    warehouseInOrg: one(warehouseInOrg, {
      fields: [stockAdjustmentInInventory.warehouseId],
      references: [warehouseInOrg.id],
    }),
    workflowInstanceInWorkflow: one(workflowInstanceInWorkflow, {
      fields: [stockAdjustmentInInventory.workflowInstanceId],
      references: [workflowInstanceInWorkflow.id],
    }),
    stockCountInInventories: many(stockCountInInventory),
  }),
);

export const advanceSaleLineInMppRelations = relations(advanceSaleLineInMpp, ({ one }) => ({
  productInCatalog: one(productInCatalog, {
    fields: [advanceSaleLineInMpp.productId],
    references: [productInCatalog.id],
  }),
  advanceSaleInMpp: one(advanceSaleInMpp, {
    fields: [advanceSaleLineInMpp.saleId],
    references: [advanceSaleInMpp.id],
  }),
  uomInCatalog: one(uomInCatalog, {
    fields: [advanceSaleLineInMpp.uomId],
    references: [uomInCatalog.id],
  }),
}));

export const advanceSaleInMppRelations = relations(advanceSaleInMpp, ({ one, many }) => ({
  advanceSaleLineInMpps: many(advanceSaleLineInMpp),
  appUserInIdentity: one(appUserInIdentity, {
    fields: [advanceSaleInMpp.createdBy],
    references: [appUserInIdentity.id],
  }),
  paymentCycleInRecon: one(paymentCycleInRecon, {
    fields: [advanceSaleInMpp.cycleId],
    references: [paymentCycleInRecon.id],
  }),
  locationInOrg: one(locationInOrg, {
    fields: [advanceSaleInMpp.locationId],
    references: [locationInOrg.id],
  }),
  mppInCatalog: one(mppInCatalog, {
    fields: [advanceSaleInMpp.mppId],
    references: [mppInCatalog.id],
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [advanceSaleInMpp.organizationId],
    references: [organizationInOrg.id],
  }),
  documentInDoc: one(documentInDocs, {
    fields: [advanceSaleInMpp.receiptDocumentId],
    references: [documentInDocs.id],
  }),
  warehouseInOrg: one(warehouseInOrg, {
    fields: [advanceSaleInMpp.warehouseId],
    references: [warehouseInOrg.id],
  }),
}));

export const generalSaleLineInMppRelations = relations(generalSaleLineInMpp, ({ one }) => ({
  generalSaleInMpp: one(generalSaleInMpp, {
    fields: [generalSaleLineInMpp.generalSaleId],
    references: [generalSaleInMpp.id],
  }),
  productInCatalog: one(productInCatalog, {
    fields: [generalSaleLineInMpp.productId],
    references: [productInCatalog.id],
  }),
}));

export const generalSaleInMppRelations = relations(generalSaleInMpp, ({ one, many }) => ({
  generalSaleLineInMpps: many(generalSaleLineInMpp),
  reconciliationRecordInRecon: one(reconciliationRecordInRecon, {
    fields: [generalSaleInMpp.reconciliationRecordId],
    references: [reconciliationRecordInRecon.id],
  }),
  appUserInIdentity: one(appUserInIdentity, {
    fields: [generalSaleInMpp.createdBy],
    references: [appUserInIdentity.id],
  }),
  paymentCycleInRecon: one(paymentCycleInRecon, {
    fields: [generalSaleInMpp.cycleId],
    references: [paymentCycleInRecon.id],
  }),
  locationInOrg: one(locationInOrg, {
    fields: [generalSaleInMpp.locationId],
    references: [locationInOrg.id],
  }),
  mppInCatalog: one(mppInCatalog, {
    fields: [generalSaleInMpp.mppId],
    references: [mppInCatalog.id],
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [generalSaleInMpp.organizationId],
    references: [organizationInOrg.id],
  }),
}));

export const reconciliationRecordInReconRelations = relations(
  reconciliationRecordInRecon,
  ({ one, many }) => ({
    appUserInIdentity: one(appUserInIdentity, {
      fields: [reconciliationRecordInRecon.acknowledgedBy],
      references: [appUserInIdentity.id],
    }),
    locationInOrg: one(locationInOrg, {
      fields: [reconciliationRecordInRecon.locationId],
      references: [locationInOrg.id],
    }),
    mppInCatalog: one(mppInCatalog, {
      fields: [reconciliationRecordInRecon.mppId],
      references: [mppInCatalog.id],
    }),
    productInCatalog: one(productInCatalog, {
      fields: [reconciliationRecordInRecon.productId],
      references: [productInCatalog.id],
    }),
    reconciliationSheetInRecon: one(reconciliationSheetInRecon, {
      fields: [reconciliationRecordInRecon.sheetId],
      references: [reconciliationSheetInRecon.id],
    }),
    generalSaleInMpps: many(generalSaleInMpp),
    mppProductLedgerInRecons: many(mppProductLedgerInRecon),
  }),
);

export const reconciliationSheetInReconRelations = relations(
  reconciliationSheetInRecon,
  ({ one, many }) => ({
    reconciliationRecordInRecons: many(reconciliationRecordInRecon),
    importBatchInIo: one(importBatchInIo, {
      fields: [reconciliationSheetInRecon.importBatchId],
      references: [importBatchInIo.id],
    }),
    paymentCycleInRecon: one(paymentCycleInRecon, {
      fields: [reconciliationSheetInRecon.cycleId],
      references: [paymentCycleInRecon.id],
    }),
    documentInDoc: one(documentInDocs, {
      fields: [reconciliationSheetInRecon.fileDocumentId],
      references: [documentInDocs.id],
    }),
    organizationInOrg: one(organizationInOrg, {
      fields: [reconciliationSheetInRecon.organizationId],
      references: [organizationInOrg.id],
    }),
    reconciliationSheetInRecon: one(reconciliationSheetInRecon, {
      fields: [reconciliationSheetInRecon.supersededById],
      references: [reconciliationSheetInRecon.id],
      relationName: 'reconciliationSheetInRecon_supersededById_reconciliationSheetInRecon_id',
    }),
    reconciliationSheetInRecons: many(reconciliationSheetInRecon, {
      relationName: 'reconciliationSheetInRecon_supersededById_reconciliationSheetInRecon_id',
    }),
    appUserInIdentity: one(appUserInIdentity, {
      fields: [reconciliationSheetInRecon.uploadedBy],
      references: [appUserInIdentity.id],
    }),
    locationNotificationInRecons: many(locationNotificationInRecon),
  }),
);

export const paymentCycleInReconRelations = relations(paymentCycleInRecon, ({ one, many }) => ({
  advanceSaleInMpps: many(advanceSaleInMpp),
  cycleMonthInRecon: one(cycleMonthInRecon, {
    fields: [paymentCycleInRecon.cycleMonthId],
    references: [cycleMonthInRecon.id],
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [paymentCycleInRecon.organizationId],
    references: [organizationInOrg.id],
  }),
  generalSaleInMpps: many(generalSaleInMpp),
  reconciliationSheetInRecons: many(reconciliationSheetInRecon),
  importBatchInIos: many(importBatchInIo),
  stockStatementInReportings: many(stockStatementInReporting),
  cycleProductSummaryInRecons: many(cycleProductSummaryInRecon),
  saleEntryInRecons: many(saleEntryInRecon),
  mppProductLedgerInRecons: many(mppProductLedgerInRecon),
}));

export const invoiceLineInFinanceRelations = relations(invoiceLineInFinance, ({ one, many }) => ({
  invoiceInFinance: one(invoiceInFinance, {
    fields: [invoiceLineInFinance.invoiceId],
    references: [invoiceInFinance.id],
  }),
  purchaseOrderLineInProcurement: one(purchaseOrderLineInProcurement, {
    fields: [invoiceLineInFinance.poLineId],
    references: [purchaseOrderLineInProcurement.id],
  }),
  productInCatalog: one(productInCatalog, {
    fields: [invoiceLineInFinance.productId],
    references: [productInCatalog.id],
  }),
  matchResultInFinances: many(matchResultInFinance),
}));

export const invoiceInFinanceRelations = relations(invoiceInFinance, ({ one, many }) => ({
  invoiceLineInFinances: many(invoiceLineInFinance),
  paymentRecordInFinances: many(paymentRecordInFinance),
  documentInDoc: one(documentInDocs, {
    fields: [invoiceInFinance.documentId],
    references: [documentInDocs.id],
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [invoiceInFinance.organizationId],
    references: [organizationInOrg.id],
  }),
  purchaseOrderInProcurement: one(purchaseOrderInProcurement, {
    fields: [invoiceInFinance.poId],
    references: [purchaseOrderInProcurement.id],
  }),
  vendorInCatalog: one(vendorInCatalog, {
    fields: [invoiceInFinance.vendorId],
    references: [vendorInCatalog.id],
  }),
}));

export const paymentRecordInFinanceRelations = relations(paymentRecordInFinance, ({ one }) => ({
  invoiceInFinance: one(invoiceInFinance, {
    fields: [paymentRecordInFinance.invoiceId],
    references: [invoiceInFinance.id],
  }),
  appUserInIdentity: one(appUserInIdentity, {
    fields: [paymentRecordInFinance.recordedBy],
    references: [appUserInIdentity.id],
  }),
}));

export const matchResultInFinanceRelations = relations(matchResultInFinance, ({ one }) => ({
  invoiceLineInFinance: one(invoiceLineInFinance, {
    fields: [matchResultInFinance.invoiceLineId],
    references: [invoiceLineInFinance.id],
  }),
  purchaseOrderLineInProcurement: one(purchaseOrderLineInProcurement, {
    fields: [matchResultInFinance.poLineId],
    references: [purchaseOrderLineInProcurement.id],
  }),
  appUserInIdentity: one(appUserInIdentity, {
    fields: [matchResultInFinance.resolvedBy],
    references: [appUserInIdentity.id],
  }),
}));

export const grnVerificationInFinanceRelations = relations(grnVerificationInFinance, ({ one }) => ({
  grnInReceiving: one(grnInReceiving, {
    fields: [grnVerificationInFinance.grnId],
    references: [grnInReceiving.id],
  }),
  appUserInIdentity: one(appUserInIdentity, {
    fields: [grnVerificationInFinance.verifiedBy],
    references: [appUserInIdentity.id],
  }),
}));

export const notificationInNotifyRelations = relations(notificationInNotify, ({ one }) => ({
  organizationInOrg: one(organizationInOrg, {
    fields: [notificationInNotify.organizationId],
    references: [organizationInOrg.id],
  }),
  appUserInIdentity: one(appUserInIdentity, {
    fields: [notificationInNotify.userId],
    references: [appUserInIdentity.id],
  }),
}));

export const pushDeviceInNotifyRelations = relations(pushDeviceInNotify, ({ one }) => ({
  sessionInIdentity: one(sessionInIdentity, {
    fields: [pushDeviceInNotify.sessionId],
    references: [sessionInIdentity.id],
  }),
  appUserInIdentity: one(appUserInIdentity, {
    fields: [pushDeviceInNotify.userId],
    references: [appUserInIdentity.id],
  }),
}));

export const importErrorInIoRelations = relations(importErrorInIo, ({ one }) => ({
  importBatchInIo: one(importBatchInIo, {
    fields: [importErrorInIo.batchId],
    references: [importBatchInIo.id],
  }),
}));

export const importBatchInIoRelations = relations(importBatchInIo, ({ one, many }) => ({
  importErrorInIos: many(importErrorInIo),
  importRowAuditInIos: many(importRowAuditInIo),
  sapPoLineInProcurements: many(sapPoLineInProcurement),
  reconciliationSheetInRecons: many(reconciliationSheetInRecon),
  paymentCycleInRecon: one(paymentCycleInRecon, {
    fields: [importBatchInIo.cycleId],
    references: [paymentCycleInRecon.id],
  }),
  documentInDoc_fileDocumentId: one(documentInDocs, {
    fields: [importBatchInIo.fileDocumentId],
    references: [documentInDocs.id],
    relationName: 'importBatchInIo_fileDocumentId_documentInDocs_id',
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [importBatchInIo.organizationId],
    references: [organizationInOrg.id],
  }),
  documentInDoc_resultDocumentId: one(documentInDocs, {
    fields: [importBatchInIo.resultDocumentId],
    references: [documentInDocs.id],
    relationName: 'importBatchInIo_resultDocumentId_documentInDocs_id',
  }),
  appUserInIdentity: one(appUserInIdentity, {
    fields: [importBatchInIo.uploadedBy],
    references: [appUserInIdentity.id],
  }),
}));

export const importRowAuditInIoRelations = relations(importRowAuditInIo, ({ one }) => ({
  importBatchInIo: one(importBatchInIo, {
    fields: [importRowAuditInIo.batchId],
    references: [importBatchInIo.id],
  }),
}));

export const savedFilterInIoRelations = relations(savedFilterInIo, ({ one }) => ({
  appUserInIdentity: one(appUserInIdentity, {
    fields: [savedFilterInIo.userId],
    references: [appUserInIdentity.id],
  }),
}));

export const stockStatementEntryInReportingRelations = relations(
  stockStatementEntryInReporting,
  ({ one, many }) => ({
    locationInOrg: one(locationInOrg, {
      fields: [stockStatementEntryInReporting.locationId],
      references: [locationInOrg.id],
    }),
    productInCatalog: one(productInCatalog, {
      fields: [stockStatementEntryInReporting.productId],
      references: [productInCatalog.id],
    }),
    stockStatementInReporting: one(stockStatementInReporting, {
      fields: [stockStatementEntryInReporting.statementId],
      references: [stockStatementInReporting.id],
    }),
    stockStatementCellAuditInReportings: many(stockStatementCellAuditInReporting),
  }),
);

export const stockStatementInReportingRelations = relations(
  stockStatementInReporting,
  ({ one, many }) => ({
    stockStatementEntryInReportings: many(stockStatementEntryInReporting),
    mppSaleRowInReportings: many(mppSaleRowInReporting),
    paymentCycleInRecon: one(paymentCycleInRecon, {
      fields: [stockStatementInReporting.cycleId],
      references: [paymentCycleInRecon.id],
    }),
    appUserInIdentity_finalizedBy: one(appUserInIdentity, {
      fields: [stockStatementInReporting.finalizedBy],
      references: [appUserInIdentity.id],
      relationName: 'stockStatementInReporting_finalizedBy_appUserInIdentity_id',
    }),
    appUserInIdentity_generatedBy: one(appUserInIdentity, {
      fields: [stockStatementInReporting.generatedBy],
      references: [appUserInIdentity.id],
      relationName: 'stockStatementInReporting_generatedBy_appUserInIdentity_id',
    }),
    organizationInOrg: one(organizationInOrg, {
      fields: [stockStatementInReporting.organizationId],
      references: [organizationInOrg.id],
    }),
    documentInDoc: one(documentInDocs, {
      fields: [stockStatementInReporting.saleDocumentId],
      references: [documentInDocs.id],
    }),
    statementLocationStateInReportings: many(statementLocationStateInReporting),
  }),
);

export const mppSaleRowInReportingRelations = relations(mppSaleRowInReporting, ({ one }) => ({
  locationInOrg: one(locationInOrg, {
    fields: [mppSaleRowInReporting.locationId],
    references: [locationInOrg.id],
  }),
  productInCatalog: one(productInCatalog, {
    fields: [mppSaleRowInReporting.productId],
    references: [productInCatalog.id],
  }),
  stockStatementInReporting: one(stockStatementInReporting, {
    fields: [mppSaleRowInReporting.statementId],
    references: [stockStatementInReporting.id],
  }),
}));

export const exportJobInIoRelations = relations(exportJobInIo, ({ one }) => ({
  documentInDoc: one(documentInDocs, {
    fields: [exportJobInIo.documentId],
    references: [documentInDocs.id],
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [exportJobInIo.organizationId],
    references: [organizationInOrg.id],
  }),
  appUserInIdentity: one(appUserInIdentity, {
    fields: [exportJobInIo.requestedBy],
    references: [appUserInIdentity.id],
  }),
}));

export const delegationInWorkflowRelations = relations(delegationInWorkflow, ({ one }) => ({
  appUserInIdentity_delegateId: one(appUserInIdentity, {
    fields: [delegationInWorkflow.delegateId],
    references: [appUserInIdentity.id],
    relationName: 'delegationInWorkflow_delegateId_appUserInIdentity_id',
  }),
  appUserInIdentity_delegatorId: one(appUserInIdentity, {
    fields: [delegationInWorkflow.delegatorId],
    references: [appUserInIdentity.id],
    relationName: 'delegationInWorkflow_delegatorId_appUserInIdentity_id',
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [delegationInWorkflow.organizationId],
    references: [organizationInOrg.id],
  }),
}));

export const stockStatementCellAuditInReportingRelations = relations(
  stockStatementCellAuditInReporting,
  ({ one }) => ({
    appUserInIdentity: one(appUserInIdentity, {
      fields: [stockStatementCellAuditInReporting.changedBy],
      references: [appUserInIdentity.id],
    }),
    stockStatementEntryInReporting: one(stockStatementEntryInReporting, {
      fields: [stockStatementCellAuditInReporting.entryId],
      references: [stockStatementEntryInReporting.id],
    }),
  }),
);

export const otherSaleLineInMppRelations = relations(otherSaleLineInMpp, ({ one }) => ({
  otherSaleInMpp: one(otherSaleInMpp, {
    fields: [otherSaleLineInMpp.otherSaleId],
    references: [otherSaleInMpp.id],
  }),
  productInCatalog: one(productInCatalog, {
    fields: [otherSaleLineInMpp.productId],
    references: [productInCatalog.id],
  }),
}));

export const otherSaleInMppRelations = relations(otherSaleInMpp, ({ one, many }) => ({
  otherSaleLineInMpps: many(otherSaleLineInMpp),
  appUserInIdentity: one(appUserInIdentity, {
    fields: [otherSaleInMpp.createdBy],
    references: [appUserInIdentity.id],
  }),
  documentInDoc: one(documentInDocs, {
    fields: [otherSaleInMpp.invoiceDocumentId],
    references: [documentInDocs.id],
  }),
  locationInOrg: one(locationInOrg, {
    fields: [otherSaleInMpp.locationId],
    references: [locationInOrg.id],
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [otherSaleInMpp.organizationId],
    references: [organizationInOrg.id],
  }),
  warehouseInOrg: one(warehouseInOrg, {
    fields: [otherSaleInMpp.warehouseId],
    references: [warehouseInOrg.id],
  }),
}));

export const designationInOrgRelations = relations(designationInOrg, ({ one, many }) => ({
  organizationInOrg: one(organizationInOrg, {
    fields: [designationInOrg.organizationId],
    references: [organizationInOrg.id],
  }),
  appUserInIdentities: many(appUserInIdentity),
}));

export const numberSeriesInConfigRelations = relations(numberSeriesInConfig, ({ one }) => ({
  locationInOrg: one(locationInOrg, {
    fields: [numberSeriesInConfig.locationId],
    references: [locationInOrg.id],
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [numberSeriesInConfig.organizationId],
    references: [organizationInOrg.id],
  }),
}));

export const holidayInConfigRelations = relations(holidayInConfig, ({ one }) => ({
  locationInOrg: one(locationInOrg, {
    fields: [holidayInConfig.locationId],
    references: [locationInOrg.id],
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [holidayInConfig.organizationId],
    references: [organizationInOrg.id],
  }),
}));

export const transitDiscrepancyInLogisticsRelations = relations(
  transitDiscrepancyInLogistics,
  ({ one }) => ({
    organizationInOrg: one(organizationInOrg, {
      fields: [transitDiscrepancyInLogistics.organizationId],
      references: [organizationInOrg.id],
    }),
    appUserInIdentity: one(appUserInIdentity, {
      fields: [transitDiscrepancyInLogistics.resolvedBy],
      references: [appUserInIdentity.id],
    }),
    stnLineInLogistic: one(stnLineInLogistics, {
      fields: [transitDiscrepancyInLogistics.stnLineId],
      references: [stnLineInLogistics.id],
    }),
  }),
);

export const batchInInventoryRelations = relations(batchInInventory, ({ one }) => ({
  organizationInOrg: one(organizationInOrg, {
    fields: [batchInInventory.organizationId],
    references: [organizationInOrg.id],
  }),
  productInCatalog: one(productInCatalog, {
    fields: [batchInInventory.productId],
    references: [productInCatalog.id],
  }),
}));

export const stockCountInInventoryRelations = relations(stockCountInInventory, ({ one, many }) => ({
  stockAdjustmentInInventory: one(stockAdjustmentInInventory, {
    fields: [stockCountInInventory.adjustmentId],
    references: [stockAdjustmentInInventory.id],
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [stockCountInInventory.organizationId],
    references: [organizationInOrg.id],
  }),
  warehouseInOrg: one(warehouseInOrg, {
    fields: [stockCountInInventory.warehouseId],
    references: [warehouseInOrg.id],
  }),
  stockCountLineInInventories: many(stockCountLineInInventory),
}));

export const cycleMonthInReconRelations = relations(cycleMonthInRecon, ({ one, many }) => ({
  appUserInIdentity_createdBy: one(appUserInIdentity, {
    fields: [cycleMonthInRecon.createdBy],
    references: [appUserInIdentity.id],
    relationName: 'cycleMonthInRecon_createdBy_appUserInIdentity_id',
  }),
  appUserInIdentity_lockedBy: one(appUserInIdentity, {
    fields: [cycleMonthInRecon.lockedBy],
    references: [appUserInIdentity.id],
    relationName: 'cycleMonthInRecon_lockedBy_appUserInIdentity_id',
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [cycleMonthInRecon.organizationId],
    references: [organizationInOrg.id],
  }),
  paymentCycleInRecons: many(paymentCycleInRecon),
}));

export const podInMppRelations = relations(podInMpp, ({ one }) => ({
  documentInDoc: one(documentInDocs, {
    fields: [podInMpp.documentId],
    references: [documentInDocs.id],
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [podInMpp.organizationId],
    references: [organizationInOrg.id],
  }),
  appUserInIdentity: one(appUserInIdentity, {
    fields: [podInMpp.uploadedBy],
    references: [appUserInIdentity.id],
  }),
}));

export const notificationTemplateInNotifyRelations = relations(
  notificationTemplateInNotify,
  ({ one }) => ({
    organizationInOrg: one(organizationInOrg, {
      fields: [notificationTemplateInNotify.organizationId],
      references: [organizationInOrg.id],
    }),
  }),
);

export const notificationRuleInNotifyRelations = relations(notificationRuleInNotify, ({ one }) => ({
  organizationInOrg: one(organizationInOrg, {
    fields: [notificationRuleInNotify.organizationId],
    references: [organizationInOrg.id],
  }),
}));

export const userLocationInIdentityRelations = relations(userLocationInIdentity, ({ one }) => ({
  locationInOrg: one(locationInOrg, {
    fields: [userLocationInIdentity.locationId],
    references: [locationInOrg.id],
  }),
  appUserInIdentity: one(appUserInIdentity, {
    fields: [userLocationInIdentity.userId],
    references: [appUserInIdentity.id],
  }),
}));

export const rolePermissionInIdentityRelations = relations(rolePermissionInIdentity, ({ one }) => ({
  permissionInIdentity: one(permissionInIdentity, {
    fields: [rolePermissionInIdentity.permissionCode],
    references: [permissionInIdentity.code],
  }),
  roleInIdentity: one(roleInIdentity, {
    fields: [rolePermissionInIdentity.roleId],
    references: [roleInIdentity.id],
  }),
}));

export const permissionInIdentityRelations = relations(permissionInIdentity, ({ many }) => ({
  rolePermissionInIdentities: many(rolePermissionInIdentity),
}));

export const regionMemberInOrgRelations = relations(regionMemberInOrg, ({ one }) => ({
  locationInOrg: one(locationInOrg, {
    fields: [regionMemberInOrg.locationId],
    references: [locationInOrg.id],
  }),
  regionInOrg: one(regionInOrg, {
    fields: [regionMemberInOrg.regionId],
    references: [regionInOrg.id],
  }),
}));

export const poLineAllocationInProcurementRelations = relations(
  poLineAllocationInProcurement,
  ({ one }) => ({
    indentLineInIndent: one(indentLineInIndent, {
      fields: [poLineAllocationInProcurement.indentLineId],
      references: [indentLineInIndent.id],
    }),
    purchaseOrderLineInProcurement: one(purchaseOrderLineInProcurement, {
      fields: [poLineAllocationInProcurement.poLineId],
      references: [purchaseOrderLineInProcurement.id],
    }),
  }),
);

export const grnLineSerialInReceivingRelations = relations(grnLineSerialInReceiving, ({ one }) => ({
  grnLineInReceiving: one(grnLineInReceiving, {
    fields: [grnLineSerialInReceiving.grnLineId],
    references: [grnLineInReceiving.id],
  }),
  productInCatalog: one(productInCatalog, {
    fields: [grnLineSerialInReceiving.productId],
    references: [productInCatalog.id],
  }),
}));

export const saleProductAliasInReportingRelations = relations(
  saleProductAliasInReporting,
  ({ one }) => ({
    organizationInOrg: one(organizationInOrg, {
      fields: [saleProductAliasInReporting.organizationId],
      references: [organizationInOrg.id],
    }),
    productInCatalog: one(productInCatalog, {
      fields: [saleProductAliasInReporting.productId],
      references: [productInCatalog.id],
    }),
  }),
);

export const notificationPreferenceInNotifyRelations = relations(
  notificationPreferenceInNotify,
  ({ one }) => ({
    appUserInIdentity: one(appUserInIdentity, {
      fields: [notificationPreferenceInNotify.userId],
      references: [appUserInIdentity.id],
    }),
  }),
);

export const documentLinkInDocsRelations = relations(documentLinkInDocs, ({ one }) => ({
  documentInDoc: one(documentInDocs, {
    fields: [documentLinkInDocs.documentId],
    references: [documentInDocs.id],
  }),
}));

export const physicalCountInInventoryRelations = relations(physicalCountInInventory, ({ one }) => ({
  appUserInIdentity: one(appUserInIdentity, {
    fields: [physicalCountInInventory.countedBy],
    references: [appUserInIdentity.id],
  }),
  locationInOrg: one(locationInOrg, {
    fields: [physicalCountInInventory.locationId],
    references: [locationInOrg.id],
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [physicalCountInInventory.organizationId],
    references: [organizationInOrg.id],
  }),
  productInCatalog: one(productInCatalog, {
    fields: [physicalCountInInventory.productId],
    references: [productInCatalog.id],
  }),
}));

export const vendorProductInCatalogRelations = relations(vendorProductInCatalog, ({ one }) => ({
  productInCatalog: one(productInCatalog, {
    fields: [vendorProductInCatalog.productId],
    references: [productInCatalog.id],
  }),
  vendorInCatalog: one(vendorInCatalog, {
    fields: [vendorProductInCatalog.vendorId],
    references: [vendorInCatalog.id],
  }),
}));

export const stockCountLineInInventoryRelations = relations(
  stockCountLineInInventory,
  ({ one }) => ({
    stockCountInInventory: one(stockCountInInventory, {
      fields: [stockCountLineInInventory.countId],
      references: [stockCountInInventory.id],
    }),
    appUserInIdentity: one(appUserInIdentity, {
      fields: [stockCountLineInInventory.countedBy],
      references: [appUserInIdentity.id],
    }),
    productInCatalog: one(productInCatalog, {
      fields: [stockCountLineInInventory.productId],
      references: [productInCatalog.id],
    }),
  }),
);

export const statementLocationStateInReportingRelations = relations(
  statementLocationStateInReporting,
  ({ one }) => ({
    locationInOrg: one(locationInOrg, {
      fields: [statementLocationStateInReporting.locationId],
      references: [locationInOrg.id],
    }),
    stockStatementInReporting: one(stockStatementInReporting, {
      fields: [statementLocationStateInReporting.statementId],
      references: [stockStatementInReporting.id],
    }),
    appUserInIdentity: one(appUserInIdentity, {
      fields: [statementLocationStateInReporting.updatedBy],
      references: [appUserInIdentity.id],
    }),
  }),
);

export const featureFlagInConfigRelations = relations(featureFlagInConfig, ({ one }) => ({
  organizationInOrg: one(organizationInOrg, {
    fields: [featureFlagInConfig.organizationId],
    references: [organizationInOrg.id],
  }),
}));

export const reportProductInReportingRelations = relations(reportProductInReporting, ({ one }) => ({
  organizationInOrg: one(organizationInOrg, {
    fields: [reportProductInReporting.organizationId],
    references: [organizationInOrg.id],
  }),
  productInCatalog: one(productInCatalog, {
    fields: [reportProductInReporting.productId],
    references: [productInCatalog.id],
  }),
}));

export const locationNotificationInReconRelations = relations(
  locationNotificationInRecon,
  ({ one }) => ({
    appUserInIdentity: one(appUserInIdentity, {
      fields: [locationNotificationInRecon.acknowledgedBy],
      references: [appUserInIdentity.id],
    }),
    locationInOrg: one(locationInOrg, {
      fields: [locationNotificationInRecon.locationId],
      references: [locationInOrg.id],
    }),
    reconciliationSheetInRecon: one(reconciliationSheetInRecon, {
      fields: [locationNotificationInRecon.sheetId],
      references: [reconciliationSheetInRecon.id],
    }),
  }),
);

export const settingInConfigRelations = relations(settingInConfig, ({ one }) => ({
  organizationInOrg: one(organizationInOrg, {
    fields: [settingInConfig.organizationId],
    references: [organizationInOrg.id],
  }),
}));

export const cycleProductSummaryInReconRelations = relations(
  cycleProductSummaryInRecon,
  ({ one }) => ({
    paymentCycleInRecon: one(paymentCycleInRecon, {
      fields: [cycleProductSummaryInRecon.cycleId],
      references: [paymentCycleInRecon.id],
    }),
    productInCatalog: one(productInCatalog, {
      fields: [cycleProductSummaryInRecon.productId],
      references: [productInCatalog.id],
    }),
  }),
);

export const saleEntryInReconRelations = relations(saleEntryInRecon, ({ one }) => ({
  paymentCycleInRecon: one(paymentCycleInRecon, {
    fields: [saleEntryInRecon.cycleId],
    references: [paymentCycleInRecon.id],
  }),
  locationInOrg: one(locationInOrg, {
    fields: [saleEntryInRecon.locationId],
    references: [locationInOrg.id],
  }),
  mppInCatalog: one(mppInCatalog, {
    fields: [saleEntryInRecon.mppId],
    references: [mppInCatalog.id],
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [saleEntryInRecon.organizationId],
    references: [organizationInOrg.id],
  }),
  productInCatalog: one(productInCatalog, {
    fields: [saleEntryInRecon.productId],
    references: [productInCatalog.id],
  }),
}));

export const mppProductLedgerInReconRelations = relations(mppProductLedgerInRecon, ({ one }) => ({
  paymentCycleInRecon: one(paymentCycleInRecon, {
    fields: [mppProductLedgerInRecon.cycleId],
    references: [paymentCycleInRecon.id],
  }),
  mppInCatalog: one(mppInCatalog, {
    fields: [mppProductLedgerInRecon.mppId],
    references: [mppInCatalog.id],
  }),
  organizationInOrg: one(organizationInOrg, {
    fields: [mppProductLedgerInRecon.organizationId],
    references: [organizationInOrg.id],
  }),
  productInCatalog: one(productInCatalog, {
    fields: [mppProductLedgerInRecon.productId],
    references: [productInCatalog.id],
  }),
  reconciliationRecordInRecon: one(reconciliationRecordInRecon, {
    fields: [mppProductLedgerInRecon.sourceRecordId],
    references: [reconciliationRecordInRecon.id],
  }),
}));

export const stockBalanceInInventoryRelations = relations(stockBalanceInInventory, ({ one }) => ({
  organizationInOrg: one(organizationInOrg, {
    fields: [stockBalanceInInventory.organizationId],
    references: [organizationInOrg.id],
  }),
  productInCatalog: one(productInCatalog, {
    fields: [stockBalanceInInventory.productId],
    references: [productInCatalog.id],
  }),
  warehouseInOrg: one(warehouseInOrg, {
    fields: [stockBalanceInInventory.warehouseId],
    references: [warehouseInOrg.id],
  }),
}));
