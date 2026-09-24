/* Generated from schema/schema.graphql by `pnpm codegen`. Do not edit. */
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  /** ISO 4217 currency code. */
  CurrencyCode: { input: string; output: string };
  /** ISO-8601 calendar date, e.g. 2026-09-24 (business time zone Asia/Kolkata). */
  Date: { input: string; output: string };
  /** RFC 3339 timestamp in UTC, e.g. 2026-09-24T05:30:00Z. */
  DateTime: { input: string; output: string };
  /** Arbitrary-precision decimal serialised as a string, e.g. "1250.50". */
  Decimal: { input: string; output: string };
  /** RFC 5322 e-mail address. */
  EmailAddress: { input: string; output: string };
  /** JSON value (used only for configuration payloads). */
  JSON: { input: unknown; output: unknown };
  /** E.164 phone number, e.g. +919876543210. */
  PhoneNumber: { input: string; output: string };
  /** Client-generated UUID used for idempotency and offline correlation. */
  UUID: { input: string; output: string };
};

export type AcknowledgeReconciliationInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  recordIds: Array<Scalars['ID']['input']>;
};

export type AdjustmentLineInput = {
  batchId?: InputMaybe<Scalars['ID']['input']>;
  countedQuantity?: InputMaybe<Scalars['Decimal']['input']>;
  productId: Scalars['ID']['input'];
  /** Signed delta; or supply countedQuantity to compute delta (legacy SET). */
  quantityDelta?: InputMaybe<Scalars['Decimal']['input']>;
};

export const AdjustmentStatus = {
  APPROVED: 'APPROVED',
  CANCELLED: 'CANCELLED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  POSTED: 'POSTED',
  REJECTED: 'REJECTED',
} as const;

export type AdjustmentStatus = (typeof AdjustmentStatus)[keyof typeof AdjustmentStatus];
export type AdvanceSale = Auditable &
  Node & {
    __typename?: 'AdvanceSale';
    cancelledReason?: Maybe<Scalars['String']['output']>;
    channel: Channel;
    clientCreatedAt?: Maybe<Scalars['DateTime']['output']>;
    createdAt: Scalars['DateTime']['output'];
    createdBy?: Maybe<UserRef>;
    cycle: PaymentCycle;
    id: Scalars['ID']['output'];
    lines: Array<AdvanceSaleLine>;
    location: Location;
    mpp: Mpp;
    notifications: Array<NotificationDelivery>;
    pod?: Maybe<Pod>;
    podStatus: PodStatus;
    receipt?: Maybe<Document>;
    receiptStatus: DocumentGenerationStatus;
    /** 10-digit reference communicated to the Sahayak; also the POD verification code. */
    saleCode: Scalars['String']['output'];
    saleDate: Scalars['Date']['output'];
    saleNumber: Scalars['String']['output'];
    status: SaleStatus;
    updatedAt?: Maybe<Scalars['DateTime']['output']>;
    updatedBy?: Maybe<UserRef>;
    version: Scalars['Int']['output'];
  };

