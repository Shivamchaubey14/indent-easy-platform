/* Generated from schema/event-contracts.schema.json by `pnpm codegen`. Do not edit. */
export type Decimal = string;

export interface Envelope {
  eventId: string;
  eventType:
    | 'AdvanceSaleCancelled'
    | 'AdvanceSaleCreated'
    | 'ApprovalEscalated'
    | 'ApprovalTaskActed'
    | 'ApprovalTaskCreated'
    | 'CycleActivated'
    | 'DocumentAvailable'
    | 'GeneralSaleCreated'
    | 'GrnExcessDetected'
    | 'GrnPosted'
    | 'GrnReversed'
    | 'ImportCompleted'
    | 'IndentApproved'
    | 'IndentApprovedForTransfer'
    | 'IndentCancelled'
    | 'IndentCreated'
    | 'IndentLineStatusChanged'
    | 'IndentRejected'
    | 'IndentReturned'
    | 'IndentSubmitted'
    | 'InventoryAdjusted'
    | 'InventoryUpdated'
    | 'InvoiceExceptionRaised'
    | 'InvoiceVerified'
    | 'NotificationCreated'
    | 'NotificationDeliveryUpdated'
    | 'PodUploaded'
    | 'PurchaseOrderApproved'
    | 'PurchaseOrderCancelled'
    | 'PurchaseOrderCreated'
    | 'PurchaseOrderSendRequested'
    | 'PurchaseOrderSent'
    | 'ReconciliationCompleted'
    | 'ReconciliationPublished'
    | 'StnCreated'
    | 'StnDispatched'
    | 'StnReceived'
    | 'StockBelowReorderLevel'
    | 'TransferOrderCreated'
    | 'TransitDiscrepancyOpened'
    | 'TransitDiscrepancyResolved'
    | 'UserRoleChanged';
  eventVersion: number;
  occurredAt: string;
  organizationId: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  actor: {
    type: 'USER' | 'SYSTEM' | 'INTEGRATION';
    id?: string | null;
    onBehalfOfId?: string | null;
    [k: string]: unknown | undefined;
  };
  correlationId: string;
  causationId?: string | null;
  requestId?: string | null;
  traceId?: string | null;
  channel?: 'WEB' | 'MOBILE' | 'MOBILE_OFFLINE' | 'API' | 'SYSTEM' | 'IMPORT';
  payload: {};
}
export interface Money {
  amount: string;
  currency: 'INR';
}
export interface IndentCreatedPayload {
  locationId: string;
  lineCount: number;
  estimatedTotal?: {
    amount: string;
    currency: 'INR';
  };
  [k: string]: unknown | undefined;
}
export interface IndentSubmittedPayload {
  indentNumber: string;
  locationId: string;
  departmentId?: string | null;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  estimatedTotal?: {
    amount: string;
    currency: 'INR';
  };
  workflowInstanceId: string;
  lines: {
    lineId: string;
    productId: string;
    quantityBase: string;
    uomCode?: string;
    estimatedAmount?: {
      amount: string;
      currency: 'INR';
    };
    [k: string]: unknown | undefined;
  }[];
  [k: string]: unknown | undefined;
}
export interface IndentReturnedPayload {
  taskId: string;
  remark: string;
  returnedBy?: string;
  [k: string]: unknown | undefined;
}
export interface IndentApprovedPayload {
  lineIds: string[];
  approvedQuantityByLine?: {
    [k: string]: string | undefined;
  };
  approverId: string;
  onBehalfOfId?: string | null;
  [k: string]: unknown | undefined;
}
export interface IndentApprovedForTransferPayload {
  lineIds: string[];
  transferOrderIds: string[];
  [k: string]: unknown | undefined;
}
export interface IndentRejectedPayload {
  lineIds: string[];
  reason: string;
  [k: string]: unknown | undefined;
}
export interface IndentCancelledPayload {
  lineIds: string[];
  reason: string;
  [k: string]: unknown | undefined;
}
export interface IndentLineStatusChangedPayload {
  lineId: string;
  from: string;
  to: string;
  [k: string]: unknown | undefined;
}
export interface ApprovalTaskCreatedPayload {
  taskId: string;
  subjectType: string;
  subjectId: string;
  assigneeUserId?: string | null;
  assigneeRoleId?: string | null;
  dueAt?: string | null;
  [k: string]: unknown | undefined;
}
export interface ApprovalTaskActedPayload {
  taskId: string;
  action: 'APPROVE' | 'APPROVE_FOR_TRANSFER' | 'REJECT' | 'RETURN';
  actorId: string;
  remark?: string | null;
  [k: string]: unknown | undefined;
}
export interface ApprovalEscalatedPayload {
  taskId: string;
  fromAssignee?: string | null;
  toAssignee: string;
  reason?: string;
  [k: string]: unknown | undefined;
}
export interface PurchaseOrderCreatedPayload {
  poNumber: string;
  externalPoNumber?: string | null;
  vendorId: string;
  grandTotal: {
    amount: string;
    currency: 'INR';
  };
  lines: {
    poLineId: string;
    productId: string;
    quantityBase: string;
    unitPrice?: {
      amount: string;
      currency: 'INR';
    };
    allocations?: {
      indentLineId: string;
      quantityBase: string;
      [k: string]: unknown | undefined;
    }[];
    [k: string]: unknown | undefined;
  }[];
  [k: string]: unknown | undefined;
}
export interface PurchaseOrderApprovedPayload {
  approverId: string;
  [k: string]: unknown | undefined;
}
export interface PurchaseOrderSendRequestedPayload {
  recipientContactIds: string[];
  templateDocumentId?: string | null;
  [k: string]: unknown | undefined;
}
export interface PurchaseOrderSentPayload {
  sentAt: string;
  deliveryIds?: string[];
  [k: string]: unknown | undefined;
}
export interface PurchaseOrderCancelledPayload {
  lineIds?: string[];
  reason: string;
  [k: string]: unknown | undefined;
}
export interface GrnExcessDetectedPayload {
  lines: {
    grnLineId: string;
    excessQuantity: string;
    [k: string]: unknown | undefined;
  }[];
  [k: string]: unknown | undefined;
}
export interface GrnPostedPayload {
  grnNumber: string;
  purchaseOrderId?: string | null;
  vendorId?: string;
  warehouseId: string;
  challanNumber?: string;
  lines: {
    grnLineId: string;
    poLineId?: string | null;
    productId: string;
    received: string;
    accepted: string;
    rejected: string;
    [k: string]: unknown | undefined;
  }[];
  [k: string]: unknown | undefined;
}
export interface GrnReversedPayload {
  lines: {
    grnLineId: string;
    quantity: string;
    [k: string]: unknown | undefined;
  }[];
  reason: string;
  [k: string]: unknown | undefined;
}
export interface InventoryUpdatedPayload {
  transactionId: string;
  warehouseId: string;
  locationId?: string;
  productId: string;
  batchId?: string | null;
  movementType:
    | 'OPENING'
    | 'GRN_RECEIPT'
    | 'GRN_REVERSAL'
    | 'RETURN_TO_VENDOR'
    | 'TRANSFER_OUT'
    | 'TRANSIT_IN'
    | 'TRANSIT_OUT'
    | 'TRANSFER_IN'
    | 'TRANSIT_WRITE_OFF'
    | 'ISSUE_ADVANCE_SALE'
    | 'ISSUE_GENERAL_SALE'
    | 'ISSUE_OTHER_SALE'
    | 'SALE_REVERSAL'
    | 'RETURN_FROM_MPP'
    | 'ISSUE_INTERNAL'
    | 'ADJUSTMENT_IN'
    | 'ADJUSTMENT_OUT'
    | 'DAMAGE'
    | 'EXPIRY'
    | 'DISPOSAL'
    | 'CORRECTION';
  quantityDelta: string;
  quantityAfter: string;
  sourceType: string;
  sourceId?: string;
  sourceNumber?: string;
  [k: string]: unknown | undefined;
}
export interface InventoryAdjustedPayload {
  warehouseId: string;
  lines: {
    productId: string;
    quantityDelta: string;
    [k: string]: unknown | undefined;
  }[];
  [k: string]: unknown | undefined;
}
export interface StockBelowReorderLevelPayload {
  warehouseId: string;
  productId: string;
  available: string;
  reorderLevel: string;
  [k: string]: unknown | undefined;
}
export interface TransferOrderCreatedPayload {
  sourceLocationId: string;
  destinationLocationId: string;
  lines: {
    productId: string;
    quantityBase: string;
    indentLineId?: string | null;
    [k: string]: unknown | undefined;
  }[];
  [k: string]: unknown | undefined;
}
export interface StnCreatedPayload {
  stnNumber: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  vehicleNumber?: string;
  [k: string]: unknown | undefined;
}
export interface StnDispatchedPayload {
  lines: {
    stnLineId: string;
    quantity: string;
    [k: string]: unknown | undefined;
  }[];
  [k: string]: unknown | undefined;
}
export interface StnReceivedPayload {
  receiptId: string;
  lines: {
    stnLineId: string;
    accepted: string;
    rejected: string;
    [k: string]: unknown | undefined;
  }[];
  [k: string]: unknown | undefined;
}
export interface TransitDiscrepancyOpenedPayload {
  discrepancyId: string;
  stnLineId?: string;
  quantity: string;
  type: 'SHORT' | 'DAMAGED' | 'EXCESS';
  [k: string]: unknown | undefined;
}
export interface TransitDiscrepancyResolvedPayload {
  discrepancyId: string;
  resolution: 'RETURN_TO_SOURCE' | 'WRITE_OFF' | 'LATE_RECEIPT';
  [k: string]: unknown | undefined;
}
export interface AdvanceSaleCreatedPayload {
  saleNumber: string;
  saleCode: string;
  locationId: string;
  mppId: string;
  cycleId: string;
  saleDate: string;
  clientCreatedAt?: string | null;
  lines: {
    productId: string;
    quantityBase: string;
    [k: string]: unknown | undefined;
  }[];
  [k: string]: unknown | undefined;
}
export interface AdvanceSaleCancelledPayload {
  reason: string;
  [k: string]: unknown | undefined;
}
export interface PodUploadedPayload {
  subjectType: 'ADVANCE_SALE' | 'GENERAL_SALE' | 'STN';
  subjectId: string;
  podId: string;
  documentId: string;
  [k: string]: unknown | undefined;
}
export interface GeneralSaleCreatedPayload {
  mppId: string;
  origin?: 'RECONCILIATION' | 'MANUAL';
  lines: {
    productId: string;
    quantityBase: string;
    [k: string]: unknown | undefined;
  }[];
  [k: string]: unknown | undefined;
}
export interface CycleActivatedPayload {
  cycleId: string;
  previousCycleId?: string | null;
  [k: string]: unknown | undefined;
}
export interface ReconciliationCompletedPayload {
  cycleId: string;
  versionNo: number;
  counts: {
    total: number;
    perfectMatch?: number;
    underRecorded?: number;
    overRecorded?: number;
    notRecorded?: number;
    exceptions?: number;
    [k: string]: unknown | undefined;
  };
  generalSalesCreated?: number;
  [k: string]: unknown | undefined;
}
export interface ReconciliationPublishedPayload {
  cycleId: string;
  locationIds: string[];
  [k: string]: unknown | undefined;
}
export interface InvoiceVerifiedPayload {
  purchaseOrderId?: string | null;
  status: string;
  [k: string]: unknown | undefined;
}
export interface InvoiceExceptionRaisedPayload {
  lineIds: string[];
  matchStatuses: string[];
  [k: string]: unknown | undefined;
}
export interface NotificationCreatedPayload {
  notificationId: string;
  channels: ('IN_APP' | 'PUSH' | 'EMAIL' | 'SMS')[];
  recipientRefs?: string[];
  [k: string]: unknown | undefined;
}
export interface NotificationDeliveryUpdatedPayload {
  deliveryId: string;
  status:
    | 'QUEUED'
    | 'SENDING'
    | 'RETRY_SCHEDULED'
    | 'SENT'
    | 'DELIVERED'
    | 'READ'
    | 'FAILED'
    | 'NOT_REGISTERED';
  providerMessageId?: string | null;
  [k: string]: unknown | undefined;
}
export interface DocumentAvailablePayload {
  documentId: string;
  versionNo: number;
  entityRefs?: {
    entityType: string;
    entityId: string;
    [k: string]: unknown | undefined;
  }[];
  [k: string]: unknown | undefined;
}
export interface ImportCompletedPayload {
  batchId: string;
  kind: string;
  status: string;
  succeededRows?: number;
  failedRows?: number;
  [k: string]: unknown | undefined;
}
export interface UserRoleChangedPayload {
  userId: string;
  rolesVersion: number;
  [k: string]: unknown | undefined;
}