export type AdvanceSaleConnection = {
  __typename?: 'AdvanceSaleConnection';
  edges: Array<AdvanceSaleEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type AdvanceSaleEdge = {
  __typename?: 'AdvanceSaleEdge';
  cursor: Scalars['String']['output'];
  node: AdvanceSale;
};

export type AdvanceSaleFilter = {
  cycleIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  mine?: InputMaybe<Scalars['Boolean']['input']>;
  mppIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  podStatus?: InputMaybe<Array<PodStatus>>;
  saleDate?: InputMaybe<DateRangeInput>;
  search?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Array<SaleStatus>>;
};

export type AdvanceSaleLine = {
  __typename?: 'AdvanceSaleLine';
  lineNo: Scalars['Int']['output'];
  product: Product;
  productName: Scalars['String']['output'];
  quantity: Quantity;
  sapProductName?: Maybe<Scalars['String']['output']>;
};

export type AdvanceSaleLineInput = {
  productId: Scalars['ID']['input'];
  quantity: Scalars['Decimal']['input'];
  uomId: Scalars['ID']['input'];
};

export type AdvanceSalePayload = {
  __typename?: 'AdvanceSalePayload';
  advanceSale?: Maybe<AdvanceSale>;
  userErrors: Array<UserError>;
};

export type ApprovalAction = {
  __typename?: 'ApprovalAction';
  action: ApprovalActionType;
  actor: UserRef;
  id: Scalars['ID']['output'];
  occurredAt: Scalars['DateTime']['output'];
  onBehalfOf?: Maybe<UserRef>;
  remark?: Maybe<Scalars['String']['output']>;
  stepName?: Maybe<Scalars['String']['output']>;
};

export const ApprovalActionType = {
  APPROVE: 'APPROVE',
  APPROVE_FOR_TRANSFER: 'APPROVE_FOR_TRANSFER',
  COMMENT: 'COMMENT',
  DELEGATE: 'DELEGATE',
  ESCALATE: 'ESCALATE',
  REASSIGN: 'REASSIGN',
  REJECT: 'REJECT',
  REMIND: 'REMIND',
  RETURN: 'RETURN',
} as const;

export type ApprovalActionType = (typeof ApprovalActionType)[keyof typeof ApprovalActionType];
export type ApprovalPayload = {
  __typename?: 'ApprovalPayload';
  indent?: Maybe<Indent>;
  task?: Maybe<ApprovalTask>;
  transferOrder?: Maybe<TransferOrder>;
  userErrors: Array<UserError>;
};

export type ApprovalTask = Node & {
  __typename?: 'ApprovalTask';
  actedAt?: Maybe<Scalars['DateTime']['output']>;
  amount?: Maybe<Money>;
  assignee?: Maybe<UserRef>;
  assigneeRoleCode?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  dueAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  indent?: Maybe<Indent>;
  instance: WorkflowInstance;
  lineIds: Array<Scalars['ID']['output']>;
  onBehalfOf?: Maybe<UserRef>;
  slaState: SlaState;
  status: ApprovalTaskStatus;
  stepKey: Scalars['String']['output'];
  stepName: Scalars['String']['output'];
  /** Subject summary for queue display. */
  subjectNumber?: Maybe<Scalars['String']['output']>;
  subjectSummary?: Maybe<Scalars['String']['output']>;
  subjectType: WorkflowSubjectType;
  version: Scalars['Int']['output'];
};

export type ApprovalTaskConnection = {
  __typename?: 'ApprovalTaskConnection';
  edges: Array<ApprovalTaskEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type ApprovalTaskEdge = {
  __typename?: 'ApprovalTaskEdge';
  cursor: Scalars['String']['output'];
  node: ApprovalTask;
};

export type ApprovalTaskEvent = {
  __typename?: 'ApprovalTaskEvent';
  change: Scalars['String']['output'];
  occurredAt: Scalars['DateTime']['output'];
  task: ApprovalTask;
};

export type ApprovalTaskFilter = {
  amountMax?: InputMaybe<Scalars['Decimal']['input']>;
  amountMin?: InputMaybe<Scalars['Decimal']['input']>;
  /** Only tasks where the caller is the (delegated) assignee. */
  assignedToMe?: InputMaybe<Scalars['Boolean']['input']>;
  categoryIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  departmentIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  slaState?: InputMaybe<Array<SlaState>>;
  status?: InputMaybe<Array<ApprovalTaskStatus>>;
  subjectTypes?: InputMaybe<Array<WorkflowSubjectType>>;
};

export const ApprovalTaskStatus = {
  APPROVED: 'APPROVED',
  CANCELLED: 'CANCELLED',
  ESCALATED: 'ESCALATED',
  PENDING: 'PENDING',
  REASSIGNED: 'REASSIGNED',
  REJECTED: 'REJECTED',
  RETURNED: 'RETURNED',
} as const;

export type ApprovalTaskStatus = (typeof ApprovalTaskStatus)[keyof typeof ApprovalTaskStatus];
export type ApproveIndentForTransferInput = {
  expectedVersion: Scalars['Int']['input'];
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  lines: Array<LineDecisionInput>;
  remark?: InputMaybe<Scalars['String']['input']>;
  taskId: Scalars['ID']['input'];
};

export type ApproveIndentInput = {
  expectedVersion: Scalars['Int']['input'];
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  /** Omit to approve all lines in the task at requested quantity. */
  lines?: InputMaybe<Array<LineDecisionInput>>;
  remark?: InputMaybe<Scalars['String']['input']>;
  taskId: Scalars['ID']['input'];
};

export type ApprovePurchaseOrderInput = {
  approve: Scalars['Boolean']['input'];
  expectedVersion: Scalars['Int']['input'];
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  remark?: InputMaybe<Scalars['String']['input']>;
  taskId: Scalars['ID']['input'];
};

export type AuditEntry = Node & {
  __typename?: 'AuditEntry';
  action: Scalars['String']['output'];
  actor?: Maybe<UserRef>;
  after?: Maybe<Scalars['JSON']['output']>;
  before?: Maybe<Scalars['JSON']['output']>;
  channel?: Maybe<Channel>;
  entityId: Scalars['ID']['output'];
  entityNumber?: Maybe<Scalars['String']['output']>;
  entityType: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  ip?: Maybe<Scalars['String']['output']>;
  occurredAt: Scalars['DateTime']['output'];
  onBehalfOf?: Maybe<UserRef>;
  requestId?: Maybe<Scalars['String']['output']>;
};

export type AuditEntryConnection = {
  __typename?: 'AuditEntryConnection';
  edges: Array<AuditEntryEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type AuditEntryEdge = {
  __typename?: 'AuditEntryEdge';
  cursor: Scalars['String']['output'];
  node: AuditEntry;
};

export type AuditFilter = {
  action?: InputMaybe<Scalars['String']['input']>;
  actorId?: InputMaybe<Scalars['ID']['input']>;
  entityId?: InputMaybe<Scalars['ID']['input']>;
  entityType?: InputMaybe<Scalars['String']['input']>;
  occurredAt?: InputMaybe<DateTimeRangeInput>;
  requestId?: InputMaybe<Scalars['String']['input']>;
};

export type Auditable = {
  createdAt: Scalars['DateTime']['output'];
  createdBy?: Maybe<UserRef>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  updatedBy?: Maybe<UserRef>;
  version: Scalars['Int']['output'];
};

export type BulkApprovalInput = {
  action: ApprovalActionType;
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  remark?: InputMaybe<Scalars['String']['input']>;
  taskIds: Array<Scalars['ID']['input']>;
};

export type BulkApprovalPayload = {
  __typename?: 'BulkApprovalPayload';
  results: Array<BulkApprovalResult>;
};

export type BulkApprovalResult = {
  __typename?: 'BulkApprovalResult';
  error?: Maybe<UserError>;
  success: Scalars['Boolean']['output'];
  taskId: Scalars['ID']['output'];
};

export type CancelAdvanceSaleInput = {
  expectedVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  reason: Scalars['String']['input'];
};

export type CancelGrnInput = {
  expectedVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  reason: Scalars['String']['input'];
};

export type CancelIndentInput = {
  expectedVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  /** Cancel only these lines; omit for whole indent. */
  lineIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  reason: Scalars['String']['input'];
};

export type CancelPurchaseOrderInput = {
  expectedVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  reason: Scalars['String']['input'];
  reopenIndentLines?: InputMaybe<Scalars['Boolean']['input']>;
};

export type ChangeStockConditionInput = {
  action: StockConditionAction;
  idempotencyKey: Scalars['UUID']['input'];
  locationId: Scalars['ID']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  productId: Scalars['ID']['input'];
  /** DISPOSE only; mandatory photo proof. */
  proofDocumentId?: InputMaybe<Scalars['ID']['input']>;
  quantity: Scalars['Int']['input'];
  /** DISPOSE only. */
  sourceBucket?: InputMaybe<StockConditionBucket>;
};

export const Channel = {
  API: 'API',
  IMPORT: 'IMPORT',
  MOBILE: 'MOBILE',
  MOBILE_OFFLINE: 'MOBILE_OFFLINE',
  SYSTEM: 'SYSTEM',
  WEB: 'WEB',
} as const;

export type Channel = (typeof Channel)[keyof typeof Channel];
export type ChartSeries = {
  __typename?: 'ChartSeries';
  key: Scalars['String']['output'];
  label: Scalars['String']['output'];
  points: Array<SeriesPoint>;
};

export type CommitImportInput = {
  batchId: Scalars['ID']['input'];
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
};

export type ComponentHealth = {
  __typename?: 'ComponentHealth';
  detail?: Maybe<Scalars['String']['output']>;
  latencyMs?: Maybe<Scalars['Int']['output']>;
  name: Scalars['String']['output'];
  status: Scalars['String']['output'];
};

export type CreateAdvanceSaleInput = {
  channel?: InputMaybe<Channel>;
  clientCreatedAt?: InputMaybe<Scalars['DateTime']['input']>;
  cycleId: Scalars['ID']['input'];
  /** Client UUID; mandatory for offline-created sales. */
  idempotencyKey: Scalars['UUID']['input'];
  lines: Array<AdvanceSaleLineInput>;
  locationId: Scalars['ID']['input'];
  mppId: Scalars['ID']['input'];
  saleDate: Scalars['Date']['input'];
};

export type CreateCycleMonthInput = {
  /** Create default cycles 1–10, 11–20, 21–end. */
  createDefaultCycles?: InputMaybe<Scalars['Boolean']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  month: Scalars['Int']['input'];
  year: Scalars['Int']['input'];
};

export type CreateDelegationInput = {
  definitionCodes: Array<Scalars['String']['input']>;
  delegateUserId: Scalars['ID']['input'];
  maxAmount?: InputMaybe<Scalars['Decimal']['input']>;
  reason?: InputMaybe<Scalars['String']['input']>;
  validFrom: Scalars['DateTime']['input'];
  validTo: Scalars['DateTime']['input'];
};

export type CreateGeneralSaleInput = {
  cycleId: Scalars['ID']['input'];
  idempotencyKey: Scalars['UUID']['input'];
  lines: Array<AdvanceSaleLineInput>;
  mppId: Scalars['ID']['input'];
  reason: Scalars['String']['input'];
};

export type CreateGrnInput = {
  approvalEvidenceDocumentIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  challanDate: Scalars['Date']['input'];
  challanDocumentId: Scalars['ID']['input'];
  challanNumber: Scalars['String']['input'];
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  invoiceDate?: InputMaybe<Scalars['Date']['input']>;
  invoiceDocumentId?: InputMaybe<Scalars['ID']['input']>;
  invoiceNumber?: InputMaybe<Scalars['String']['input']>;
  lines: Array<GrnLineInput>;
  photoDocumentIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  /** Post immediately if no approval/inspection is required. */
  post?: InputMaybe<Scalars['Boolean']['input']>;
  purchaseOrderId?: InputMaybe<Scalars['ID']['input']>;
  receivedAt?: InputMaybe<Scalars['DateTime']['input']>;
  type: GrnType;
  vehicleNumber?: InputMaybe<Scalars['String']['input']>;
  vendorId?: InputMaybe<Scalars['ID']['input']>;
  warehouseId: Scalars['ID']['input'];
};

export type CreateIndentInput = {
  attachmentDocumentIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  budgetCode?: InputMaybe<Scalars['String']['input']>;
  departmentId?: InputMaybe<Scalars['ID']['input']>;
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  justification?: InputMaybe<Scalars['String']['input']>;
  lines: Array<IndentLineInput>;
  locationId: Scalars['ID']['input'];
  priority?: InputMaybe<Priority>;
  remarks?: InputMaybe<Scalars['String']['input']>;
  requestedForEmployeeCode?: InputMaybe<Scalars['String']['input']>;
  requiredBy?: InputMaybe<Scalars['Date']['input']>;
  /** When true the indent is submitted in the same call (offline sync path). */
  submit?: InputMaybe<Scalars['Boolean']['input']>;
};

export type CreateInvoiceInput = {
  documentId?: InputMaybe<Scalars['ID']['input']>;
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  invoiceDate: Scalars['Date']['input'];
  invoiceNumber: Scalars['String']['input'];
  lines: Array<InvoiceLineInput>;
  purchaseOrderId?: InputMaybe<Scalars['ID']['input']>;
  vendorId: Scalars['ID']['input'];
};

export type CreateOtherSaleInput = {
  idempotencyKey: Scalars['UUID']['input'];
  lines: Array<OtherSaleLineInput>;
  locationId: Scalars['ID']['input'];
  partyAddress?: InputMaybe<Scalars['String']['input']>;
  partyGstin?: InputMaybe<Scalars['String']['input']>;
  partyName: Scalars['String']['input'];
};

export type CreatePurchaseOrderInput = {
  billToLocationId: Scalars['ID']['input'];
  externalPoNumber?: InputMaybe<Scalars['String']['input']>;
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  lines: Array<PurchaseOrderLineInput>;
  noPoReason?: InputMaybe<Scalars['String']['input']>;
  orderDate?: InputMaybe<Scalars['Date']['input']>;
  sendSuppressed?: InputMaybe<Scalars['Boolean']['input']>;
  shipToLocationId: Scalars['ID']['input'];
  terms?: InputMaybe<Scalars['String']['input']>;
  type: PurchaseOrderType;
  vendorId: Scalars['ID']['input'];
};

export type CreateStnInput = {
  driverName?: InputMaybe<Scalars['String']['input']>;
  driverPhone?: InputMaybe<Scalars['PhoneNumber']['input']>;
  ewayBillDocumentId?: InputMaybe<Scalars['ID']['input']>;
  ewayBillNumber?: InputMaybe<Scalars['String']['input']>;
  expectedArrival?: InputMaybe<Scalars['DateTime']['input']>;
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  notifyUserIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  /** Optional partial quantities per transfer line. */
  quantities?: InputMaybe<Array<StnQuantityInput>>;
  transferOrderLineIds: Array<Scalars['ID']['input']>;
  transporterName?: InputMaybe<Scalars['String']['input']>;
  vehicleNumber: Scalars['String']['input'];
};

export type CreateTransferOrderInput = {
  destinationLocationId: Scalars['ID']['input'];
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  lines: Array<TransferOrderLineInput>;
  reason: Scalars['String']['input'];
  sourceLocationId: Scalars['ID']['input'];
};

export type CreateUserInput = {
  additionalLocationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  deliveryPointCode?: InputMaybe<Scalars['String']['input']>;
  departmentId?: InputMaybe<Scalars['ID']['input']>;
  designationId?: InputMaybe<Scalars['ID']['input']>;
  displayName: Scalars['String']['input'];
  email: Scalars['EmailAddress']['input'];
  employeeCode?: InputMaybe<Scalars['String']['input']>;
  mobile?: InputMaybe<Scalars['PhoneNumber']['input']>;
  preferredLocale?: InputMaybe<Locale>;
  primaryLocationId: Scalars['ID']['input'];
  reportsToId?: InputMaybe<Scalars['ID']['input']>;
  roles: Array<RoleAssignmentInput>;
  sendInvite?: InputMaybe<Scalars['Boolean']['input']>;
};

export const CycleBand = {
  DAYS_1_10: 'DAYS_1_10',
  DAYS_11_20: 'DAYS_11_20',
  DAYS_21_31: 'DAYS_21_31',
} as const;

export type CycleBand = (typeof CycleBand)[keyof typeof CycleBand];
export type CycleMonth = Node & {
  __typename?: 'CycleMonth';
  cycles: Array<PaymentCycle>;
  id: Scalars['ID']['output'];
  month: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  year: Scalars['Int']['output'];
};

export type CycleMonthPayload = {
  __typename?: 'CycleMonthPayload';
  cycleMonth?: Maybe<CycleMonth>;
  userErrors: Array<UserError>;
};

export type CyclePayload = {
  __typename?: 'CyclePayload';
  cycle?: Maybe<PaymentCycle>;
  userErrors: Array<UserError>;
};

export const CycleStatus = {
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
  INACTIVE: 'INACTIVE',
  PLANNED: 'PLANNED',
  RECONCILING: 'RECONCILING',
} as const;

export type CycleStatus = (typeof CycleStatus)[keyof typeof CycleStatus];
export type Dashboard = {
  __typename?: 'Dashboard';
  freshnessSeconds: Scalars['Int']['output'];
  generatedAt: Scalars['DateTime']['output'];
  widgets: Array<DashboardWidget>;
  workspace: Workspace;
};

export type DashboardInput = {
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  period?: InputMaybe<DateRangeInput>;
  workspace?: InputMaybe<Workspace>;
};

export type DashboardWidget = {
  __typename?: 'DashboardWidget';
  key: Scalars['String']['output'];
  kpis?: Maybe<Array<KpiValue>>;
  rows?: Maybe<Scalars['JSON']['output']>;
  series?: Maybe<Array<ChartSeries>>;
  title: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

export type DateRangeInput = {
  from?: InputMaybe<Scalars['Date']['input']>;
  to?: InputMaybe<Scalars['Date']['input']>;
};

export type DateTimeRangeInput = {
  from?: InputMaybe<Scalars['DateTime']['input']>;
  to?: InputMaybe<Scalars['DateTime']['input']>;
};

export type DecideStockAdjustmentInput = {
  approve: Scalars['Boolean']['input'];
  expectedVersion: Scalars['Int']['input'];
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  remark?: InputMaybe<Scalars['String']['input']>;
  taskId: Scalars['ID']['input'];
};

export type Delegation = Node & {
  __typename?: 'Delegation';
  active: Scalars['Boolean']['output'];
  definitionCodes: Array<Scalars['String']['output']>;
  delegate: UserRef;
  delegator: UserRef;
  id: Scalars['ID']['output'];
  maxAmount?: Maybe<Money>;
  validFrom: Scalars['DateTime']['output'];
  validTo: Scalars['DateTime']['output'];
};

export type DelegationPayload = {
  __typename?: 'DelegationPayload';
  delegation?: Maybe<Delegation>;
  userErrors: Array<UserError>;
};

export type DeletePayload = {
  __typename?: 'DeletePayload';
  deletedId?: Maybe<Scalars['ID']['output']>;
  userErrors: Array<UserError>;
};

export const DeliveryStatus = {
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  NOT_REGISTERED: 'NOT_REGISTERED',
  QUEUED: 'QUEUED',
  READ: 'READ',
  RETRY_SCHEDULED: 'RETRY_SCHEDULED',
  SENDING: 'SENDING',
  SENT: 'SENT',
} as const;

export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];
export type DeliveryStatusEvent = {
  __typename?: 'DeliveryStatusEvent';
  deliveryId: Scalars['ID']['output'];
  occurredAt: Scalars['DateTime']['output'];
  status: DeliveryStatus;
  subjectId?: Maybe<Scalars['ID']['output']>;
  subjectType?: Maybe<Scalars['String']['output']>;
};

export type Department = Node & {
  __typename?: 'Department';
  code: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type Designation = Node & {
  __typename?: 'Designation';
  code: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type DiscrepancyPayload = {
  __typename?: 'DiscrepancyPayload';
  discrepancy?: Maybe<TransitDiscrepancy>;
  userErrors: Array<UserError>;
};

export const DiscrepancyResolution = {
  LATE_RECEIPT: 'LATE_RECEIPT',
  RETURN_TO_SOURCE: 'RETURN_TO_SOURCE',
  WRITE_OFF: 'WRITE_OFF',
} as const;

export type DiscrepancyResolution =
  (typeof DiscrepancyResolution)[keyof typeof DiscrepancyResolution];
export const DiscrepancyType = {
  DAMAGED: 'DAMAGED',
  EXCESS: 'EXCESS',
  SHORT: 'SHORT',
} as const;

export type DiscrepancyType = (typeof DiscrepancyType)[keyof typeof DiscrepancyType];
export type DispatchGeneralSaleInput = {
  expectedVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  idempotencyKey: Scalars['UUID']['input'];
  warehouseId: Scalars['ID']['input'];
};

export type DispatchStnInput = {
  expectedVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  lines: Array<StnLineQuantityInput>;
  remarks?: InputMaybe<Scalars['String']['input']>;
};

export type Document = Node & {
  __typename?: 'Document';
  /** Short-lived signed URL (5 min); null unless AVAILABLE and caller authorised. */
  downloadUrl?: Maybe<Scalars['String']['output']>;
  fileName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  mimeType: Scalars['String']['output'];
  previewUrl?: Maybe<Scalars['String']['output']>;
  sha256: Scalars['String']['output'];
  sizeBytes: Scalars['Int']['output'];
  status: DocumentStatus;
  title: Scalars['String']['output'];
  typeCode: Scalars['String']['output'];
  uploadedAt: Scalars['DateTime']['output'];
  uploadedBy: UserRef;
  versionNo: Scalars['Int']['output'];
  versions: Array<DocumentVersionInfo>;
};

export type DocumentConnection = {
  __typename?: 'DocumentConnection';
  edges: Array<DocumentEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type DocumentEdge = {
  __typename?: 'DocumentEdge';
  cursor: Scalars['String']['output'];
  node: Document;
};

export type DocumentEvent = {
  __typename?: 'DocumentEvent';
  documentId: Scalars['ID']['output'];
  entityId: Scalars['ID']['output'];
  entityType: Scalars['String']['output'];
  occurredAt: Scalars['DateTime']['output'];
  status: Scalars['String']['output'];
};

export type DocumentFilter = {
  entityId?: InputMaybe<Scalars['ID']['input']>;
  entityType?: InputMaybe<Scalars['String']['input']>;
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  search?: InputMaybe<Scalars['String']['input']>;
  typeCodes?: InputMaybe<Array<Scalars['String']['input']>>;
  uploadedAt?: InputMaybe<DateRangeInput>;
};

export const DocumentGenerationStatus = {
  FAILED: 'FAILED',
  GENERATING: 'GENERATING',
  PENDING: 'PENDING',
  READY: 'READY',
} as const;

export type DocumentGenerationStatus =
  (typeof DocumentGenerationStatus)[keyof typeof DocumentGenerationStatus];
export const DocumentStatus = {
  AVAILABLE: 'AVAILABLE',
  DELETED: 'DELETED',
  PENDING_SCAN: 'PENDING_SCAN',
  PENDING_UPLOAD: 'PENDING_UPLOAD',
  QUARANTINED: 'QUARANTINED',
  SUPERSEDED: 'SUPERSEDED',
} as const;

export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];
export type DocumentVersionInfo = {
  __typename?: 'DocumentVersionInfo';
  fileName: Scalars['String']['output'];
  sizeBytes: Scalars['Int']['output'];
  uploadedAt: Scalars['DateTime']['output'];
  uploadedBy: UserRef;
  versionNo: Scalars['Int']['output'];
};

export const ErrorCode = {
  APPROVAL_ALREADY_ACTED: 'APPROVAL_ALREADY_ACTED',
  APPROVAL_NOT_ASSIGNED: 'APPROVAL_NOT_ASSIGNED',
  APPROVER_NOT_RESOLVED: 'APPROVER_NOT_RESOLVED',
  AUTH_ACCOUNT_DISABLED: 'AUTH_ACCOUNT_DISABLED',
  AUTH_ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_MFA_REQUIRED: 'AUTH_MFA_REQUIRED',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  COLUMN_NOT_OPEN: 'COLUMN_NOT_OPEN',
  CONFLICT: 'CONFLICT',
  CYCLE_CLOSED: 'CYCLE_CLOSED',
  CYCLE_NOT_ACTIVE: 'CYCLE_NOT_ACTIVE',
  CYCLE_NOT_OPEN: 'CYCLE_NOT_OPEN',
  CYCLE_OUT_OF_MONTH: 'CYCLE_OUT_OF_MONTH',
  CYCLE_OVERLAP: 'CYCLE_OVERLAP',
  DOCUMENT_NOT_AVAILABLE: 'DOCUMENT_NOT_AVAILABLE',
  DOCUMENT_TOO_LARGE: 'DOCUMENT_TOO_LARGE',
  DOCUMENT_TYPE_NOT_ALLOWED: 'DOCUMENT_TYPE_NOT_ALLOWED',
  EXTERNAL_SERVICE_UNAVAILABLE: 'EXTERNAL_SERVICE_UNAVAILABLE',
  FILE_CYCLE_MISMATCH: 'FILE_CYCLE_MISMATCH',
  FORBIDDEN: 'FORBIDDEN',
  GRN_DOCUMENT_REQUIRED: 'GRN_DOCUMENT_REQUIRED',
  GRN_DUPLICATE_CHALLAN: 'GRN_DUPLICATE_CHALLAN',
  GRN_OVER_TOLERANCE: 'GRN_OVER_TOLERANCE',
  GRN_REVERSAL_EXCEEDS_STOCK: 'GRN_REVERSAL_EXCEEDS_STOCK',
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
  INDENT_ALREADY_SUBMITTED: 'INDENT_ALREADY_SUBMITTED',
  INDENT_DUPLICATE_LINE: 'INDENT_DUPLICATE_LINE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  INVENTORY_INSUFFICIENT: 'INVENTORY_INSUFFICIENT',
  INVOICE_DUPLICATE: 'INVOICE_DUPLICATE',
  MONTH_LOCKED: 'MONTH_LOCKED',
  NOT_FOUND: 'NOT_FOUND',
  POD_ALREADY_UPLOADED: 'POD_ALREADY_UPLOADED',
  POD_VERIFICATION_FAILED: 'POD_VERIFICATION_FAILED',
  PO_DUPLICATE_EXTERNAL_NUMBER: 'PO_DUPLICATE_EXTERNAL_NUMBER',
  PO_NOT_OPEN: 'PO_NOT_OPEN',
  PO_QUANTITY_EXCEEDS_APPROVED: 'PO_QUANTITY_EXCEEDS_APPROVED',
  PRODUCT_INACTIVE: 'PRODUCT_INACTIVE',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  RECONCILIATION_COLUMNS_MISSING: 'RECONCILIATION_COLUMNS_MISSING',
  RECONCILIATION_DUPLICATE_FILE: 'RECONCILIATION_DUPLICATE_FILE',
  SAP_PO_PRODUCT_MISMATCH: 'SAP_PO_PRODUCT_MISMATCH',
  STATEMENT_FINALIZED: 'STATEMENT_FINALIZED',
  STN_NOT_DISPATCHED: 'STN_NOT_DISPATCHED',
  STN_RECEIPT_EXCEEDS_DISPATCH: 'STN_RECEIPT_EXCEEDS_DISPATCH',
  TRANSFER_SOURCE_INVALID: 'TRANSFER_SOURCE_INVALID',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  WORKFLOW_NOT_CONFIGURED: 'WORKFLOW_NOT_CONFIGURED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
export const ExportFormat = {
  CSV: 'CSV',
  PDF: 'PDF',
  XLSX: 'XLSX',
} as const;

export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat];
export type ExportJob = Node & {
  __typename?: 'ExportJob';
  completedAt?: Maybe<Scalars['DateTime']['output']>;
  document?: Maybe<Document>;
  expiresAt?: Maybe<Scalars['DateTime']['output']>;
  format: ExportFormat;
  id: Scalars['ID']['output'];
  reportKey: Scalars['String']['output'];
  requestedAt: Scalars['DateTime']['output'];
  rowCount?: Maybe<Scalars['Int']['output']>;
  status: ExportStatus;
};

export type ExportPayload = {
  __typename?: 'ExportPayload';
  /** Present when the export was small enough to complete synchronously. */
  document?: Maybe<Document>;
  job?: Maybe<ExportJob>;
  userErrors: Array<UserError>;
};

export type ExportProgressEvent = {
  __typename?: 'ExportProgressEvent';
  jobId: Scalars['ID']['output'];
  status: ExportStatus;
};

export const ExportStatus = {
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED',
  FAILED: 'FAILED',
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
} as const;

export type ExportStatus = (typeof ExportStatus)[keyof typeof ExportStatus];
export type ExternalProductCode = {
  __typename?: 'ExternalProductCode';
  code?: Maybe<Scalars['String']['output']>;
  isPrimary: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  system: Scalars['String']['output'];
};

export type ExternalProductCodeInput = {
  code?: InputMaybe<Scalars['String']['input']>;
  isPrimary?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
  system: Scalars['String']['input'];
};

export type FeatureFlag = {
  __typename?: 'FeatureFlag';
  description?: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
  key: Scalars['String']['output'];
  rules?: Maybe<Scalars['JSON']['output']>;
};

export type GeneralSale = Node & {
  __typename?: 'GeneralSale';
  createdAt: Scalars['DateTime']['output'];
  cycle: PaymentCycle;
  id: Scalars['ID']['output'];
  lines: Array<AdvanceSaleLine>;
  location: Location;
  mpp: Mpp;
  origin: GeneralSaleOrigin;
  pod?: Maybe<Pod>;
  reconciliationRecord?: Maybe<ReconciliationRecord>;
  saleCode?: Maybe<Scalars['String']['output']>;
  status: SaleStatus;
};

export type GeneralSaleConnection = {
  __typename?: 'GeneralSaleConnection';
  edges: Array<GeneralSaleEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type GeneralSaleEdge = {
  __typename?: 'GeneralSaleEdge';
  cursor: Scalars['String']['output'];
  node: GeneralSale;
};

export type GeneralSaleFilter = {
  cycleIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  mppIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  status?: InputMaybe<Array<SaleStatus>>;
};

export const GeneralSaleOrigin = {
  MANUAL: 'MANUAL',
  RECONCILIATION: 'RECONCILIATION',
} as const;

export type GeneralSaleOrigin = (typeof GeneralSaleOrigin)[keyof typeof GeneralSaleOrigin];
export type GeneralSalePayload = {
  __typename?: 'GeneralSalePayload';
  generalSale?: Maybe<GeneralSale>;
  userErrors: Array<UserError>;
};

export type Grn = Auditable &
  Node & {
    __typename?: 'Grn';
    challanDate: Scalars['Date']['output'];
    challanNumber: Scalars['String']['output'];
    createdAt: Scalars['DateTime']['output'];
    createdBy?: Maybe<UserRef>;
    documents: Array<Document>;
    grnNumber?: Maybe<Scalars['String']['output']>;
    id: Scalars['ID']['output'];
    invoiceDate?: Maybe<Scalars['Date']['output']>;
    invoiceNumber?: Maybe<Scalars['String']['output']>;
    legacyGrnNumber?: Maybe<Scalars['String']['output']>;
    lines: Array<GrnLine>;
    pdf?: Maybe<Document>;
    postedAt?: Maybe<Scalars['DateTime']['output']>;
    purchaseOrder?: Maybe<PurchaseOrder>;
    receivedAt: Scalars['DateTime']['output'];
    reversalOf?: Maybe<Grn>;
    status: GrnStatus;
    type: GrnType;
    updatedAt?: Maybe<Scalars['DateTime']['output']>;
    updatedBy?: Maybe<UserRef>;
    vehicleNumber?: Maybe<Scalars['String']['output']>;
    vendor: Vendor;
    verification?: Maybe<GrnVerification>;
    version: Scalars['Int']['output'];
    warehouse: Warehouse;
  };

export type GrnConnection = {
  __typename?: 'GrnConnection';
  edges: Array<GrnEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type GrnEdge = {
  __typename?: 'GrnEdge';
  cursor: Scalars['String']['output'];
  node: Grn;
};

export type GrnFilter = {
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  purchaseOrderId?: InputMaybe<Scalars['ID']['input']>;
  receivedAt?: InputMaybe<DateRangeInput>;
  search?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Array<GrnStatus>>;
  vendorIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  verificationPending?: InputMaybe<Scalars['Boolean']['input']>;
};

export type GrnLine = Node & {
  __typename?: 'GrnLine';
  batchNo?: Maybe<Scalars['String']['output']>;
  expiryDate?: Maybe<Scalars['Date']['output']>;
  id: Scalars['ID']['output'];
  mfgDate?: Maybe<Scalars['Date']['output']>;
  product: Product;
  purchaseOrderLine?: Maybe<PurchaseOrderLine>;
  quantityAccepted: Scalars['Decimal']['output'];
  quantityDamaged: Scalars['Decimal']['output'];
  quantityOrdered?: Maybe<Scalars['Decimal']['output']>;
  quantityReceived: Scalars['Decimal']['output'];
  quantityRejected: Scalars['Decimal']['output'];
  rejectReasonCode?: Maybe<Scalars['String']['output']>;
  remarks?: Maybe<Scalars['String']['output']>;
  serialNumbers: Array<Scalars['String']['output']>;
};

export type GrnLineInput = {
  batchNo?: InputMaybe<Scalars['String']['input']>;
  expiryDate?: InputMaybe<Scalars['Date']['input']>;
  mfgDate?: InputMaybe<Scalars['Date']['input']>;
  productId: Scalars['ID']['input'];
  purchaseOrderLineId?: InputMaybe<Scalars['ID']['input']>;
  quantityAccepted: Scalars['Decimal']['input'];
  quantityDamaged?: InputMaybe<Scalars['Decimal']['input']>;
  quantityReceived: Scalars['Decimal']['input'];
  quantityRejected: Scalars['Decimal']['input'];
  rejectReasonCode?: InputMaybe<Scalars['String']['input']>;
  remarks?: InputMaybe<Scalars['String']['input']>;
  serialNumbers?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type GrnPayload = {
  __typename?: 'GrnPayload';
  /** Set when an excess-approval task was created. */
  approvalTask?: Maybe<ApprovalTask>;
  grn?: Maybe<Grn>;
  userErrors: Array<UserError>;
};

export type GrnReversalLineInput = {
  grnLineId: Scalars['ID']['input'];
  quantity: Scalars['Decimal']['input'];
};

export const GrnStatus = {
  CANCELLED: 'CANCELLED',
  DRAFT: 'DRAFT',
  PENDING_EXCESS_APPROVAL: 'PENDING_EXCESS_APPROVAL',
  PENDING_INSPECTION: 'PENDING_INSPECTION',
  POSTED: 'POSTED',
  REVERSED: 'REVERSED',
  VERIFIED: 'VERIFIED',
} as const;

export type GrnStatus = (typeof GrnStatus)[keyof typeof GrnStatus];
export const GrnType = {
  NO_PO: 'NO_PO',
  PO: 'PO',
} as const;

export type GrnType = (typeof GrnType)[keyof typeof GrnType];
export type GrnVerification = {
  __typename?: 'GrnVerification';
  remarks?: Maybe<Scalars['String']['output']>;
  status: Scalars['String']['output'];
  verifiedAt?: Maybe<Scalars['DateTime']['output']>;
  verifiedBy?: Maybe<UserRef>;
};

export type ImportBatch = Node & {
  __typename?: 'ImportBatch';
  completedAt?: Maybe<Scalars['DateTime']['output']>;
  errors: ImportErrorConnection;
  failedRows: Scalars['Int']['output'];
  fileName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  kind: ImportKind;
  processedRows: Scalars['Int']['output'];
  progressPct: Scalars['Float']['output'];
  resultDocument?: Maybe<Document>;
  startedAt?: Maybe<Scalars['DateTime']['output']>;
  status: ImportStatus;
  succeededRows: Scalars['Int']['output'];
  totalRows: Scalars['Int']['output'];
  uploadedBy: UserRef;
};

export type ImportBatchErrorsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};

export type ImportError = {
  __typename?: 'ImportError';
  critical: Scalars['Boolean']['output'];
  field?: Maybe<Scalars['String']['output']>;
  message: Scalars['String']['output'];
  rowIndex: Scalars['Int']['output'];
  rule: Scalars['String']['output'];
  suggestion?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

export type ImportErrorConnection = {
  __typename?: 'ImportErrorConnection';
  edges: Array<ImportErrorEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type ImportErrorEdge = {
  __typename?: 'ImportErrorEdge';
  cursor: Scalars['String']['output'];
  node: ImportError;
};

export const ImportKind = {
  INDENT_BULK: 'INDENT_BULK',
  MPP_MASTER: 'MPP_MASTER',
  OPENING_STOCK: 'OPENING_STOCK',
  PRODUCT_MAPPING: 'PRODUCT_MAPPING',
  RECON_SHEET: 'RECON_SHEET',
  SAP_ORDER_DEMAND: 'SAP_ORDER_DEMAND',
  SAP_PO: 'SAP_PO',
  SAP_SALES: 'SAP_SALES',
  STOCK_CORRECTED: 'STOCK_CORRECTED',
  STOCK_FILLED: 'STOCK_FILLED',
  STOCK_SALE: 'STOCK_SALE',
  VENDOR_PRODUCT: 'VENDOR_PRODUCT',
} as const;

export type ImportKind = (typeof ImportKind)[keyof typeof ImportKind];
export type ImportPayload = {
  __typename?: 'ImportPayload';
  batch?: Maybe<ImportBatch>;
  userErrors: Array<UserError>;
};

export type ImportProgressEvent = {
  __typename?: 'ImportProgressEvent';
  batchId: Scalars['ID']['output'];
  failedRows: Scalars['Int']['output'];
  processedRows: Scalars['Int']['output'];
  progressPct: Scalars['Float']['output'];
  status: ImportStatus;
};

export const ImportStatus = {
  DISCARDED: 'DISCARDED',
  FAILED: 'FAILED',
  PARTIAL: 'PARTIAL',
  PREVIEW_READY: 'PREVIEW_READY',
  PROCESSED: 'PROCESSED',
  PROCESSED_WITH_EXCEPTIONS: 'PROCESSED_WITH_EXCEPTIONS',
  PROCESSING: 'PROCESSING',
  PUBLISHED: 'PUBLISHED',
  SUPERSEDED: 'SUPERSEDED',
  UPLOADED: 'UPLOADED',
  VALIDATING: 'VALIDATING',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
} as const;

export type ImportStatus = (typeof ImportStatus)[keyof typeof ImportStatus];
export type Indent = Auditable &
  Node & {
    __typename?: 'Indent';
    approval?: Maybe<WorkflowInstance>;
    attachments: Array<Document>;
    budgetCode?: Maybe<Scalars['String']['output']>;
    canCancel: Scalars['Boolean']['output'];
    canEdit: Scalars['Boolean']['output'];
    createdAt: Scalars['DateTime']['output'];
    createdBy?: Maybe<UserRef>;
    department?: Maybe<Department>;
    estimatedTotal: Money;
    grns: Array<Grn>;
    id: Scalars['ID']['output'];
    /** Null while DRAFT. */
    indentNumber?: Maybe<Scalars['String']['output']>;
    justification?: Maybe<Scalars['String']['output']>;
    legacyRequisitionNumber?: Maybe<Scalars['String']['output']>;
    lines: Array<IndentLine>;
    location: Location;
    priority: Priority;
    purchaseOrders: Array<PurchaseOrder>;
    remarks?: Maybe<Scalars['String']['output']>;
    requestedBy: UserRef;
    requestedForEmployeeCode?: Maybe<Scalars['String']['output']>;
    requiredBy?: Maybe<Scalars['Date']['output']>;
    status: IndentStatus;
    stns: Array<Stn>;
    submittedAt?: Maybe<Scalars['DateTime']['output']>;
    timeline: Array<TimelineEvent>;
    updatedAt?: Maybe<Scalars['DateTime']['output']>;
    updatedBy?: Maybe<UserRef>;
    version: Scalars['Int']['output'];
  };

export type IndentConnection = {
  __typename?: 'IndentConnection';
  edges: Array<IndentEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type IndentEdge = {
  __typename?: 'IndentEdge';
  cursor: Scalars['String']['output'];
  node: Indent;
};

export type IndentFilter = {
  departmentIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  lineStatus?: InputMaybe<Array<IndentLineStatus>>;
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  mine?: InputMaybe<Scalars['Boolean']['input']>;
  priority?: InputMaybe<Array<Priority>>;
  productId?: InputMaybe<Scalars['ID']['input']>;
  requestedById?: InputMaybe<Scalars['ID']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Array<IndentStatus>>;
  submittedAt?: InputMaybe<DateRangeInput>;
};

export type IndentLine = Node & {
  __typename?: 'IndentLine';
  availableAtRequestingLocation?: Maybe<Scalars['Decimal']['output']>;
  estimatedAmount?: Maybe<Money>;
  estimatedUnitPrice?: Maybe<Money>;
  expectedDeliveryDate?: Maybe<Scalars['Date']['output']>;
  id: Scalars['ID']['output'];
  lineNo: Scalars['Int']['output'];
  product: Product;
  productName: Scalars['String']['output'];
  quantityApproved?: Maybe<Scalars['Decimal']['output']>;
  quantityOrdered?: Maybe<Scalars['Decimal']['output']>;
  quantityReceived?: Maybe<Scalars['Decimal']['output']>;
  quantityRejected?: Maybe<Scalars['Decimal']['output']>;
  quantityRequested: Quantity;
  quantityTransferred?: Maybe<Scalars['Decimal']['output']>;
  remark?: Maybe<Scalars['String']['output']>;
  /** Internal remark is never shown to vendors. */
  remarkInternal: Scalars['Boolean']['output'];
  status: IndentLineStatus;
};

export type IndentLineAllocationInput = {
  indentLineId: Scalars['ID']['input'];
  quantity: Scalars['Decimal']['input'];
};

export type IndentLineInput = {
  /** Client-generated ID for offline correlation and idempotent line upsert. */
  clientLineId?: InputMaybe<Scalars['UUID']['input']>;
  estimatedUnitPrice?: InputMaybe<Scalars['Decimal']['input']>;
  expectedDeliveryDate?: InputMaybe<Scalars['Date']['input']>;
  productId: Scalars['ID']['input'];
  quantity: Scalars['Decimal']['input'];
  remark?: InputMaybe<Scalars['String']['input']>;
  remarkInternal?: InputMaybe<Scalars['Boolean']['input']>;
  uomId: Scalars['ID']['input'];
};

export const IndentLineStatus = {
  APPROVED: 'APPROVED',
  APPROVED_FOR_TRANSFER: 'APPROVED_FOR_TRANSFER',
  CANCELLED: 'CANCELLED',
  CLOSED_SHORT: 'CLOSED_SHORT',
  DRAFT: 'DRAFT',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  PO_CREATED: 'PO_CREATED',
  RECEIVED: 'RECEIVED',
  REJECTED: 'REJECTED',
  RETURNED: 'RETURNED',
  STN_ISSUED: 'STN_ISSUED',
} as const;

export type IndentLineStatus = (typeof IndentLineStatus)[keyof typeof IndentLineStatus];
export type IndentLineStatusChange = {
  __typename?: 'IndentLineStatusChange';
  lineId: Scalars['ID']['output'];
  previousStatus?: Maybe<IndentLineStatus>;
  status: IndentLineStatus;
};

export type IndentPayload = {
  __typename?: 'IndentPayload';
  indent?: Maybe<Indent>;
  userErrors: Array<UserError>;
};

export type IndentSort = {
  direction: SortDirection;
  field: IndentSortField;
};

export const IndentSortField = {
  ESTIMATED_TOTAL: 'ESTIMATED_TOTAL',
  INDENT_NUMBER: 'INDENT_NUMBER',
  PRIORITY: 'PRIORITY',
  REQUIRED_BY: 'REQUIRED_BY',
  SUBMITTED_AT: 'SUBMITTED_AT',
} as const;

export type IndentSortField = (typeof IndentSortField)[keyof typeof IndentSortField];
export const IndentStatus = {
  APPROVED: 'APPROVED',
  CANCELLED: 'CANCELLED',
  CLOSED: 'CLOSED',
  DRAFT: 'DRAFT',
  FULFILLED: 'FULFILLED',
  IN_FULFILMENT: 'IN_FULFILMENT',
  PARTIALLY_APPROVED: 'PARTIALLY_APPROVED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  REJECTED: 'REJECTED',
  RETURNED: 'RETURNED',
} as const;

export type IndentStatus = (typeof IndentStatus)[keyof typeof IndentStatus];
export type IndentStatusEvent = {
  __typename?: 'IndentStatusEvent';
  actor?: Maybe<UserRef>;
  indentId: Scalars['ID']['output'];
  indentNumber?: Maybe<Scalars['String']['output']>;
  lineChanges: Array<IndentLineStatusChange>;
  occurredAt: Scalars['DateTime']['output'];
  previousStatus?: Maybe<IndentStatus>;
  status: IndentStatus;
};

export type InventoryConnection = {
  __typename?: 'InventoryConnection';
  edges: Array<StockBalanceEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
  totals: InventoryTotals;
};

export type InventoryEvent = {
  __typename?: 'InventoryEvent';
  available: Scalars['Decimal']['output'];
  locationId: Scalars['ID']['output'];
  movementType: MovementType;
  occurredAt: Scalars['DateTime']['output'];
  productId: Scalars['ID']['output'];
  quantityDelta: Scalars['Decimal']['output'];
  sourceNumber?: Maybe<Scalars['String']['output']>;
  warehouseId: Scalars['ID']['output'];
};

export type InventoryFilter = {
  bands?: InputMaybe<Array<StockBand>>;
  categoryIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  /** Include locations flagged as excluded from cross-location view. */
  includeExcluded?: InputMaybe<Scalars['Boolean']['input']>;
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  onlyNonZero?: InputMaybe<Scalars['Boolean']['input']>;
  productIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  search?: InputMaybe<Scalars['String']['input']>;
  warehouseIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type InventorySort = {
  direction: SortDirection;
  field: InventorySortField;
};

export const InventorySortField = {
  AVAILABLE: 'AVAILABLE',
  LAST_MOVEMENT: 'LAST_MOVEMENT',
  PRODUCT_NAME: 'PRODUCT_NAME',
  VALUE: 'VALUE',
} as const;

export type InventorySortField = (typeof InventorySortField)[keyof typeof InventorySortField];
export type InventoryTotals = {
  __typename?: 'InventoryTotals';
  highCount: Scalars['Int']['output'];
  lowCount: Scalars['Int']['output'];
  mediumCount: Scalars['Int']['output'];
  outOfStockCount: Scalars['Int']['output'];
  quantity: Scalars['Decimal']['output'];
  value: Money;
};

export type Invoice = Auditable &
  Node & {
    __typename?: 'Invoice';
    createdAt: Scalars['DateTime']['output'];
    createdBy?: Maybe<UserRef>;
    documents: Array<Document>;
    grandTotal: Money;
    id: Scalars['ID']['output'];
    invoiceDate: Scalars['Date']['output'];
    invoiceNumber: Scalars['String']['output'];
    lines: Array<InvoiceLine>;
    paymentStatus: PaymentStatus;
    payments: Array<PaymentRecord>;
    purchaseOrder?: Maybe<PurchaseOrder>;
    status: InvoiceStatus;
    subtotal: Money;
    taxTotal: Money;
    updatedAt?: Maybe<Scalars['DateTime']['output']>;
    updatedBy?: Maybe<UserRef>;
    vendor: Vendor;
    version: Scalars['Int']['output'];
  };

export type InvoiceConnection = {
  __typename?: 'InvoiceConnection';
  edges: Array<InvoiceEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type InvoiceEdge = {
  __typename?: 'InvoiceEdge';
  cursor: Scalars['String']['output'];
  node: Invoice;
};

export const InvoiceExceptionAction = {
  APPROVE: 'APPROVE',
  HOLD: 'HOLD',
  REJECT: 'REJECT',
  REQUEST_CREDIT_NOTE: 'REQUEST_CREDIT_NOTE',
} as const;

export type InvoiceExceptionAction =
  (typeof InvoiceExceptionAction)[keyof typeof InvoiceExceptionAction];
export type InvoiceFilter = {
  invoiceDate?: InputMaybe<DateRangeInput>;
  paymentStatus?: InputMaybe<Array<PaymentStatus>>;
  search?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Array<InvoiceStatus>>;
  vendorIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type InvoiceLine = {
  __typename?: 'InvoiceLine';
  amount: Money;
  id: Scalars['ID']['output'];
  match?: Maybe<MatchResult>;
  product?: Maybe<Product>;
  purchaseOrderLine?: Maybe<PurchaseOrderLine>;
  quantity: Scalars['Decimal']['output'];
  taxPct: Scalars['Decimal']['output'];
  unitPrice: Money;
};

export type InvoiceLineInput = {
  grnLineIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  productId?: InputMaybe<Scalars['ID']['input']>;
  purchaseOrderLineId?: InputMaybe<Scalars['ID']['input']>;
  quantity: Scalars['Decimal']['input'];
  taxPct: Scalars['Decimal']['input'];
  unitPrice: Scalars['Decimal']['input'];
};

export type InvoicePayload = {
  __typename?: 'InvoicePayload';
  invoice?: Maybe<Invoice>;
  userErrors: Array<UserError>;
};

export const InvoiceStatus = {
  APPROVED: 'APPROVED',
  DRAFT: 'DRAFT',
  EXCEPTION: 'EXCEPTION',
  MATCHED: 'MATCHED',
  ON_HOLD: 'ON_HOLD',
  REJECTED: 'REJECTED',
  SUBMITTED: 'SUBMITTED',
} as const;

export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];
export type KpiValue = {
  __typename?: 'KpiValue';
  key: Scalars['String']['output'];
  label: Scalars['String']['output'];
  link?: Maybe<Scalars['String']['output']>;
  /** Change vs previous period, percentage. */
  trendPct?: Maybe<Scalars['Decimal']['output']>;
  unit?: Maybe<Scalars['String']['output']>;
  value: Scalars['Decimal']['output'];
};

export type LineDecisionInput = {
  /** Approved quantity ≤ requested; omit to approve full remaining quantity. */
  approvedQuantity?: InputMaybe<Scalars['Decimal']['input']>;
  lineId: Scalars['ID']['input'];
  /** Required for APPROVE_FOR_TRANSFER. */
  transferSources?: InputMaybe<Array<TransferSourceInput>>;
};

export const Locale = {
  EN: 'EN',
  HI: 'HI',
} as const;

export type Locale = (typeof Locale)[keyof typeof Locale];
export type Location = Node & {
  __typename?: 'Location';
  active: Scalars['Boolean']['output'];
  address?: Maybe<Scalars['String']['output']>;
  code: Scalars['String']['output'];
  excludedFromCrossView: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  nameHi?: Maybe<Scalars['String']['output']>;
  sapPlantCode?: Maybe<Scalars['String']['output']>;
  type: LocationType;
  warehouses: Array<Warehouse>;
};

export type LocationPayload = {
  __typename?: 'LocationPayload';
  location?: Maybe<Location>;
  userErrors: Array<UserError>;
};

export const LocationType = {
  BMC: 'BMC',
  HEAD_OFFICE: 'HEAD_OFFICE',
  MCC: 'MCC',
  OTHER: 'OTHER',
  PLANT: 'PLANT',
  WAREHOUSE: 'WAREHOUSE',
} as const;

export type LocationType = (typeof LocationType)[keyof typeof LocationType];
export type MatchResult = {
  __typename?: 'MatchResult';
  priceInvoiced: Money;
  pricePo?: Maybe<Money>;
  quantityGrnAccepted?: Maybe<Scalars['Decimal']['output']>;
  quantityInvoiced: Scalars['Decimal']['output'];
  quantityPo?: Maybe<Scalars['Decimal']['output']>;
  resolution?: Maybe<Scalars['String']['output']>;
  resolvedBy?: Maybe<UserRef>;
  status: MatchStatus;
  varianceAmount: Money;
};

export const MatchStatus = {
  MATCHED: 'MATCHED',
  MISSING_GRN: 'MISSING_GRN',
  MISSING_PO: 'MISSING_PO',
  PRICE_MISMATCH: 'PRICE_MISMATCH',
  QTY_MISMATCH: 'QTY_MISMATCH',
} as const;

export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];
export type MessagingAnalytics = {
  __typename?: 'MessagingAnalytics';
  delivered: Scalars['Int']['output'];
  failed: Scalars['Int']['output'];
  medianTimeToReadSeconds?: Maybe<Scalars['Int']['output']>;
  notRegistered: Scalars['Int']['output'];
  read: Scalars['Int']['output'];
  sent: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type Money = {
  __typename?: 'Money';
  amount: Scalars['Decimal']['output'];
  currency: Scalars['CurrencyCode']['output'];
};

export const MovementType = {
  ADJUSTMENT_IN: 'ADJUSTMENT_IN',
  ADJUSTMENT_OUT: 'ADJUSTMENT_OUT',
  CORRECTION: 'CORRECTION',
  DAMAGE: 'DAMAGE',
  DISPOSAL: 'DISPOSAL',
  EXPIRY: 'EXPIRY',
  GRN_RECEIPT: 'GRN_RECEIPT',
  GRN_REVERSAL: 'GRN_REVERSAL',
  ISSUE_ADVANCE_SALE: 'ISSUE_ADVANCE_SALE',
  ISSUE_GENERAL_SALE: 'ISSUE_GENERAL_SALE',
  ISSUE_INTERNAL: 'ISSUE_INTERNAL',
  ISSUE_OTHER_SALE: 'ISSUE_OTHER_SALE',
  OPENING: 'OPENING',
  RETURN_FROM_MPP: 'RETURN_FROM_MPP',
  RETURN_TO_VENDOR: 'RETURN_TO_VENDOR',
  SALE_REVERSAL: 'SALE_REVERSAL',
  TRANSFER_IN: 'TRANSFER_IN',
  TRANSFER_OUT: 'TRANSFER_OUT',
  TRANSIT_IN: 'TRANSIT_IN',
  TRANSIT_OUT: 'TRANSIT_OUT',
  TRANSIT_WRITE_OFF: 'TRANSIT_WRITE_OFF',
} as const;

export type MovementType = (typeof MovementType)[keyof typeof MovementType];
export type Mpp = Node & {
  __typename?: 'Mpp';
  bmc: Location;
  code: Scalars['String']['output'];
  cycleBand?: Maybe<CycleBand>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  sahayakMobile?: Maybe<Scalars['PhoneNumber']['output']>;
  sahayakName?: Maybe<Scalars['String']['output']>;
  status: MppStatus;
  village?: Maybe<Scalars['String']['output']>;
};

export type MppConnection = {
  __typename?: 'MppConnection';
  edges: Array<MppEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type MppEdge = {
  __typename?: 'MppEdge';
  cursor: Scalars['String']['output'];
  node: Mpp;
};

export type MppFilter = {
  bmcLocationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  search?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Array<MppStatus>>;
};

export type MppLedgerConnection = {
  __typename?: 'MppLedgerConnection';
  edges: Array<MppLedgerEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type MppLedgerEdge = {
  __typename?: 'MppLedgerEdge';
  cursor: Scalars['String']['output'];
  node: MppProductLedgerEntry;
};

export type MppLedgerFilter = {
  cycleIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  month?: InputMaybe<Scalars['Int']['input']>;
  mppIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  nonZeroOnly?: InputMaybe<Scalars['Boolean']['input']>;
  productIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  search?: InputMaybe<Scalars['String']['input']>;
  year?: InputMaybe<Scalars['Int']['input']>;
};

export type MppPayload = {
  __typename?: 'MppPayload';
  mpp?: Maybe<Mpp>;
  userErrors: Array<UserError>;
};

export type MppProductLedgerEntry = {
  __typename?: 'MppProductLedgerEntry';
  advanceQuantity: Scalars['Decimal']['output'];
  balanceMeaning: Scalars['String']['output'];
  closingBalance: Scalars['Decimal']['output'];
  cycle: PaymentCycle;
  mpp: Mpp;
  openingBalance: Scalars['Decimal']['output'];
  product: Product;
  sapQuantity: Scalars['Decimal']['output'];
};

export const MppStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type MppStatus = (typeof MppStatus)[keyof typeof MppStatus];
export type Mutation = {
  __typename?: 'Mutation';
  acknowledgeReconciliation: ReconciliationPayload;
  activateCycle: CyclePayload;
  approveIndent: ApprovalPayload;
  approveIndentForTransfer: ApprovalPayload;
  bulkApprovalAction: BulkApprovalPayload;
  cancelAdvanceSale: AdvanceSalePayload;
  cancelGrn: GrnPayload;
  cancelIndent: IndentPayload;
  cancelPurchaseOrder: PurchaseOrderPayload;
  cancelTransferOrder: TransferOrderPayload;
  changeStockCondition: Scalars['Boolean']['output'];
  closeCycle: CyclePayload;
  commitImport: ImportPayload;
  copyIndent: IndentPayload;
  createAdvanceSale: AdvanceSalePayload;
  createCycleMonth: CycleMonthPayload;
  createDelegation: DelegationPayload;
  createGeneralSale: GeneralSalePayload;
  createGrn: GrnPayload;
  createIndent: IndentPayload;
  createInvoice: InvoicePayload;
  createOtherSale: OtherSalePayload;
  createPurchaseOrder: PurchaseOrderPayload;
  createStn: StnPayload;
  createTransferOrder: TransferOrderPayload;
  createUser: UserPayload;
  decidePurchaseOrder: PurchaseOrderPayload;
  decideStockAdjustment: StockAdjustmentPayload;
  deleteCycle: DeletePayload;
  deleteDocument: DeletePayload;
  deleteIndentDraft: DeletePayload;
  deleteSavedFilter: DeletePayload;
  deleteStnDraft: DeletePayload;
  discardImport: ImportPayload;
  dispatchGeneralSale: GeneralSalePayload;
  dispatchStn: StnPayload;
  forcePasswordReset: UserPayload;
  generateSapOrderFiles: SapOrderGeneration;
  generateStockStatement: StockStatementPayload;
  linkDocument: Document;
  markNotificationsRead: Scalars['Int']['output'];
  postGrn: GrnPayload;
  postStn: StnPayload;
  publishReconciliation: ReconciliationPayload;
  publishWorkflowVersion: WorkflowVersionPayload;
  reassignApprovalTask: ApprovalPayload;
  receiveStn: StnPayload;
  recordPayment: InvoicePayload;
  recordStockCount: StockCountPayload;
  regenerateSaleReceipt: AdvanceSalePayload;
  registerPushDevice: Scalars['Boolean']['output'];
  rejectIndent: ApprovalPayload;
  rematchInvoice: InvoicePayload;
  removeReportProduct: Array<ReportProduct>;
  reopenCycle: CyclePayload;
  replayDeadLetter: Scalars['Boolean']['output'];
  requestExport: ExportPayload;
  requestStockAdjustment: StockAdjustmentPayload;
  resendNotification: NotificationDelivery;
  resolveInvoiceException: InvoicePayload;
  resolveReconciliationException: ReconciliationPayload;
  resolveTransitDiscrepancy: DiscrepancyPayload;
  returnIndent: ApprovalPayload;
  reverseGrn: GrnPayload;
  revokeAllMySessions: Scalars['Int']['output'];
  revokeDelegation: DelegationPayload;
  revokeSession: Scalars['Boolean']['output'];
  saveFilter: SavedFilter;
  saveLocation: LocationPayload;
  saveMpp: MppPayload;
  saveNotificationTemplate: NotificationTemplatePayload;
  savePhysicalCount: Array<PhysicalCount>;
  saveProduct: ProductPayload;
  saveRole: RolePayload;
  saveSapMaterialMapping: SapMaterialMapping;
  saveStockStatementRows: StockStatementPayload;
  saveVendor: VendorPayload;
  saveWorkflowDraft: WorkflowVersionPayload;
  sendPurchaseOrder: PurchaseOrderPayload;
  setFeatureFlag: FeatureFlag;
  setMonthLock: CycleMonthPayload;
  setStockReportOpenColumns: StockStatementPayload;
  setUserRoles: UserPayload;
  setVendorProducts: VendorPayload;
  shortClosePurchaseOrder: PurchaseOrderPayload;
  startImport: ImportPayload;
  startStockCount: StockCountPayload;
  submitIndent: IndentPayload;
  submitPurchaseOrder: PurchaseOrderPayload;
  submitStockCount: StockCountPayload;
  unlockUser: UserPayload;
  unregisterPushDevice: Scalars['Boolean']['output'];
  updateIndent: IndentPayload;
  updateNotificationPreferences: Array<NotificationPreference>;
  updateNumberSeries: NumberSeriesPayload;
  updatePurchaseOrder: PurchaseOrderPayload;
  updateSetting: SettingPayload;
  updateUser: UserPayload;
  uploadPod: PodPayload;
  upsertCycle: CyclePayload;
  upsertReportProduct: Array<ReportProduct>;
  verifyGrn: GrnPayload;
};

export type MutationAcknowledgeReconciliationArgs = {
  input: AcknowledgeReconciliationInput;
};

export type MutationActivateCycleArgs = {
  id: Scalars['ID']['input'];
};

export type MutationApproveIndentArgs = {
  input: ApproveIndentInput;
};

export type MutationApproveIndentForTransferArgs = {
  input: ApproveIndentForTransferInput;
};

export type MutationBulkApprovalActionArgs = {
  input: BulkApprovalInput;
};

export type MutationCancelAdvanceSaleArgs = {
  input: CancelAdvanceSaleInput;
};

export type MutationCancelGrnArgs = {
  input: CancelGrnInput;
};

export type MutationCancelIndentArgs = {
  input: CancelIndentInput;
};

export type MutationCancelPurchaseOrderArgs = {
  input: CancelPurchaseOrderInput;
};

export type MutationCancelTransferOrderArgs = {
  id: Scalars['ID']['input'];
  reason: Scalars['String']['input'];
};

export type MutationChangeStockConditionArgs = {
  input: ChangeStockConditionInput;
};

export type MutationCloseCycleArgs = {
  id: Scalars['ID']['input'];
};

export type MutationCommitImportArgs = {
  input: CommitImportInput;
};

export type MutationCopyIndentArgs = {
  id: Scalars['ID']['input'];
};

export type MutationCreateAdvanceSaleArgs = {
  input: CreateAdvanceSaleInput;
};

export type MutationCreateCycleMonthArgs = {
  input: CreateCycleMonthInput;
};

export type MutationCreateDelegationArgs = {
  input: CreateDelegationInput;
};

export type MutationCreateGeneralSaleArgs = {
  input: CreateGeneralSaleInput;
};

export type MutationCreateGrnArgs = {
  input: CreateGrnInput;
};

export type MutationCreateIndentArgs = {
  input: CreateIndentInput;
};

export type MutationCreateInvoiceArgs = {
  input: CreateInvoiceInput;
};

export type MutationCreateOtherSaleArgs = {
  input: CreateOtherSaleInput;
};

export type MutationCreatePurchaseOrderArgs = {
  input: CreatePurchaseOrderInput;
};

export type MutationCreateStnArgs = {
  input: CreateStnInput;
};

export type MutationCreateTransferOrderArgs = {
  input: CreateTransferOrderInput;
};

export type MutationCreateUserArgs = {
  input: CreateUserInput;
};

export type MutationDecidePurchaseOrderArgs = {
  input: ApprovePurchaseOrderInput;
};

export type MutationDecideStockAdjustmentArgs = {
  input: DecideStockAdjustmentInput;
};

export type MutationDeleteCycleArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeleteDocumentArgs = {
  id: Scalars['ID']['input'];
  reason: Scalars['String']['input'];
};

export type MutationDeleteIndentDraftArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeleteSavedFilterArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeleteStnDraftArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDiscardImportArgs = {
  batchId: Scalars['ID']['input'];
};

export type MutationDispatchGeneralSaleArgs = {
  input: DispatchGeneralSaleInput;
};

export type MutationDispatchStnArgs = {
  input: DispatchStnInput;
};

export type MutationForcePasswordResetArgs = {
  id: Scalars['ID']['input'];
};

export type MutationGenerateSapOrderFilesArgs = {
  input: SapOrderGenerateInput;
};

export type MutationGenerateStockStatementArgs = {
  cycleId: Scalars['ID']['input'];
};

export type MutationLinkDocumentArgs = {
  documentId: Scalars['ID']['input'];
  entityId: Scalars['ID']['input'];
  entityType: Scalars['String']['input'];
  role?: InputMaybe<Scalars['String']['input']>;
};

export type MutationMarkNotificationsReadArgs = {
  all?: InputMaybe<Scalars['Boolean']['input']>;
  ids?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type MutationPostGrnArgs = {
  input: PostGrnInput;
};

export type MutationPostStnArgs = {
  input: PostStnInput;
};

export type MutationPublishReconciliationArgs = {
  sheetId: Scalars['ID']['input'];
};

export type MutationPublishWorkflowVersionArgs = {
  versionId: Scalars['ID']['input'];
};

export type MutationReassignApprovalTaskArgs = {
  assigneeUserId: Scalars['ID']['input'];
  reason: Scalars['String']['input'];
  taskId: Scalars['ID']['input'];
};

export type MutationReceiveStnArgs = {
  input: ReceiveStnInput;
};

export type MutationRecordPaymentArgs = {
  input: RecordPaymentInput;
};

export type MutationRecordStockCountArgs = {
  input: RecordStockCountInput;
};

export type MutationRegenerateSaleReceiptArgs = {
  id: Scalars['ID']['input'];
};

export type MutationRegisterPushDeviceArgs = {
  input: RegisterPushDeviceInput;
};

export type MutationRejectIndentArgs = {
  input: RejectIndentInput;
};

export type MutationRematchInvoiceArgs = {
  id: Scalars['ID']['input'];
};

export type MutationRemoveReportProductArgs = {
  productId: Scalars['ID']['input'];
};

export type MutationReopenCycleArgs = {
  id: Scalars['ID']['input'];
  reason: Scalars['String']['input'];
};

export type MutationReplayDeadLetterArgs = {
  id: Scalars['ID']['input'];
};

export type MutationRequestExportArgs = {
  input: RequestExportInput;
};

export type MutationRequestStockAdjustmentArgs = {
  input: RequestStockAdjustmentInput;
};

export type MutationResendNotificationArgs = {
  deliveryId: Scalars['ID']['input'];
};

export type MutationResolveInvoiceExceptionArgs = {
  input: ResolveInvoiceExceptionInput;
};

export type MutationResolveReconciliationExceptionArgs = {
  input: ResolveReconciliationExceptionInput;
};

export type MutationResolveTransitDiscrepancyArgs = {
  input: ResolveDiscrepancyInput;
};

export type MutationReturnIndentArgs = {
  input: ReturnIndentInput;
};

export type MutationReverseGrnArgs = {
  input: ReverseGrnInput;
};

export type MutationRevokeDelegationArgs = {
  id: Scalars['ID']['input'];
};

export type MutationRevokeSessionArgs = {
  id: Scalars['ID']['input'];
};

export type MutationSaveFilterArgs = {
  input: SaveFilterInput;
};

export type MutationSaveLocationArgs = {
  input: SaveLocationInput;
};

export type MutationSaveMppArgs = {
  input: SaveMppInput;
};

export type MutationSaveNotificationTemplateArgs = {
  input: SaveNotificationTemplateInput;
};

export type MutationSavePhysicalCountArgs = {
  input: SavePhysicalCountInput;
};

export type MutationSaveProductArgs = {
  input: SaveProductInput;
};

export type MutationSaveRoleArgs = {
  input: SaveRoleInput;
};

export type MutationSaveSapMaterialMappingArgs = {
  input: SaveSapMaterialMappingInput;
};

export type MutationSaveStockStatementRowsArgs = {
  input: SaveStockStatementRowsInput;
};

export type MutationSaveVendorArgs = {
  input: SaveVendorInput;
};

export type MutationSaveWorkflowDraftArgs = {
  input: SaveWorkflowDraftInput;
};

export type MutationSendPurchaseOrderArgs = {
  input: SendPurchaseOrderInput;
};

export type MutationSetFeatureFlagArgs = {
  input: SetFeatureFlagInput;
};

export type MutationSetMonthLockArgs = {
  input: SetMonthLockInput;
};

export type MutationSetStockReportOpenColumnsArgs = {
  input: SetStockReportOpenColumnsInput;
};

export type MutationSetUserRolesArgs = {
  input: SetUserRolesInput;
};

export type MutationSetVendorProductsArgs = {
  input: SetVendorProductsInput;
};

export type MutationShortClosePurchaseOrderArgs = {
  input: ShortClosePurchaseOrderInput;
};

export type MutationStartImportArgs = {
  input: StartImportInput;
};

export type MutationStartStockCountArgs = {
  input: StartStockCountInput;
};

export type MutationSubmitIndentArgs = {
  input: SubmitIndentInput;
};

export type MutationSubmitPurchaseOrderArgs = {
  input: SubmitPurchaseOrderInput;
};

export type MutationSubmitStockCountArgs = {
  countId: Scalars['ID']['input'];
};

export type MutationUnlockUserArgs = {
  id: Scalars['ID']['input'];
};

export type MutationUnregisterPushDeviceArgs = {
  token: Scalars['String']['input'];
};

export type MutationUpdateIndentArgs = {
  input: UpdateIndentInput;
};

export type MutationUpdateNotificationPreferencesArgs = {
  input: Array<NotificationPreferenceInput>;
};

export type MutationUpdateNumberSeriesArgs = {
  input: UpdateNumberSeriesInput;
};

export type MutationUpdatePurchaseOrderArgs = {
  input: UpdatePurchaseOrderInput;
};

export type MutationUpdateSettingArgs = {
  input: UpdateSettingInput;
};

export type MutationUpdateUserArgs = {
  input: UpdateUserInput;
};

export type MutationUploadPodArgs = {
  input: UploadPodInput;
};

export type MutationUpsertCycleArgs = {
  input: UpsertCycleInput;
};

export type MutationUpsertReportProductArgs = {
  input: UpsertReportProductInput;
};

export type MutationVerifyGrnArgs = {
  input: VerifyGrnInput;
};

export type Node = {
  /** Opaque global ID. */
  id: Scalars['ID']['output'];
};

export type Notification = Node & {
  __typename?: 'Notification';
  body: Scalars['String']['output'];
  category: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  link?: Maybe<Scalars['String']['output']>;
  priority: NotificationPriority;
  readAt?: Maybe<Scalars['DateTime']['output']>;
  title: Scalars['String']['output'];
};

export const NotificationChannel = {
  EMAIL: 'EMAIL',
  IN_APP: 'IN_APP',
  PUSH: 'PUSH',
  SMS: 'SMS',
} as const;

export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];
export type NotificationConnection = {
  __typename?: 'NotificationConnection';
  edges: Array<NotificationEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
  unreadCount: Scalars['Int']['output'];
};

export type NotificationDelivery = Node & {
  __typename?: 'NotificationDelivery';
  attempts: Scalars['Int']['output'];
  channel: NotificationChannel;
  createdAt: Scalars['DateTime']['output'];
  deliveredAt?: Maybe<Scalars['DateTime']['output']>;
  errorCode?: Maybe<Scalars['String']['output']>;
  errorMessage?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  provider?: Maybe<Scalars['String']['output']>;
  providerMessageId?: Maybe<Scalars['String']['output']>;
  readAt?: Maybe<Scalars['DateTime']['output']>;
  recipientMasked: Scalars['String']['output'];
  sentAt?: Maybe<Scalars['DateTime']['output']>;
  status: DeliveryStatus;
  templateCode: Scalars['String']['output'];
};

export type NotificationDeliveryConnection = {
  __typename?: 'NotificationDeliveryConnection';
  edges: Array<NotificationDeliveryEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type NotificationDeliveryEdge = {
  __typename?: 'NotificationDeliveryEdge';
  cursor: Scalars['String']['output'];
  node: NotificationDelivery;
};

export type NotificationDeliveryFilter = {
  channels?: InputMaybe<Array<NotificationChannel>>;
  createdAt?: InputMaybe<DateTimeRangeInput>;
  search?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Array<DeliveryStatus>>;
  templateCodes?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type NotificationEdge = {
  __typename?: 'NotificationEdge';
  cursor: Scalars['String']['output'];
  node: Notification;
};

export type NotificationFilter = {
  categories?: InputMaybe<Array<Scalars['String']['input']>>;
  unreadOnly?: InputMaybe<Scalars['Boolean']['input']>;
};

export type NotificationPreference = {
  __typename?: 'NotificationPreference';
  category: Scalars['String']['output'];
  channel: NotificationChannel;
  enabled: Scalars['Boolean']['output'];
  mandatory: Scalars['Boolean']['output'];
};

export type NotificationPreferenceInput = {
  category: Scalars['String']['input'];
  channel: NotificationChannel;
  enabled: Scalars['Boolean']['input'];
};

export const NotificationPriority = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  LOW: 'LOW',
  NORMAL: 'NORMAL',
} as const;

export type NotificationPriority = (typeof NotificationPriority)[keyof typeof NotificationPriority];
export type NotificationTemplate = Node & {
  __typename?: 'NotificationTemplate';
  body: Scalars['String']['output'];
  channel: NotificationChannel;
  code: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  locale: Locale;
  providerTemplateName?: Maybe<Scalars['String']['output']>;
  status: Scalars['String']['output'];
  subject?: Maybe<Scalars['String']['output']>;
  variables: Array<Scalars['String']['output']>;
  versionNo: Scalars['Int']['output'];
};

export type NotificationTemplatePayload = {
  __typename?: 'NotificationTemplatePayload';
  template?: Maybe<NotificationTemplate>;
  userErrors: Array<UserError>;
};

export type NumberSeries = Node & {
  __typename?: 'NumberSeries';
  docType: Scalars['String']['output'];
  fiscalYear?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  location?: Maybe<Location>;
  nextValue: Scalars['Int']['output'];
  padding: Scalars['Int']['output'];
  prefix: Scalars['String']['output'];
  preview: Scalars['String']['output'];
  resetPolicy: Scalars['String']['output'];
};

export type NumberSeriesPayload = {
  __typename?: 'NumberSeriesPayload';
  series?: Maybe<NumberSeries>;
  userErrors: Array<UserError>;
};

export type OtherSale = Node & {
  __typename?: 'OtherSale';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  invoice?: Maybe<Document>;
  invoiceNumber: Scalars['String']['output'];
  lines: Array<AdvanceSaleLine>;
  location: Location;
  partyAddress?: Maybe<Scalars['String']['output']>;
  partyName: Scalars['String']['output'];
  pod?: Maybe<Pod>;
  saleNumber: Scalars['String']['output'];
};

export type OtherSaleLineInput = {
  productId: Scalars['ID']['input'];
  quantity: Scalars['Decimal']['input'];
  unitPrice: Scalars['Decimal']['input'];
  uomId: Scalars['ID']['input'];
};

export type OtherSalePayload = {
  __typename?: 'OtherSalePayload';
  otherSale?: Maybe<OtherSale>;
  userErrors: Array<UserError>;
};

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor?: Maybe<Scalars['String']['output']>;
};

export type PaginationInput = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  /** Max 100, default 20. */
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type PaymentCycle = Node & {
  __typename?: 'PaymentCycle';
  cycleMonth: CycleMonth;
  cycleNo: Scalars['Int']['output'];
  durationDays: Scalars['Int']['output'];
  endDate: Scalars['Date']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  sapCycleNumber?: Maybe<Scalars['String']['output']>;
  startDate: Scalars['Date']['output'];
  status: CycleStatus;
};

export type PaymentRecord = {
  __typename?: 'PaymentRecord';
  amount: Money;
  id: Scalars['ID']['output'];
  mode?: Maybe<Scalars['String']['output']>;
  paidOn: Scalars['Date']['output'];
  reference: Scalars['String']['output'];
};

export const PaymentStatus = {
  PAID: 'PAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  SCHEDULED: 'SCHEDULED',
  UNPAID: 'UNPAID',
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
export type PhysicalCount = {
  __typename?: 'PhysicalCount';
  bookQuantity: Scalars['Decimal']['output'];
  countedAt?: Maybe<Scalars['DateTime']['output']>;
  physicalQuantity?: Maybe<Scalars['Int']['output']>;
  product: Product;
  variance?: Maybe<Scalars['Decimal']['output']>;
};

export type PhysicalCountInput = {
  /** Null clears the count. */
  physicalQuantity?: InputMaybe<Scalars['Int']['input']>;
  productId: Scalars['ID']['input'];
};

export type Pod = Node & {
  __typename?: 'Pod';
  capturedAt: Scalars['DateTime']['output'];
  document: Document;
  id: Scalars['ID']['output'];
  latitude?: Maybe<Scalars['Float']['output']>;
  longitude?: Maybe<Scalars['Float']['output']>;
  uploadedBy: UserRef;
};

export type PodPayload = {
  __typename?: 'PodPayload';
  pod?: Maybe<Pod>;
  userErrors: Array<UserError>;
};

export const PodStatus = {
  NOT_REQUIRED: 'NOT_REQUIRED',
  PENDING: 'PENDING',
  UPLOADED: 'UPLOADED',
} as const;

export type PodStatus = (typeof PodStatus)[keyof typeof PodStatus];
export const PodSubjectType = {
  ADVANCE_SALE: 'ADVANCE_SALE',
  GENERAL_SALE: 'GENERAL_SALE',
  OTHER_SALE: 'OTHER_SALE',
  STN: 'STN',
} as const;

export type PodSubjectType = (typeof PodSubjectType)[keyof typeof PodSubjectType];
export type PostGrnInput = {
  expectedVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
};

export type PostStnInput = {
  expectedVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  idempotencyKey: Scalars['UUID']['input'];
};

export const Priority = {
  HIGH: 'HIGH',
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  URGENT: 'URGENT',
} as const;

export type Priority = (typeof Priority)[keyof typeof Priority];
export type ProcurementQueueConnection = {
  __typename?: 'ProcurementQueueConnection';
  edges: Array<ProcurementQueueEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type ProcurementQueueEdge = {
  __typename?: 'ProcurementQueueEdge';
  cursor: Scalars['String']['output'];
  node: ProcurementQueueItem;
};

export type ProcurementQueueFilter = {
  approvedAt?: InputMaybe<DateRangeInput>;
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  productIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  search?: InputMaybe<Scalars['String']['input']>;
  vendorId?: InputMaybe<Scalars['ID']['input']>;
};

export type ProcurementQueueItem = {
  __typename?: 'ProcurementQueueItem';
  approvedAt?: Maybe<Scalars['DateTime']['output']>;
  approvedBy?: Maybe<UserRef>;
  indent: Indent;
  indentLine: IndentLine;
  remainingQuantity: Scalars['Decimal']['output'];
  suggestedVendors: Array<VendorProduct>;
};

export type Product = Auditable &
  Node & {
    __typename?: 'Product';
    baseUom: Uom;
    batchTracked: Scalars['Boolean']['output'];
    category?: Maybe<ProductCategory>;
    code: Scalars['String']['output'];
    createdAt: Scalars['DateTime']['output'];
    createdBy?: Maybe<UserRef>;
    /** Display name per caller's configured system preference (e.g. NDDB → SAP → internal). */
    displayName: Scalars['String']['output'];
    externalCodes: Array<ExternalProductCode>;
    hsnCode?: Maybe<Scalars['String']['output']>;
    id: Scalars['ID']['output'];
    isService: Scalars['Boolean']['output'];
    isStockItem: Scalars['Boolean']['output'];
    materialType?: Maybe<Scalars['String']['output']>;
    name: Scalars['String']['output'];
    nameHi?: Maybe<Scalars['String']['output']>;
    owner?: Maybe<UserRef>;
    reorderLevel?: Maybe<Scalars['Decimal']['output']>;
    serialTracked: Scalars['Boolean']['output'];
    sizeLabel?: Maybe<Scalars['String']['output']>;
    standardPrice?: Maybe<Money>;
    status: ProductStatus;
    /** Available stock at a warehouse/location the caller can see. */
    stock: Array<StockBalance>;
    updatedAt?: Maybe<Scalars['DateTime']['output']>;
    updatedBy?: Maybe<UserRef>;
    vendors: Array<VendorProduct>;
    version: Scalars['Int']['output'];
  };

export type ProductStockArgs = {
  locationId?: InputMaybe<Scalars['ID']['input']>;
};

export type ProductCategory = Node & {
  __typename?: 'ProductCategory';
  code: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  parent?: Maybe<ProductCategory>;
  requiresInspection: Scalars['Boolean']['output'];
};

export type ProductConnection = {
  __typename?: 'ProductConnection';
  edges: Array<ProductEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type ProductEdge = {
  __typename?: 'ProductEdge';
  cursor: Scalars['String']['output'];
  node: Product;
};

export type ProductFilter = {
  categoryIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  externalCode?: InputMaybe<Scalars['String']['input']>;
  externalSystem?: InputMaybe<Scalars['String']['input']>;
  isService?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Array<ProductStatus>>;
  vendorId?: InputMaybe<Scalars['ID']['input']>;
};

export type ProductPayload = {
  __typename?: 'ProductPayload';
  product?: Maybe<Product>;
  userErrors: Array<UserError>;
};

export type ProductSort = {
  direction: SortDirection;
  field: ProductSortField;
};

export const ProductSortField = {
  CODE: 'CODE',
  NAME: 'NAME',
  UPDATED_AT: 'UPDATED_AT',
} as const;

export type ProductSortField = (typeof ProductSortField)[keyof typeof ProductSortField];
export const ProductStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus];
export type PurchaseOrder = Auditable &
  Node & {
    __typename?: 'PurchaseOrder';
    approval?: Maybe<WorkflowInstance>;
    billTo: Location;
    createdAt: Scalars['DateTime']['output'];
    createdBy?: Maybe<UserRef>;
    deliveryLog: Array<NotificationDelivery>;
    documents: Array<Document>;
    externalPoNumber?: Maybe<Scalars['String']['output']>;
    grandTotal: Money;
    grns: Array<Grn>;
    id: Scalars['ID']['output'];
    lines: Array<PurchaseOrderLine>;
    noPoReason?: Maybe<Scalars['String']['output']>;
    orderDate: Scalars['Date']['output'];
    poNumber: Scalars['String']['output'];
    sendSuppressed: Scalars['Boolean']['output'];
    sentAt?: Maybe<Scalars['DateTime']['output']>;
    shipTo: Location;
    status: PurchaseOrderStatus;
    subtotal: Money;
    taxTotal: Money;
    type: PurchaseOrderType;
    updatedAt?: Maybe<Scalars['DateTime']['output']>;
    updatedBy?: Maybe<UserRef>;
    vendor: Vendor;
    version: Scalars['Int']['output'];
  };

export type PurchaseOrderConnection = {
  __typename?: 'PurchaseOrderConnection';
  edges: Array<PurchaseOrderEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type PurchaseOrderEdge = {
  __typename?: 'PurchaseOrderEdge';
  cursor: Scalars['String']['output'];
  node: PurchaseOrder;
};

export type PurchaseOrderFilter = {
  externalPoNumber?: InputMaybe<Scalars['String']['input']>;
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  orderDate?: InputMaybe<DateRangeInput>;
  overdue?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Array<PurchaseOrderStatus>>;
  vendorIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type PurchaseOrderLine = Node & {
  __typename?: 'PurchaseOrderLine';
  amount: Money;
  deliveryDate?: Maybe<Scalars['Date']['output']>;
  deliveryPointCode?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  indentLines: Array<IndentLine>;
  lineNo: Scalars['Int']['output'];
  product: Product;
  productName: Scalars['String']['output'];
  quantityAccepted: Scalars['Decimal']['output'];
  quantityOrdered: Quantity;
  quantityPending: Scalars['Decimal']['output'];
  quantityReceived: Scalars['Decimal']['output'];
  quantityRejected: Scalars['Decimal']['output'];
  sapPoLine?: Maybe<SapPoLine>;
  taxPct: Scalars['Decimal']['output'];
  unitPrice: Money;
};

export type PurchaseOrderLineInput = {
  deliveryDate?: InputMaybe<Scalars['Date']['input']>;
  deliveryPointCode?: InputMaybe<Scalars['String']['input']>;
  indentLineAllocations: Array<IndentLineAllocationInput>;
  productId: Scalars['ID']['input'];
  quantity: Scalars['Decimal']['input'];
  sapPoLineId?: InputMaybe<Scalars['ID']['input']>;
  taxPct: Scalars['Decimal']['input'];
  unitPrice: Scalars['Decimal']['input'];
  uomId: Scalars['ID']['input'];
};

export type PurchaseOrderPayload = {
  __typename?: 'PurchaseOrderPayload';
  purchaseOrder?: Maybe<PurchaseOrder>;
  userErrors: Array<UserError>;
};

export const PurchaseOrderStatus = {
  APPROVED: 'APPROVED',
  CANCELLED: 'CANCELLED',
  CLOSED: 'CLOSED',
  DRAFT: 'DRAFT',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  RECEIVED: 'RECEIVED',
  REJECTED: 'REJECTED',
  SENT: 'SENT',
  SHORT_CLOSED: 'SHORT_CLOSED',
} as const;

export type PurchaseOrderStatus = (typeof PurchaseOrderStatus)[keyof typeof PurchaseOrderStatus];
export const PurchaseOrderType = {
  NO_PO: 'NO_PO',
  SAP_REFERENCE: 'SAP_REFERENCE',
  STANDARD: 'STANDARD',
} as const;

export type PurchaseOrderType = (typeof PurchaseOrderType)[keyof typeof PurchaseOrderType];
export type Quantity = {
  __typename?: 'Quantity';
  uom: Uom;
  value: Scalars['Decimal']['output'];
};

export type Query = {
  __typename?: 'Query';
  activeCycle?: Maybe<PaymentCycle>;
  advanceSale?: Maybe<AdvanceSale>;
  advanceSaleByCode?: Maybe<AdvanceSale>;
  advanceSales: AdvanceSaleConnection;
  approvalTask?: Maybe<ApprovalTask>;
  approvalTasks: ApprovalTaskConnection;
  auditLog: AuditEntryConnection;
  cycleMonths: Array<CycleMonth>;
  dashboard: Dashboard;
  departments: Array<Department>;
  designations: Array<Designation>;
  document?: Maybe<Document>;
  documents: DocumentConnection;
  exportJob?: Maybe<ExportJob>;
  featureFlags: Array<FeatureFlag>;
  generalSales: GeneralSaleConnection;
  grn?: Maybe<Grn>;
  grns: GrnConnection;
  importBatch?: Maybe<ImportBatch>;
  indent?: Maybe<Indent>;
  indentByNumber?: Maybe<Indent>;
  indents: IndentConnection;
  inventory: InventoryConnection;
  invoice?: Maybe<Invoice>;
  invoices: InvoiceConnection;
  locations: Array<Location>;
  me: User;
  messagingAnalytics: MessagingAnalytics;
  mpp?: Maybe<Mpp>;
  mppLedger: MppLedgerConnection;
  mpps: MppConnection;
  myDelegations: Array<Delegation>;
  myLocationReconciliation: ReconciliationRecordConnection;
  mySessions: Array<Session>;
  node?: Maybe<Node>;
  notificationDeliveries: NotificationDeliveryConnection;
  notificationPreferences: Array<NotificationPreference>;
  notificationTemplates: Array<NotificationTemplate>;
  notifications: NotificationConnection;
  numberSeries: Array<NumberSeries>;
  openDiscrepancies: Array<TransitDiscrepancy>;
  openPurchaseOrdersForReceipt: Array<PurchaseOrder>;
  otherSales: Array<OtherSale>;
  permissionCatalogue: Array<Scalars['String']['output']>;
  physicalCounts: Array<PhysicalCount>;
  procurementQueue: ProcurementQueueConnection;
  product?: Maybe<Product>;
  productByCode?: Maybe<Product>;
  productCategories: Array<ProductCategory>;
  products: ProductConnection;
  purchaseOrder?: Maybe<PurchaseOrder>;
  purchaseOrderByNumber?: Maybe<PurchaseOrder>;
  purchaseOrders: PurchaseOrderConnection;
  reconciliationSheet?: Maybe<ReconciliationSheet>;
  reconciliationSheets: ReconciliationSheetConnection;
  reportProducts: Array<ReportProduct>;
  roles: Array<Role>;
  saleEntries: Array<SaleEntry>;
  saleStockReport?: Maybe<StockStatement>;
  sapMaterialMappings: Array<SapMaterialMapping>;
  sapPoLinesForIndentLine: Array<SapPoLine>;
  savedFilters: Array<SavedFilter>;
  search: SearchResult;
  settings: Array<Setting>;
  simulateWorkflow: WorkflowSimulation;
  stn?: Maybe<Stn>;
  stnByNumber?: Maybe<Stn>;
  stns: StnConnection;
  stockAdjustment?: Maybe<StockAdjustment>;
  stockCount?: Maybe<StockCount>;
  stockPeriodSummary: Array<StockPeriodSummary>;
  stockTransactions: StockTransactionConnection;
  syncPull: SyncPullResult;
  systemHealth: SystemHealth;
  transferOrder?: Maybe<TransferOrder>;
  transferOrders: TransferOrderConnection;
  uoms: Array<Uom>;
  user?: Maybe<User>;
  users: UserConnection;
  vendor?: Maybe<Vendor>;
  vendors: VendorConnection;
  workflowDefinitions: Array<WorkflowDefinition>;
};

export type QueryAdvanceSaleArgs = {
  id: Scalars['ID']['input'];
};

export type QueryAdvanceSaleByCodeArgs = {
  saleCode: Scalars['String']['input'];
};

export type QueryAdvanceSalesArgs = {
  filter?: InputMaybe<AdvanceSaleFilter>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryApprovalTaskArgs = {
  id: Scalars['ID']['input'];
};

export type QueryApprovalTasksArgs = {
  filter?: InputMaybe<ApprovalTaskFilter>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryAuditLogArgs = {
  filter?: InputMaybe<AuditFilter>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryCycleMonthsArgs = {
  year?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryDashboardArgs = {
  input?: InputMaybe<DashboardInput>;
};

export type QueryDocumentArgs = {
  id: Scalars['ID']['input'];
};

export type QueryDocumentsArgs = {
  filter?: InputMaybe<DocumentFilter>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryExportJobArgs = {
  id: Scalars['ID']['input'];
};

export type QueryGeneralSalesArgs = {
  filter?: InputMaybe<GeneralSaleFilter>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryGrnArgs = {
  id: Scalars['ID']['input'];
};

export type QueryGrnsArgs = {
  filter?: InputMaybe<GrnFilter>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryImportBatchArgs = {
  id: Scalars['ID']['input'];
};

export type QueryIndentArgs = {
  id: Scalars['ID']['input'];
};

export type QueryIndentByNumberArgs = {
  indentNumber: Scalars['String']['input'];
};

export type QueryIndentsArgs = {
  filter?: InputMaybe<IndentFilter>;
  pagination?: InputMaybe<PaginationInput>;
  sort?: InputMaybe<IndentSort>;
};

export type QueryInventoryArgs = {
  filter?: InputMaybe<InventoryFilter>;
  pagination?: InputMaybe<PaginationInput>;
  sort?: InputMaybe<InventorySort>;
};

export type QueryInvoiceArgs = {
  id: Scalars['ID']['input'];
};

export type QueryInvoicesArgs = {
  filter?: InputMaybe<InvoiceFilter>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryLocationsArgs = {
  includeInactive?: InputMaybe<Scalars['Boolean']['input']>;
};

export type QueryMessagingAnalyticsArgs = {
  channel?: InputMaybe<NotificationChannel>;
  period?: InputMaybe<DateRangeInput>;
};

export type QueryMppArgs = {
  id: Scalars['ID']['input'];
};

export type QueryMppLedgerArgs = {
  filter?: InputMaybe<MppLedgerFilter>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryMppsArgs = {
  filter?: InputMaybe<MppFilter>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryMyLocationReconciliationArgs = {
  cycleId?: InputMaybe<Scalars['ID']['input']>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryNodeArgs = {
  id: Scalars['ID']['input'];
};

export type QueryNotificationDeliveriesArgs = {
  filter?: InputMaybe<NotificationDeliveryFilter>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryNotificationTemplatesArgs = {
  code?: InputMaybe<Scalars['String']['input']>;
};

export type QueryNotificationsArgs = {
  filter?: InputMaybe<NotificationFilter>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryOpenDiscrepanciesArgs = {
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryOpenPurchaseOrdersForReceiptArgs = {
  search?: InputMaybe<Scalars['String']['input']>;
  warehouseId: Scalars['ID']['input'];
};

export type QueryOtherSalesArgs = {
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryPhysicalCountsArgs = {
  locationId: Scalars['ID']['input'];
};

export type QueryProcurementQueueArgs = {
  filter?: InputMaybe<ProcurementQueueFilter>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryProductArgs = {
  id: Scalars['ID']['input'];
};

export type QueryProductByCodeArgs = {
  code: Scalars['String']['input'];
  system?: InputMaybe<Scalars['String']['input']>;
};

export type QueryProductsArgs = {
  filter?: InputMaybe<ProductFilter>;
  pagination?: InputMaybe<PaginationInput>;
  sort?: InputMaybe<ProductSort>;
};

export type QueryPurchaseOrderArgs = {
  id: Scalars['ID']['input'];
};

export type QueryPurchaseOrderByNumberArgs = {
  number: Scalars['String']['input'];
};

export type QueryPurchaseOrdersArgs = {
  filter?: InputMaybe<PurchaseOrderFilter>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryReconciliationSheetArgs = {
  id: Scalars['ID']['input'];
};

export type QueryReconciliationSheetsArgs = {
  filter?: InputMaybe<ReconciliationSheetFilter>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QuerySaleEntriesArgs = {
  cycleId: Scalars['ID']['input'];
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  pagination?: InputMaybe<PaginationInput>;
  status?: InputMaybe<Array<SaleEntryStatus>>;
};

export type QuerySaleStockReportArgs = {
  input: SaleStockReportInput;
};

export type QuerySapPoLinesForIndentLineArgs = {
  indentLineId: Scalars['ID']['input'];
};

export type QuerySavedFiltersArgs = {
  listKey: Scalars['String']['input'];
};

export type QuerySearchArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  query: Scalars['String']['input'];
  types?: InputMaybe<Array<SearchEntityType>>;
};

export type QuerySettingsArgs = {
  keys?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type QuerySimulateWorkflowArgs = {
  input: SimulateWorkflowInput;
};

export type QueryStnArgs = {
  id: Scalars['ID']['input'];
};

export type QueryStnByNumberArgs = {
  stnNumber: Scalars['String']['input'];
};

export type QueryStnsArgs = {
  filter?: InputMaybe<StnFilter>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryStockAdjustmentArgs = {
  id: Scalars['ID']['input'];
};

export type QueryStockCountArgs = {
  id: Scalars['ID']['input'];
};

export type QueryStockPeriodSummaryArgs = {
  period: DateRangeInput;
  productIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  warehouseId: Scalars['ID']['input'];
};

export type QueryStockTransactionsArgs = {
  filter?: InputMaybe<StockTransactionFilter>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QuerySyncPullArgs = {
  input: SyncPullInput;
};

export type QueryTransferOrderArgs = {
  id: Scalars['ID']['input'];
};

export type QueryTransferOrdersArgs = {
  filter?: InputMaybe<TransferOrderFilter>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryUserArgs = {
  id: Scalars['ID']['input'];
};

export type QueryUsersArgs = {
  filter?: InputMaybe<UserFilter>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryVendorArgs = {
  id: Scalars['ID']['input'];
};

export type QueryVendorsArgs = {
  filter?: InputMaybe<VendorFilter>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueueDepth = {
  __typename?: 'QueueDepth';
  active: Scalars['Int']['output'];
  failed: Scalars['Int']['output'];
  oldestJobAgeSeconds?: Maybe<Scalars['Int']['output']>;
  queue: Scalars['String']['output'];
  waiting: Scalars['Int']['output'];
};

export type ReceiveStnInput = {
  /** Close the receipt even if quantities are short (opens discrepancies). */
  closeWithDiscrepancy?: InputMaybe<Scalars['Boolean']['input']>;
  evidenceDocumentIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  ewayBillDocumentId?: InputMaybe<Scalars['ID']['input']>;
  expectedVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  lines: Array<ReceiveStnLineInput>;
  stnCopyDocumentId?: InputMaybe<Scalars['ID']['input']>;
  warehouseId: Scalars['ID']['input'];
};

export type ReceiveStnLineInput = {
  quantityAccepted: Scalars['Decimal']['input'];
  quantityReceived: Scalars['Decimal']['input'];
  quantityRejected: Scalars['Decimal']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
  stnLineId: Scalars['ID']['input'];
};

export type ReconciliationPayload = {
  __typename?: 'ReconciliationPayload';
  records?: Maybe<Array<ReconciliationRecord>>;
  sheet?: Maybe<ReconciliationSheet>;
  userErrors: Array<UserError>;
};

export type ReconciliationRecord = Node & {
  __typename?: 'ReconciliationRecord';
  acknowledgedAt?: Maybe<Scalars['DateTime']['output']>;
  acknowledgedBy?: Maybe<UserRef>;
  acknowledgementComment?: Maybe<Scalars['String']['output']>;
  advanceQuantity: Scalars['Decimal']['output'];
  exceptionCode?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isService: Scalars['Boolean']['output'];
  ledger?: Maybe<MppProductLedgerEntry>;
  location?: Maybe<Location>;
  matchQuality?: Maybe<Scalars['String']['output']>;
  mpp?: Maybe<Mpp>;
  mppCodeRaw: Scalars['String']['output'];
  product?: Maybe<Product>;
  productRaw: Scalars['String']['output'];
  sapQuantity: Scalars['Decimal']['output'];
  status: ReconciliationStatus;
  toBeDeducted: Scalars['Decimal']['output'];
  toBeSent: Scalars['Decimal']['output'];
};

export type ReconciliationRecordConnection = {
  __typename?: 'ReconciliationRecordConnection';
  edges: Array<ReconciliationRecordEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type ReconciliationRecordEdge = {
  __typename?: 'ReconciliationRecordEdge';
  cursor: Scalars['String']['output'];
  node: ReconciliationRecord;
};

export type ReconciliationRecordFilter = {
  acknowledged?: InputMaybe<Scalars['Boolean']['input']>;
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  onlyExceptions?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Array<ReconciliationStatus>>;
};

export type ReconciliationSheet = Node & {
  __typename?: 'ReconciliationSheet';
  cycle: PaymentCycle;
  exceptionCount: Scalars['Int']['output'];
  fileName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  notRecordedCount: Scalars['Int']['output'];
  overRecordedCount: Scalars['Int']['output'];
  perfectMatchCount: Scalars['Int']['output'];
  processedAt?: Maybe<Scalars['DateTime']['output']>;
  publishedAt?: Maybe<Scalars['DateTime']['output']>;
  records: ReconciliationRecordConnection;
  status: ImportStatus;
  totalRecords: Scalars['Int']['output'];
  underRecordedCount: Scalars['Int']['output'];
  uploadedBy: UserRef;
  versionNo: Scalars['Int']['output'];
};

export type ReconciliationSheetRecordsArgs = {
  filter?: InputMaybe<ReconciliationRecordFilter>;
  pagination?: InputMaybe<PaginationInput>;
};

export type ReconciliationSheetConnection = {
  __typename?: 'ReconciliationSheetConnection';
  edges: Array<ReconciliationSheetEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type ReconciliationSheetEdge = {
  __typename?: 'ReconciliationSheetEdge';
  cursor: Scalars['String']['output'];
  node: ReconciliationSheet;
};

export type ReconciliationSheetFilter = {
  cycleIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  status?: InputMaybe<Array<ImportStatus>>;
};

export const ReconciliationStatus = {
  NOT_RECORDED: 'NOT_RECORDED',
  OVER_RECORDED: 'OVER_RECORDED',
  PERFECT_MATCH: 'PERFECT_MATCH',
  UNDER_RECORDED: 'UNDER_RECORDED',
} as const;

export type ReconciliationStatus = (typeof ReconciliationStatus)[keyof typeof ReconciliationStatus];
export type RecordPaymentInput = {
  amount: Scalars['Decimal']['input'];
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  invoiceId: Scalars['ID']['input'];
  mode?: InputMaybe<Scalars['String']['input']>;
  paidOn: Scalars['Date']['input'];
  reference: Scalars['String']['input'];
};

export type RecordStockCountInput = {
  countId: Scalars['ID']['input'];
  entries: Array<StockCountEntryInput>;
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
};

export type RegisterPushDeviceInput = {
  deviceName?: InputMaybe<Scalars['String']['input']>;
  platform: Scalars['String']['input'];
  token: Scalars['String']['input'];
};

export type RejectIndentInput = {
  expectedVersion: Scalars['Int']['input'];
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  /** Omit to reject all lines in the task. */
  lineIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  reason: Scalars['String']['input'];
  taskId: Scalars['ID']['input'];
};

export type ReportProduct = {
  __typename?: 'ReportProduct';
  displayName: Scalars['String']['output'];
  /** Base products (the fixed 35) cannot be removed. */
  isBase: Scalars['Boolean']['output'];
  /** Empty = all locations. */
  locations: Array<Location>;
  position: Scalars['Int']['output'];
  product: Product;
};

export type RequestExportInput = {
  columns?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Filter object of the corresponding list (validated per reportKey). */
  filters?: InputMaybe<Scalars['JSON']['input']>;
  format: ExportFormat;
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  reportKey: Scalars['String']['input'];
};

export type RequestStockAdjustmentInput = {
  evidenceDocumentIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  lines: Array<AdjustmentLineInput>;
  reasonCode: Scalars['String']['input'];
  remarks: Scalars['String']['input'];
  warehouseId: Scalars['ID']['input'];
};

export type ResolveDiscrepancyInput = {
  id: Scalars['ID']['input'];
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  remarks: Scalars['String']['input'];
  resolution: DiscrepancyResolution;
};

export type ResolveInvoiceExceptionInput = {
  action: InvoiceExceptionAction;
  expectedVersion: Scalars['Int']['input'];
  invoiceId: Scalars['ID']['input'];
  reason: Scalars['String']['input'];
};

export type ResolveReconciliationExceptionInput = {
  mppId?: InputMaybe<Scalars['ID']['input']>;
  productId?: InputMaybe<Scalars['ID']['input']>;
  recordId: Scalars['ID']['input'];
  remark: Scalars['String']['input'];
  waive?: InputMaybe<Scalars['Boolean']['input']>;
};

export type ReturnIndentInput = {
  expectedVersion: Scalars['Int']['input'];
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  remark: Scalars['String']['input'];
  taskId: Scalars['ID']['input'];
};

export type ReverseGrnInput = {
  expectedVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  /** Omit for full reversal. */
  lines?: InputMaybe<Array<GrnReversalLineInput>>;
  reason: Scalars['String']['input'];
};

export type Role = Node & {
  __typename?: 'Role';
  code: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isSystem: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  permissions: Array<Scalars['String']['output']>;
  userCount: Scalars['Int']['output'];
};

export type RoleAssignmentInput = {
  roleId: Scalars['ID']['input'];
  scopeCategoryIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  scopeDepartmentIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  scopeLocationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  validFrom?: InputMaybe<Scalars['Date']['input']>;
  validTo?: InputMaybe<Scalars['Date']['input']>;
};

export type RolePayload = {
  __typename?: 'RolePayload';
  role?: Maybe<Role>;
  userErrors: Array<UserError>;
};

export type SaleEntry = {
  __typename?: 'SaleEntry';
  advanceQuantity: Scalars['Decimal']['output'];
  location: Location;
  mpp: Mpp;
  product: Product;
  sapQuantity: Scalars['Decimal']['output'];
  status: SaleEntryStatus;
};

export const SaleEntryStatus = {
  NOT_SOLD: 'NOT_SOLD',
  OK: 'OK',
  OVER_SOLD: 'OVER_SOLD',
  UNDER_SOLD: 'UNDER_SOLD',
} as const;

export type SaleEntryStatus = (typeof SaleEntryStatus)[keyof typeof SaleEntryStatus];
export const SaleStatus = {
  CANCELLED: 'CANCELLED',
  DELIVERED: 'DELIVERED',
  ISSUED: 'ISSUED',
  PENDING: 'PENDING',
  PENDING_SYNC: 'PENDING_SYNC',
  RECONCILED: 'RECONCILED',
  SYNC_FAILED: 'SYNC_FAILED',
} as const;

export type SaleStatus = (typeof SaleStatus)[keyof typeof SaleStatus];
export type SaleStockReportInput = {
  cycleId: Scalars['ID']['input'];
  /** Admin only; location users and Cluster MIS are scoped automatically. */
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type SapMaterialMapping = {
  __typename?: 'SapMaterialMapping';
  categoryCode?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  product?: Maybe<Product>;
  sapMaterialCode: Scalars['String']['output'];
  sapMaterialName?: Maybe<Scalars['String']['output']>;
};

export type SapOrderGenerateInput = {
  /** Uploaded zone-demand sheets. */
  documentIds: Array<Scalars['ID']['input']>;
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
};

export type SapOrderGeneration = {
  __typename?: 'SapOrderGeneration';
  rowsSkipped: Scalars['Int']['output'];
  rowsWritten: Scalars['Int']['output'];
  unmappedMaterials: Array<Scalars['String']['output']>;
  zip: Document;
};

export type SapPoLine = Node & {
  __typename?: 'SapPoLine';
  consumedQuantity: Scalars['Decimal']['output'];
  documentDate: Scalars['Date']['output'];
  id: Scalars['ID']['output'];
  materialCode: Scalars['String']['output'];
  materialName: Scalars['String']['output'];
  orderQuantity: Scalars['Decimal']['output'];
  plant?: Maybe<Scalars['String']['output']>;
  product?: Maybe<Product>;
  sapPoNumber: Scalars['String']['output'];
  storageLocation?: Maybe<Scalars['String']['output']>;
  vendorText?: Maybe<Scalars['String']['output']>;
};

export type SaveFilterInput = {
  columns?: InputMaybe<Array<Scalars['String']['input']>>;
  filters: Scalars['JSON']['input'];
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  listKey: Scalars['String']['input'];
  name: Scalars['String']['input'];
};

export type SaveLocationInput = {
  active?: InputMaybe<Scalars['Boolean']['input']>;
  address?: InputMaybe<Scalars['String']['input']>;
  code: Scalars['String']['input'];
  excludedFromCrossView?: InputMaybe<Scalars['Boolean']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  name: Scalars['String']['input'];
  nameHi?: InputMaybe<Scalars['String']['input']>;
  sapPlantCode?: InputMaybe<Scalars['String']['input']>;
  type: LocationType;
};

export type SaveMppInput = {
  bmcLocationId: Scalars['ID']['input'];
  code: Scalars['String']['input'];
  cycleBand?: InputMaybe<CycleBand>;
  expectedVersion?: InputMaybe<Scalars['Int']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  name: Scalars['String']['input'];
  sahayakMobile?: InputMaybe<Scalars['PhoneNumber']['input']>;
  sahayakName?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<MppStatus>;
  village?: InputMaybe<Scalars['String']['input']>;
};

export type SaveNotificationTemplateInput = {
  body: Scalars['String']['input'];
  channel: NotificationChannel;
  code: Scalars['String']['input'];
  locale: Locale;
  providerTemplateName?: InputMaybe<Scalars['String']['input']>;
  publish?: InputMaybe<Scalars['Boolean']['input']>;
  subject?: InputMaybe<Scalars['String']['input']>;
  variables: Array<Scalars['String']['input']>;
};

export type SavePhysicalCountInput = {
  items: Array<PhysicalCountInput>;
  locationId: Scalars['ID']['input'];
};

export type SaveProductInput = {
  baseUomId: Scalars['ID']['input'];
  batchTracked?: InputMaybe<Scalars['Boolean']['input']>;
  categoryId?: InputMaybe<Scalars['ID']['input']>;
  code: Scalars['String']['input'];
  expectedVersion?: InputMaybe<Scalars['Int']['input']>;
  externalCodes?: InputMaybe<Array<ExternalProductCodeInput>>;
  hsnCode?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  isService: Scalars['Boolean']['input'];
  isStockItem: Scalars['Boolean']['input'];
  materialType?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  nameHi?: InputMaybe<Scalars['String']['input']>;
  ownerUserId?: InputMaybe<Scalars['ID']['input']>;
  reorderLevel?: InputMaybe<Scalars['Decimal']['input']>;
  serialTracked?: InputMaybe<Scalars['Boolean']['input']>;
  sizeLabel?: InputMaybe<Scalars['String']['input']>;
  standardPrice?: InputMaybe<Scalars['Decimal']['input']>;
  status?: InputMaybe<ProductStatus>;
};

export type SaveRoleInput = {
  code: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  name: Scalars['String']['input'];
  permissions: Array<Scalars['String']['input']>;
};

export type SaveSapMaterialMappingInput = {
  categoryCode?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  productId: Scalars['ID']['input'];
  sapMaterialCode: Scalars['String']['input'];
  sapMaterialName?: InputMaybe<Scalars['String']['input']>;
};

export type SaveStockStatementRowsInput = {
  cycleId: Scalars['ID']['input'];
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  locationId: Scalars['ID']['input'];
  /** Mandatory when an admin changes an inventory-derived column (audit, L-37). */
  reason?: InputMaybe<Scalars['String']['input']>;
  rows: Array<StockStatementRowEdit>;
};

export type SaveVendorInput = {
  address?: InputMaybe<Scalars['String']['input']>;
  code?: InputMaybe<Scalars['String']['input']>;
  contacts: Array<VendorContactInput>;
  expectedVersion?: InputMaybe<Scalars['Int']['input']>;
  gstin?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  legalName?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  pan?: InputMaybe<Scalars['String']['input']>;
  paymentTermsDays?: InputMaybe<Scalars['Int']['input']>;
  sapVendorCode?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<VendorStatus>;
};

export type SaveWorkflowDraftInput = {
  basedOnVersionId?: InputMaybe<Scalars['ID']['input']>;
  definition: Scalars['JSON']['input'];
  definitionCode: Scalars['String']['input'];
};

export type SavedFilter = Node & {
  __typename?: 'SavedFilter';
  columns?: Maybe<Array<Scalars['String']['output']>>;
  filters: Scalars['JSON']['output'];
  id: Scalars['ID']['output'];
  isDefault: Scalars['Boolean']['output'];
  listKey: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

export const SearchEntityType = {
  ADVANCE_SALE: 'ADVANCE_SALE',
  DOCUMENT: 'DOCUMENT',
  GRN: 'GRN',
  INDENT: 'INDENT',
  INVENTORY: 'INVENTORY',
  MPP: 'MPP',
  PRODUCT: 'PRODUCT',
  PURCHASE_ORDER: 'PURCHASE_ORDER',
  STN: 'STN',
  USER: 'USER',
  VENDOR: 'VENDOR',
} as const;

export type SearchEntityType = (typeof SearchEntityType)[keyof typeof SearchEntityType];
export type SearchHit = {
  __typename?: 'SearchHit';
  entityType: SearchEntityType;
  id: Scalars['ID']['output'];
  link: Scalars['String']['output'];
  number?: Maybe<Scalars['String']['output']>;
  score: Scalars['Float']['output'];
  status?: Maybe<Scalars['String']['output']>;
  subtitle?: Maybe<Scalars['String']['output']>;
  title: Scalars['String']['output'];
};

export type SearchResult = {
  __typename?: 'SearchResult';
  hits: Array<SearchHit>;
  tookMs: Scalars['Int']['output'];
};

export type SendPurchaseOrderInput = {
  additionalEmails?: InputMaybe<Array<Scalars['EmailAddress']['input']>>;
  /** Vendor delivery-schedule template document to fill and attach. */
  deliveryScheduleTemplateDocumentId?: InputMaybe<Scalars['ID']['input']>;
  expectedVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  message?: InputMaybe<Scalars['String']['input']>;
  /** Contacts to send to; defaults to vendor PO contacts. */
  recipientContactIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type SeriesPoint = {
  __typename?: 'SeriesPoint';
  x: Scalars['String']['output'];
  y: Scalars['Decimal']['output'];
};

export type Session = Node & {
  __typename?: 'Session';
  createdAt: Scalars['DateTime']['output'];
  current: Scalars['Boolean']['output'];
  deviceName?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  ip?: Maybe<Scalars['String']['output']>;
  lastSeenAt: Scalars['DateTime']['output'];
  platform?: Maybe<Scalars['String']['output']>;
};

export type SetFeatureFlagInput = {
  enabled: Scalars['Boolean']['input'];
  key: Scalars['String']['input'];
  rules?: InputMaybe<Scalars['JSON']['input']>;
};

export type SetMonthLockInput = {
  cycleMonthId: Scalars['ID']['input'];
  locked: Scalars['Boolean']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
};

export type SetStockReportOpenColumnsInput = {
  columns: Array<StockReportColumn>;
  cycleId: Scalars['ID']['input'];
  /** Omit for all locations. */
  locationId?: InputMaybe<Scalars['ID']['input']>;
};

export type SetUserRolesInput = {
  expectedVersion: Scalars['Int']['input'];
  roles: Array<RoleAssignmentInput>;
  userId: Scalars['ID']['input'];
};

export type SetVendorProductsInput = {
  items: Array<VendorProductInput>;
  vendorId: Scalars['ID']['input'];
};

export type Setting = {
  __typename?: 'Setting';
  description?: Maybe<Scalars['String']['output']>;
  key: Scalars['String']['output'];
  scope: Scalars['String']['output'];
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  updatedBy?: Maybe<UserRef>;
  value: Scalars['JSON']['output'];
};

export type SettingPayload = {
  __typename?: 'SettingPayload';
  setting?: Maybe<Setting>;
  userErrors: Array<UserError>;
};

export type ShipmentEvent = {
  __typename?: 'ShipmentEvent';
  occurredAt: Scalars['DateTime']['output'];
  status: StnStatus;
  stnId: Scalars['ID']['output'];
  stnNumber: Scalars['String']['output'];
};

export type ShortClosePurchaseOrderInput = {
  expectedVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  lineIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  reason: Scalars['String']['input'];
};

export type SimulateWorkflowInput = {
  definitionCode: Scalars['String']['input'];
  sample?: InputMaybe<Scalars['JSON']['input']>;
  /** Sample subject, e.g. an existing indent id or an ad-hoc indent draft. */
  subjectId?: InputMaybe<Scalars['ID']['input']>;
  versionId?: InputMaybe<Scalars['ID']['input']>;
};

export type SimulatedGroup = {
  __typename?: 'SimulatedGroup';
  lineIds: Array<Scalars['ID']['output']>;
  routingKey: Scalars['String']['output'];
  steps: Array<SimulatedStep>;
};

export type SimulatedStep = {
  __typename?: 'SimulatedStep';
  applies: Scalars['Boolean']['output'];
  assignees: Array<UserRef>;
  reason: Scalars['String']['output'];
  stepKey: Scalars['String']['output'];
  stepName: Scalars['String']['output'];
};

export const SlaState = {
  AT_RISK: 'AT_RISK',
  BREACHED: 'BREACHED',
  ON_TRACK: 'ON_TRACK',
} as const;

export type SlaState = (typeof SlaState)[keyof typeof SlaState];
export const SortDirection = {
  ASC: 'ASC',
  DESC: 'DESC',
} as const;

export type SortDirection = (typeof SortDirection)[keyof typeof SortDirection];
export type StartImportInput = {
  cycleId?: InputMaybe<Scalars['ID']['input']>;
  documentId: Scalars['ID']['input'];
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  kind: ImportKind;
  options?: InputMaybe<Scalars['JSON']['input']>;
  /** Validate and preview only; commit with commitImport. */
  previewOnly?: InputMaybe<Scalars['Boolean']['input']>;
};

export type StartStockCountInput = {
  categoryIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  productIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  warehouseId: Scalars['ID']['input'];
};

export type Stn = Auditable &
  Node & {
    __typename?: 'Stn';
    createdAt: Scalars['DateTime']['output'];
    createdBy?: Maybe<UserRef>;
    destinationWarehouse: Warehouse;
    discrepancies: Array<TransitDiscrepancy>;
    dispatchedAt?: Maybe<Scalars['DateTime']['output']>;
    documents: Array<Document>;
    driverName?: Maybe<Scalars['String']['output']>;
    driverPhone?: Maybe<Scalars['PhoneNumber']['output']>;
    ewayBillNumber?: Maybe<Scalars['String']['output']>;
    expectedArrival?: Maybe<Scalars['DateTime']['output']>;
    id: Scalars['ID']['output'];
    legacyStnNumber?: Maybe<Scalars['String']['output']>;
    lines: Array<StnLine>;
    pdf?: Maybe<Document>;
    receipts: Array<StnReceipt>;
    receivedAt?: Maybe<Scalars['DateTime']['output']>;
    sourceWarehouse: Warehouse;
    status: StnStatus;
    stnNumber: Scalars['String']['output'];
    transferOrder: TransferOrder;
    transporterName?: Maybe<Scalars['String']['output']>;
    updatedAt?: Maybe<Scalars['DateTime']['output']>;
    updatedBy?: Maybe<UserRef>;
    vehicleNumber?: Maybe<Scalars['String']['output']>;
    version: Scalars['Int']['output'];
  };

export type StnConnection = {
  __typename?: 'StnConnection';
  edges: Array<StnEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type StnEdge = {
  __typename?: 'StnEdge';
  cursor: Scalars['String']['output'];
  node: Stn;
};

export type StnFilter = {
  awaitingMyAction?: InputMaybe<Scalars['Boolean']['input']>;
  destinationLocationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  dispatchedAt?: InputMaybe<DateRangeInput>;
  search?: InputMaybe<Scalars['String']['input']>;
  sourceLocationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  status?: InputMaybe<Array<StnStatus>>;
};

export type StnLine = Node & {
  __typename?: 'StnLine';
  id: Scalars['ID']['output'];
  product: Product;
  quantityDispatched: Scalars['Decimal']['output'];
  quantityInTransit: Scalars['Decimal']['output'];
  quantityPlanned: Scalars['Decimal']['output'];
  quantityReceived: Scalars['Decimal']['output'];
  quantityRejected: Scalars['Decimal']['output'];
};

export type StnLineQuantityInput = {
  batchId?: InputMaybe<Scalars['ID']['input']>;
  quantity: Scalars['Decimal']['input'];
  stnLineId: Scalars['ID']['input'];
};

export type StnPayload = {
  __typename?: 'StnPayload';
  stn?: Maybe<Stn>;
  userErrors: Array<UserError>;
};

export type StnQuantityInput = {
  quantity: Scalars['Decimal']['input'];
  transferOrderLineId: Scalars['ID']['input'];
};

export type StnReceipt = Node & {
  __typename?: 'StnReceipt';
  documents: Array<Document>;
  id: Scalars['ID']['output'];
  lines: Array<StnReceiptLine>;
  receiptNumber: Scalars['String']['output'];
  receivedAt: Scalars['DateTime']['output'];
  receivedBy: UserRef;
};

export type StnReceiptLine = {
  __typename?: 'StnReceiptLine';
  quantityAccepted: Scalars['Decimal']['output'];
  quantityReceived: Scalars['Decimal']['output'];
  quantityRejected: Scalars['Decimal']['output'];
  reason?: Maybe<Scalars['String']['output']>;
  stnLine: StnLine;
};

export const StnStatus = {
  CANCELLED: 'CANCELLED',
  CLOSED: 'CLOSED',
  DISCREPANCY_OPEN: 'DISCREPANCY_OPEN',
  DISPATCHED: 'DISPATCHED',
  DRAFT: 'DRAFT',
  IN_TRANSIT: 'IN_TRANSIT',
  PARTIALLY_DISPATCHED: 'PARTIALLY_DISPATCHED',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  RECEIVED: 'RECEIVED',
  STN_ISSUED: 'STN_ISSUED',
} as const;

export type StnStatus = (typeof StnStatus)[keyof typeof StnStatus];
export type StockAdjustment = Auditable &
  Node & {
    __typename?: 'StockAdjustment';
    adjustmentNumber: Scalars['String']['output'];
    approvedBy?: Maybe<UserRef>;
    createdAt: Scalars['DateTime']['output'];
    createdBy?: Maybe<UserRef>;
    evidence: Array<Document>;
    id: Scalars['ID']['output'];
    lines: Array<StockAdjustmentLine>;
    reasonCode: Scalars['String']['output'];
    requestedBy: UserRef;
    status: AdjustmentStatus;
    updatedAt?: Maybe<Scalars['DateTime']['output']>;
    updatedBy?: Maybe<UserRef>;
    version: Scalars['Int']['output'];
    warehouse: Warehouse;
  };

export type StockAdjustmentLine = {
  __typename?: 'StockAdjustmentLine';
  batchNo?: Maybe<Scalars['String']['output']>;
  bookQuantity: Scalars['Decimal']['output'];
  countedQuantity?: Maybe<Scalars['Decimal']['output']>;
  product: Product;
  quantityDelta: Scalars['Decimal']['output'];
};

export type StockAdjustmentPayload = {
  __typename?: 'StockAdjustmentPayload';
  adjustment?: Maybe<StockAdjustment>;
  userErrors: Array<UserError>;
};

export type StockBalance = {
  __typename?: 'StockBalance';
  available: Scalars['Decimal']['output'];
  avgUnitCost?: Maybe<Money>;
  band: StockBand;
  batchNo?: Maybe<Scalars['String']['output']>;
  lastMovementAt?: Maybe<Scalars['DateTime']['output']>;
  location: Location;
  onHand: Scalars['Decimal']['output'];
  product: Product;
  reserved: Scalars['Decimal']['output'];
  uom: Uom;
  value?: Maybe<Money>;
  warehouse: Warehouse;
};

export type StockBalanceEdge = {
  __typename?: 'StockBalanceEdge';
  cursor: Scalars['String']['output'];
  node: StockBalance;
};

export const StockBand = {
  HIGH: 'HIGH',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
} as const;

export type StockBand = (typeof StockBand)[keyof typeof StockBand];
export const StockConditionAction = {
  DISPOSE: 'DISPOSE',
  MARK_DAMAGED: 'MARK_DAMAGED',
  MARK_EXPIRED: 'MARK_EXPIRED',
} as const;

export type StockConditionAction = (typeof StockConditionAction)[keyof typeof StockConditionAction];
export const StockConditionBucket = {
  DAMAGED: 'DAMAGED',
  EXPIRED: 'EXPIRED',
  GOOD: 'GOOD',
} as const;

export type StockConditionBucket = (typeof StockConditionBucket)[keyof typeof StockConditionBucket];
export type StockCount = Node & {
  __typename?: 'StockCount';
  countNumber: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lines: Array<StockCountLine>;
  snapshotAt: Scalars['DateTime']['output'];
  status: Scalars['String']['output'];
  warehouse: Warehouse;
};

export type StockCountEntryInput = {
  batchId?: InputMaybe<Scalars['ID']['input']>;
  countedQuantity: Scalars['Decimal']['input'];
  productId: Scalars['ID']['input'];
};

export type StockCountLine = {
  __typename?: 'StockCountLine';
  bookQuantity: Scalars['Decimal']['output'];
  countedQuantity?: Maybe<Scalars['Decimal']['output']>;
  product: Product;
  variance?: Maybe<Scalars['Decimal']['output']>;
};

export type StockCountPayload = {
  __typename?: 'StockCountPayload';
  count?: Maybe<StockCount>;
  userErrors: Array<UserError>;
};

export type StockPeriodSummary = {
  __typename?: 'StockPeriodSummary';
  adjustedQuantity: Scalars['Decimal']['output'];
  closingQuantity: Scalars['Decimal']['output'];
  issuedQuantity: Scalars['Decimal']['output'];
  openingQuantity: Scalars['Decimal']['output'];
  product: Product;
  receivedQuantity: Scalars['Decimal']['output'];
  transferredQuantity: Scalars['Decimal']['output'];
  warehouse: Warehouse;
};

export const StockReportColumn = {
  DAMAGE: 'DAMAGE',
  EXPIRE: 'EXPIRE',
  MPP_SALE: 'MPP_SALE',
  OPENING: 'OPENING',
  RECEIVED_MCC_BMC: 'RECEIVED_MCC_BMC',
  RECEIVED_NDS_OTHER: 'RECEIVED_NDS_OTHER',
  REMARK: 'REMARK',
  TRANSFER: 'TRANSFER',
  TRANSPORTER_DEDUCTION: 'TRANSPORTER_DEDUCTION',
} as const;

export type StockReportColumn = (typeof StockReportColumn)[keyof typeof StockReportColumn];
export type StockReportLocationGroup = {
  __typename?: 'StockReportLocationGroup';
  /** Columns the CALLER may edit now (depends on role, open columns and status). */
  editableColumns: Array<StockReportColumn>;
  location: Location;
  /** Columns the location's users may fill. */
  openColumns: Array<StockReportColumn>;
  rows: Array<StockStatementRow>;
  totals: StockReportTotals;
};

export type StockReportTotals = {
  __typename?: 'StockReportTotals';
  closingBalance: Scalars['Int']['output'];
  damage: Scalars['Int']['output'];
  expire: Scalars['Int']['output'];
  mppSale: Scalars['Int']['output'];
  openingBalance: Scalars['Int']['output'];
  receivedMccBmc: Scalars['Int']['output'];
  receivedNdsOther: Scalars['Int']['output'];
  transfer: Scalars['Int']['output'];
  transporterDeduction: Scalars['Int']['output'];
};

export type StockStatement = Node & {
  __typename?: 'StockStatement';
  cycle: PaymentCycle;
  finalizedAt?: Maybe<Scalars['DateTime']['output']>;
  generatedAt?: Maybe<Scalars['DateTime']['output']>;
  groups: Array<StockReportLocationGroup>;
  id: Scalars['ID']['output'];
  isManualOverride: Scalars['Boolean']['output'];
  monthLockReason?: Maybe<Scalars['String']['output']>;
  monthLocked: Scalars['Boolean']['output'];
  overrideUploadedAt?: Maybe<Scalars['DateTime']['output']>;
  saleFile?: Maybe<Document>;
  saleRowsMatched: Scalars['Int']['output'];
  saleRowsTotal: Scalars['Int']['output'];
  saleRowsUnmatched: Scalars['Int']['output'];
  saleUploadedAt?: Maybe<Scalars['DateTime']['output']>;
  status: StockStatementStatus;
  /** Company-wide; empty for Cluster MIS and location users. */
  unmatchedSaleRows: Array<UnmatchedSaleRow>;
};

export type StockStatementUnmatchedSaleRowsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
};

export type StockStatementPayload = {
  __typename?: 'StockStatementPayload';
  message?: Maybe<Scalars['String']['output']>;
  statement?: Maybe<StockStatement>;
  userErrors: Array<UserError>;
};

export type StockStatementRow = {
  __typename?: 'StockStatementRow';
  /** Opening + received + receivedMcc - |transfer| - mppSale - transporter - damage - expire. */
  closingBalance: Scalars['Int']['output'];
  damage: Scalars['Int']['output'];
  expire: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  mppSale: Scalars['Int']['output'];
  openingBalance: Scalars['Int']['output'];
  product: Product;
  productDisplayName: Scalars['String']['output'];
  receivedMccBmc: Scalars['Int']['output'];
  receivedNdsOther: Scalars['Int']['output'];
  remark?: Maybe<Scalars['String']['output']>;
  /** Stock sent out; always <= 0. */
  transfer: Scalars['Int']['output'];
  transporterDeduction: Scalars['Int']['output'];
};

export type StockStatementRowEdit = {
  damage?: InputMaybe<Scalars['Int']['input']>;
  expire?: InputMaybe<Scalars['Int']['input']>;
  mppSale?: InputMaybe<Scalars['Int']['input']>;
  openingBalance?: InputMaybe<Scalars['Int']['input']>;
  receivedMccBmc?: InputMaybe<Scalars['Int']['input']>;
  receivedNdsOther?: InputMaybe<Scalars['Int']['input']>;
  remark?: InputMaybe<Scalars['String']['input']>;
  rowId: Scalars['ID']['input'];
  transfer?: InputMaybe<Scalars['Int']['input']>;
  transporterDeduction?: InputMaybe<Scalars['Int']['input']>;
};

export const StockStatementStatus = {
  FINALIZED: 'FINALIZED',
  OPEN: 'OPEN',
} as const;

export type StockStatementStatus = (typeof StockStatementStatus)[keyof typeof StockStatementStatus];
export type StockTransaction = Node & {
  __typename?: 'StockTransaction';
  direction: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  movementType: MovementType;
  occurredAt: Scalars['DateTime']['output'];
  performedBy: UserRef;
  product: Product;
  quantity: Scalars['Decimal']['output'];
  quantityAfter: Scalars['Decimal']['output'];
  quantityBefore: Scalars['Decimal']['output'];
  reasonCode?: Maybe<Scalars['String']['output']>;
  remarks?: Maybe<Scalars['String']['output']>;
  sourceId?: Maybe<Scalars['ID']['output']>;
  sourceNumber?: Maybe<Scalars['String']['output']>;
  sourceType: Scalars['String']['output'];
  warehouse: Warehouse;
};

export type StockTransactionConnection = {
  __typename?: 'StockTransactionConnection';
  edges: Array<StockTransactionEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type StockTransactionEdge = {
  __typename?: 'StockTransactionEdge';
  cursor: Scalars['String']['output'];
  node: StockTransaction;
};

export type StockTransactionFilter = {
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  movementTypes?: InputMaybe<Array<MovementType>>;
  occurredAt?: InputMaybe<DateTimeRangeInput>;
  productId?: InputMaybe<Scalars['ID']['input']>;
  sourceNumber?: InputMaybe<Scalars['String']['input']>;
  warehouseIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type SubmitIndentInput = {
  expectedVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
};

export type SubmitPurchaseOrderInput = {
  expectedVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
};

export type Subscription = {
  __typename?: 'Subscription';
  /** Approval tasks assigned to/removed from the caller. */
  approvalTaskChanged: ApprovalTaskEvent;
  deliveryStatusChanged: DeliveryStatusEvent;
  /** Generated documents (receipts, GRN/STN PDFs) becoming ready. */
  documentReady: DocumentEvent;
  exportProgress: ExportProgressEvent;
  importProgress: ImportProgressEvent;
  /** Status changes for indents the caller can read (optionally a single indent). */
  indentStatusChanged: IndentStatusEvent;
  /** Stock changes at locations in the caller's scope. */
  inventoryUpdated: InventoryEvent;
  /** Personal in-app notifications. */
  notificationReceived: Notification;
  shipmentStatusChanged: ShipmentEvent;
};

export type SubscriptionDeliveryStatusChangedArgs = {
  subjectId: Scalars['ID']['input'];
  subjectType: Scalars['String']['input'];
};

export type SubscriptionDocumentReadyArgs = {
  entityId: Scalars['ID']['input'];
  entityType: Scalars['String']['input'];
};

export type SubscriptionExportProgressArgs = {
  jobId: Scalars['ID']['input'];
};

export type SubscriptionImportProgressArgs = {
  batchId: Scalars['ID']['input'];
};

export type SubscriptionIndentStatusChangedArgs = {
  indentId?: InputMaybe<Scalars['ID']['input']>;
};

export type SubscriptionInventoryUpdatedArgs = {
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  productIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type SubscriptionShipmentStatusChangedArgs = {
  stnId?: InputMaybe<Scalars['ID']['input']>;
};

export type SyncChange = {
  __typename?: 'SyncChange';
  data?: Maybe<Scalars['JSON']['output']>;
  entity: SyncEntity;
  id: Scalars['ID']['output'];
  op: SyncOp;
  version: Scalars['Int']['output'];
};

export const SyncEntity = {
  CYCLES: 'CYCLES',
  LOCATIONS: 'LOCATIONS',
  MPPS: 'MPPS',
  MY_ADVANCE_SALES: 'MY_ADVANCE_SALES',
  MY_INDENTS: 'MY_INDENTS',
  MY_TASKS: 'MY_TASKS',
  NOTIFICATIONS: 'NOTIFICATIONS',
  OPEN_POS_FOR_MY_LOCATION: 'OPEN_POS_FOR_MY_LOCATION',
  OPEN_STNS_FOR_MY_LOCATION: 'OPEN_STNS_FOR_MY_LOCATION',
  PRODUCTS: 'PRODUCTS',
  STOCK_BALANCES: 'STOCK_BALANCES',
  UOMS: 'UOMS',
  VENDORS: 'VENDORS',
} as const;

export type SyncEntity = (typeof SyncEntity)[keyof typeof SyncEntity];
export const SyncOp = {
  DELETE: 'DELETE',
  UPSERT: 'UPSERT',
} as const;

export type SyncOp = (typeof SyncOp)[keyof typeof SyncOp];
export type SyncPullInput = {
  /** Opaque server cursor from the previous pull; null for initial sync. */
  cursor?: InputMaybe<Scalars['String']['input']>;
  entities: Array<SyncEntity>;
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type SyncPullResult = {
  __typename?: 'SyncPullResult';
  changes: Array<SyncChange>;
  cursor: Scalars['String']['output'];
  hasMore: Scalars['Boolean']['output'];
  serverTime: Scalars['DateTime']['output'];
};

export type SystemHealth = {
  __typename?: 'SystemHealth';
  components: Array<ComponentHealth>;
  deadLetterCount: Scalars['Int']['output'];
  queueDepths: Array<QueueDepth>;
  status: Scalars['String']['output'];
};

/** Timeline item used on document detail screens. */
export type TimelineEvent = {
  __typename?: 'TimelineEvent';
  actor?: Maybe<UserRef>;
  description?: Maybe<Scalars['String']['output']>;
  link?: Maybe<Scalars['String']['output']>;
  occurredAt: Scalars['DateTime']['output'];
  title: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

export type TransferOrder = Auditable &
  Node & {
    __typename?: 'TransferOrder';
    createdAt: Scalars['DateTime']['output'];
    createdBy?: Maybe<UserRef>;
    destination: Location;
    id: Scalars['ID']['output'];
    lines: Array<TransferOrderLine>;
    origin: Scalars['String']['output'];
    source: Location;
    status: TransferOrderStatus;
    stns: Array<Stn>;
    transferNumber: Scalars['String']['output'];
    updatedAt?: Maybe<Scalars['DateTime']['output']>;
    updatedBy?: Maybe<UserRef>;
    version: Scalars['Int']['output'];
  };

export type TransferOrderConnection = {
  __typename?: 'TransferOrderConnection';
  edges: Array<TransferOrderEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type TransferOrderEdge = {
  __typename?: 'TransferOrderEdge';
  cursor: Scalars['String']['output'];
  node: TransferOrder;
};

export type TransferOrderFilter = {
  createdAt?: InputMaybe<DateRangeInput>;
  destinationLocationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  productId?: InputMaybe<Scalars['ID']['input']>;
  sourceLocationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  status?: InputMaybe<Array<TransferOrderStatus>>;
};

export type TransferOrderLine = Node & {
  __typename?: 'TransferOrderLine';
  id: Scalars['ID']['output'];
  indentLine?: Maybe<IndentLine>;
  product: Product;
  quantity: Quantity;
  quantityOnStn: Scalars['Decimal']['output'];
  status: Scalars['String']['output'];
};

export type TransferOrderLineInput = {
  productId: Scalars['ID']['input'];
  quantity: Scalars['Decimal']['input'];
  uomId: Scalars['ID']['input'];
};

export type TransferOrderPayload = {
  __typename?: 'TransferOrderPayload';
  transferOrder?: Maybe<TransferOrder>;
  userErrors: Array<UserError>;
};

export const TransferOrderStatus = {
  CANCELLED: 'CANCELLED',
  CLOSED: 'CLOSED',
  DISCREPANCY_OPEN: 'DISCREPANCY_OPEN',
  DISPATCHED: 'DISPATCHED',
  PARTIALLY_DISPATCHED: 'PARTIALLY_DISPATCHED',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  PENDING_PLANNING: 'PENDING_PLANNING',
  RECEIVED: 'RECEIVED',
  STN_ISSUED: 'STN_ISSUED',
} as const;

export type TransferOrderStatus = (typeof TransferOrderStatus)[keyof typeof TransferOrderStatus];
export type TransferSourceInput = {
  quantity: Scalars['Decimal']['input'];
  sourceLocationId: Scalars['ID']['input'];
};

export type TransitDiscrepancy = Node & {
  __typename?: 'TransitDiscrepancy';
  id: Scalars['ID']['output'];
  quantity: Scalars['Decimal']['output'];
  remarks?: Maybe<Scalars['String']['output']>;
  resolution?: Maybe<DiscrepancyResolution>;
  resolvedAt?: Maybe<Scalars['DateTime']['output']>;
  resolvedBy?: Maybe<UserRef>;
  status: Scalars['String']['output'];
  stnLine: StnLine;
  type: DiscrepancyType;
};

export type UnmatchedSaleRow = {
  __typename?: 'UnmatchedSaleRow';
  materialCode?: Maybe<Scalars['String']['output']>;
  materialDescription?: Maybe<Scalars['String']['output']>;
  mccName?: Maybe<Scalars['String']['output']>;
  mppCode?: Maybe<Scalars['String']['output']>;
  mppName?: Maybe<Scalars['String']['output']>;
  plant?: Maybe<Scalars['String']['output']>;
  quantity: Scalars['Int']['output'];
};

export type Uom = Node & {
  __typename?: 'Uom';
  code: Scalars['String']['output'];
  decimalsAllowed: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  nameHi?: Maybe<Scalars['String']['output']>;
};

export type UpdateIndentInput = {
  attachmentDocumentIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  budgetCode?: InputMaybe<Scalars['String']['input']>;
  departmentId?: InputMaybe<Scalars['ID']['input']>;
  expectedVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  justification?: InputMaybe<Scalars['String']['input']>;
  /** Full replacement of lines (DRAFT/RETURNED only). */
  lines?: InputMaybe<Array<IndentLineInput>>;
  priority?: InputMaybe<Priority>;
  remarks?: InputMaybe<Scalars['String']['input']>;
  requiredBy?: InputMaybe<Scalars['Date']['input']>;
};

export type UpdateNumberSeriesInput = {
  id: Scalars['ID']['input'];
  /** May only move forward. */
  nextValue?: InputMaybe<Scalars['Int']['input']>;
  padding?: InputMaybe<Scalars['Int']['input']>;
  prefix?: InputMaybe<Scalars['String']['input']>;
  resetPolicy?: InputMaybe<Scalars['String']['input']>;
};

export type UpdatePurchaseOrderInput = {
  expectedVersion: Scalars['Int']['input'];
  externalPoNumber?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  lines?: InputMaybe<Array<PurchaseOrderLineInput>>;
  sendSuppressed?: InputMaybe<Scalars['Boolean']['input']>;
  shipToLocationId?: InputMaybe<Scalars['ID']['input']>;
  terms?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateSettingInput = {
  key: Scalars['String']['input'];
  scope?: InputMaybe<Scalars['String']['input']>;
  value: Scalars['JSON']['input'];
};

export type UpdateUserInput = {
  additionalLocationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  deliveryPointCode?: InputMaybe<Scalars['String']['input']>;
  departmentId?: InputMaybe<Scalars['ID']['input']>;
  designationId?: InputMaybe<Scalars['ID']['input']>;
  displayName?: InputMaybe<Scalars['String']['input']>;
  employeeCode?: InputMaybe<Scalars['String']['input']>;
  expectedVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  mobile?: InputMaybe<Scalars['PhoneNumber']['input']>;
  preferredLocale?: InputMaybe<Locale>;
  primaryLocationId?: InputMaybe<Scalars['ID']['input']>;
  reportsToId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<UserStatus>;
};

export type UploadPodInput = {
  capturedAt?: InputMaybe<Scalars['DateTime']['input']>;
  documentId: Scalars['ID']['input'];
  idempotencyKey?: InputMaybe<Scalars['UUID']['input']>;
  latitude?: InputMaybe<Scalars['Float']['input']>;
  longitude?: InputMaybe<Scalars['Float']['input']>;
  subjectId: Scalars['ID']['input'];
  subjectType: PodSubjectType;
  verificationCode: Scalars['String']['input'];
};

export type UpsertCycleInput = {
  cycleMonthId: Scalars['ID']['input'];
  cycleNo: Scalars['Int']['input'];
  endDate: Scalars['Date']['input'];
  expectedVersion?: InputMaybe<Scalars['Int']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  name: Scalars['String']['input'];
  sapCycleNumber?: InputMaybe<Scalars['String']['input']>;
  startDate: Scalars['Date']['input'];
};

export type UpsertReportProductInput = {
  displayName?: InputMaybe<Scalars['String']['input']>;
  /** Empty/omitted = all locations. */
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  position?: InputMaybe<Scalars['Int']['input']>;
  productId: Scalars['ID']['input'];
};

export type User = Auditable &
  Node & {
    __typename?: 'User';
    createdAt: Scalars['DateTime']['output'];
    createdBy?: Maybe<UserRef>;
    deliveryPointCode?: Maybe<Scalars['String']['output']>;
    department?: Maybe<Department>;
    designation?: Maybe<Designation>;
    displayName: Scalars['String']['output'];
    email: Scalars['EmailAddress']['output'];
    employeeCode?: Maybe<Scalars['String']['output']>;
    homeWorkspace: Workspace;
    id: Scalars['ID']['output'];
    lastLoginAt?: Maybe<Scalars['DateTime']['output']>;
    locations: Array<Location>;
    mfaEnabled: Scalars['Boolean']['output'];
    mobile?: Maybe<Scalars['PhoneNumber']['output']>;
    permissions: Array<Scalars['String']['output']>;
    preferredLocale: Locale;
    primaryLocation?: Maybe<Location>;
    reportsTo?: Maybe<UserRef>;
    roles: Array<UserRoleAssignment>;
    status: UserStatus;
    updatedAt?: Maybe<Scalars['DateTime']['output']>;
    updatedBy?: Maybe<UserRef>;
    version: Scalars['Int']['output'];
  };

export type UserConnection = {
  __typename?: 'UserConnection';
  edges: Array<UserEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type UserEdge = {
  __typename?: 'UserEdge';
  cursor: Scalars['String']['output'];
  node: User;
};

/** Expected business/validation error returned in mutation payloads. */
export type UserError = {
  __typename?: 'UserError';
  /** Stable machine-readable code, e.g. INVENTORY_INSUFFICIENT. */
  code: ErrorCode;
  details?: Maybe<Scalars['JSON']['output']>;
  /** Path to the offending input field, e.g. ["input","lines","2","quantity"]. */
  field?: Maybe<Array<Scalars['String']['output']>>;
  message: Scalars['String']['output'];
};

export type UserFilter = {
  departmentIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  roleCodes?: InputMaybe<Array<Scalars['String']['input']>>;
  search?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Array<UserStatus>>;
};

export type UserPayload = {
  __typename?: 'UserPayload';
  user?: Maybe<User>;
  userErrors: Array<UserError>;
};

/** Lightweight user reference for display. */
export type UserRef = {
  __typename?: 'UserRef';
  displayName: Scalars['String']['output'];
  employeeCode?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
};

export type UserRoleAssignment = {
  __typename?: 'UserRoleAssignment';
  role: Role;
  scopeCategories: Array<ProductCategory>;
  scopeDepartments: Array<Department>;
  scopeLocations: Array<Location>;
  validFrom?: Maybe<Scalars['Date']['output']>;
  validTo?: Maybe<Scalars['Date']['output']>;
};

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
  INVITED: 'INVITED',
  LOCKED: 'LOCKED',
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
export type Vendor = Auditable &
  Node & {
    __typename?: 'Vendor';
    address?: Maybe<Scalars['String']['output']>;
    code: Scalars['String']['output'];
    contacts: Array<VendorContact>;
    createdAt: Scalars['DateTime']['output'];
    createdBy?: Maybe<UserRef>;
    gstin?: Maybe<Scalars['String']['output']>;
    id: Scalars['ID']['output'];
    legalName?: Maybe<Scalars['String']['output']>;
    name: Scalars['String']['output'];
    pan?: Maybe<Scalars['String']['output']>;
    paymentTermsDays?: Maybe<Scalars['Int']['output']>;
    performance?: Maybe<VendorPerformance>;
    products: Array<VendorProduct>;
    sapVendorCode?: Maybe<Scalars['String']['output']>;
    status: VendorStatus;
    updatedAt?: Maybe<Scalars['DateTime']['output']>;
    updatedBy?: Maybe<UserRef>;
    version: Scalars['Int']['output'];
  };

export type VendorPerformanceArgs = {
  period?: InputMaybe<DateRangeInput>;
};

export type VendorConnection = {
  __typename?: 'VendorConnection';
  edges: Array<VendorEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type VendorContact = {
  __typename?: 'VendorContact';
  email?: Maybe<Scalars['EmailAddress']['output']>;
  id: Scalars['ID']['output'];
  name?: Maybe<Scalars['String']['output']>;
  phone?: Maybe<Scalars['PhoneNumber']['output']>;
  purposes: Array<Scalars['String']['output']>;
};

export type VendorContactInput = {
  email?: InputMaybe<Scalars['EmailAddress']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['PhoneNumber']['input']>;
  purposes: Array<Scalars['String']['input']>;
};

export type VendorEdge = {
  __typename?: 'VendorEdge';
  cursor: Scalars['String']['output'];
  node: Vendor;
};

export type VendorFilter = {
  productId?: InputMaybe<Scalars['ID']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Array<VendorStatus>>;
};

export type VendorPayload = {
  __typename?: 'VendorPayload';
  userErrors: Array<UserError>;
  vendor?: Maybe<Vendor>;
};

export type VendorPerformance = {
  __typename?: 'VendorPerformance';
  avgLeadTimeDays?: Maybe<Scalars['Decimal']['output']>;
  onTimeDeliveryPct?: Maybe<Scalars['Decimal']['output']>;
  poCount: Scalars['Int']['output'];
  quantityAccuracyPct?: Maybe<Scalars['Decimal']['output']>;
  rejectionPct?: Maybe<Scalars['Decimal']['output']>;
};

export type VendorProduct = {
  __typename?: 'VendorProduct';
  isPrimary: Scalars['Boolean']['output'];
  lastPrice?: Maybe<Money>;
  leadTimeDays?: Maybe<Scalars['Int']['output']>;
  priority: Scalars['Int']['output'];
  product: Product;
  vendor: Vendor;
};

export type VendorProductInput = {
  isPrimary?: InputMaybe<Scalars['Boolean']['input']>;
  leadTimeDays?: InputMaybe<Scalars['Int']['input']>;
  priority?: InputMaybe<Scalars['Int']['input']>;
  productId: Scalars['ID']['input'];
};

export const VendorStatus = {
  ACTIVE: 'ACTIVE',
  BLOCKED: 'BLOCKED',
  INACTIVE: 'INACTIVE',
} as const;

export type VendorStatus = (typeof VendorStatus)[keyof typeof VendorStatus];
export type VerifyGrnInput = {
  expectedVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  remarks?: InputMaybe<Scalars['String']['input']>;
  verified: Scalars['Boolean']['input'];
};

export type Warehouse = Node & {
  __typename?: 'Warehouse';
  code: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  location?: Maybe<Location>;
  name: Scalars['String']['output'];
  type: WarehouseType;
};

export const WarehouseType = {
  DAMAGED: 'DAMAGED',
  EXPIRED: 'EXPIRED',
  IN_TRANSIT: 'IN_TRANSIT',
  QUARANTINE: 'QUARANTINE',
  STORE: 'STORE',
} as const;

export type WarehouseType = (typeof WarehouseType)[keyof typeof WarehouseType];
export type WorkflowDefinition = Node & {
  __typename?: 'WorkflowDefinition';
  activeVersion?: Maybe<WorkflowVersion>;
  code: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  subjectType: WorkflowSubjectType;
  versions: Array<WorkflowVersion>;
};

export type WorkflowInstance = Node & {
  __typename?: 'WorkflowInstance';
  completedAt?: Maybe<Scalars['DateTime']['output']>;
  definitionCode: Scalars['String']['output'];
  history: Array<ApprovalAction>;
  id: Scalars['ID']['output'];
  startedAt: Scalars['DateTime']['output'];
  status: WorkflowInstanceStatus;
  subjectId: Scalars['ID']['output'];
  subjectType: WorkflowSubjectType;
  tasks: Array<ApprovalTask>;
  versionNo: Scalars['Int']['output'];
};

export const WorkflowInstanceStatus = {
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  RETURNED: 'RETURNED',
  RUNNING: 'RUNNING',
} as const;

export type WorkflowInstanceStatus =
  (typeof WorkflowInstanceStatus)[keyof typeof WorkflowInstanceStatus];
export type WorkflowSimulation = {
  __typename?: 'WorkflowSimulation';
  groups: Array<SimulatedGroup>;
};

export const WorkflowSubjectType = {
  ADVANCE_SALE_CANCELLATION: 'ADVANCE_SALE_CANCELLATION',
  GRN_EXCESS: 'GRN_EXCESS',
  INDENT: 'INDENT',
  INVOICE_EXCEPTION: 'INVOICE_EXCEPTION',
  PURCHASE_ORDER: 'PURCHASE_ORDER',
  STOCK_ADJUSTMENT: 'STOCK_ADJUSTMENT',
  TRANSFER_REQUEST: 'TRANSFER_REQUEST',
} as const;

export type WorkflowSubjectType = (typeof WorkflowSubjectType)[keyof typeof WorkflowSubjectType];
export type WorkflowVersion = Node & {
  __typename?: 'WorkflowVersion';
  /** Validated JSON definition: steps, conditions, assignee resolvers, modes, SLA, escalation. */
  definition: Scalars['JSON']['output'];
  id: Scalars['ID']['output'];
  publishedAt?: Maybe<Scalars['DateTime']['output']>;
  publishedBy?: Maybe<UserRef>;
  status: WorkflowVersionStatus;
  versionNo: Scalars['Int']['output'];
};

export type WorkflowVersionPayload = {
  __typename?: 'WorkflowVersionPayload';
  userErrors: Array<UserError>;
  version?: Maybe<WorkflowVersion>;
};

export const WorkflowVersionStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  RETIRED: 'RETIRED',
} as const;

export type WorkflowVersionStatus =
  (typeof WorkflowVersionStatus)[keyof typeof WorkflowVersionStatus];
export const Workspace = {
  ADMIN: 'ADMIN',
  FINANCE: 'FINANCE',
  HOD: 'HOD',
  LOGISTICS: 'LOGISTICS',
  MANAGEMENT: 'MANAGEMENT',
  PURCHASE: 'PURCHASE',
  STORE: 'STORE',
} as const;

export type Workspace = (typeof Workspace)[keyof typeof Workspace];