export const EVENT_TYPES = [
  'AdvanceSaleCancelled',
  'AdvanceSaleCreated',
  'ApprovalEscalated',
  'ApprovalTaskActed',
  'ApprovalTaskCreated',
  'CycleActivated',
  'DocumentAvailable',
  'GeneralSaleCreated',
  'GrnExcessDetected',
  'GrnPosted',
  'GrnReversed',
  'ImportCompleted',
  'IndentApproved',
  'IndentApprovedForTransfer',
  'IndentCancelled',
  'IndentCreated',
  'IndentLineStatusChanged',
  'IndentRejected',
  'IndentReturned',
  'IndentSubmitted',
  'InventoryAdjusted',
  'InventoryUpdated',
  'InvoiceExceptionRaised',
  'InvoiceVerified',
  'NotificationCreated',
  'NotificationDeliveryUpdated',
  'PodUploaded',
  'PurchaseOrderApproved',
  'PurchaseOrderCancelled',
  'PurchaseOrderCreated',
  'PurchaseOrderSendRequested',
  'PurchaseOrderSent',
  'ReconciliationCompleted',
  'ReconciliationPublished',
  'StnCreated',
  'StnDispatched',
  'StnReceived',
  'StockBelowReorderLevel',
  'TransferOrderCreated',
  'TransitDiscrepancyOpened',
  'TransitDiscrepancyResolved',
  'UserRoleChanged',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface EventPayloadMap {
  AdvanceSaleCancelled: AdvanceSaleCancelledPayload;
  AdvanceSaleCreated: AdvanceSaleCreatedPayload;
  ApprovalEscalated: ApprovalEscalatedPayload;
  ApprovalTaskActed: ApprovalTaskActedPayload;
  ApprovalTaskCreated: ApprovalTaskCreatedPayload;
  CycleActivated: CycleActivatedPayload;
  DocumentAvailable: DocumentAvailablePayload;
  GeneralSaleCreated: GeneralSaleCreatedPayload;
  GrnExcessDetected: GrnExcessDetectedPayload;
  GrnPosted: GrnPostedPayload;
  GrnReversed: GrnReversedPayload;
  ImportCompleted: ImportCompletedPayload;
  IndentApproved: IndentApprovedPayload;
  IndentApprovedForTransfer: IndentApprovedForTransferPayload;
  IndentCancelled: IndentCancelledPayload;
  IndentCreated: IndentCreatedPayload;
  IndentLineStatusChanged: IndentLineStatusChangedPayload;
  IndentRejected: IndentRejectedPayload;
  IndentReturned: IndentReturnedPayload;
  IndentSubmitted: IndentSubmittedPayload;
  InventoryAdjusted: InventoryAdjustedPayload;
  InventoryUpdated: InventoryUpdatedPayload;
  InvoiceExceptionRaised: InvoiceExceptionRaisedPayload;
  InvoiceVerified: InvoiceVerifiedPayload;
  NotificationCreated: NotificationCreatedPayload;
  NotificationDeliveryUpdated: NotificationDeliveryUpdatedPayload;
  PodUploaded: PodUploadedPayload;
  PurchaseOrderApproved: PurchaseOrderApprovedPayload;
  PurchaseOrderCancelled: PurchaseOrderCancelledPayload;
  PurchaseOrderCreated: PurchaseOrderCreatedPayload;
  PurchaseOrderSendRequested: PurchaseOrderSendRequestedPayload;
  PurchaseOrderSent: PurchaseOrderSentPayload;
  ReconciliationCompleted: ReconciliationCompletedPayload;
  ReconciliationPublished: ReconciliationPublishedPayload;
  StnCreated: StnCreatedPayload;
  StnDispatched: StnDispatchedPayload;
  StnReceived: StnReceivedPayload;
  StockBelowReorderLevel: StockBelowReorderLevelPayload;
  TransferOrderCreated: TransferOrderCreatedPayload;
  TransitDiscrepancyOpened: TransitDiscrepancyOpenedPayload;
  TransitDiscrepancyResolved: TransitDiscrepancyResolvedPayload;
  UserRoleChanged: UserRoleChangedPayload;
}

/** A domain event whose payload type is determined by its eventType. */
export type DomainEvent<T extends EventType = EventType> = {
  [K in T]: Omit<Envelope, 'eventType' | 'payload'> & { eventType: K; payload: EventPayloadMap[K] };
}[T];
