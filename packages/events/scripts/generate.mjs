// Generates src/generated/events.ts from schema/event-contracts.schema.json.
// Emits one interface per $def plus a DomainEvent union discriminated on eventType.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { compile } from 'json-schema-to-typescript';

const schemaUrl = new URL('../schema/event-contracts.schema.json', import.meta.url);
const outUrl = new URL('../src/generated/events.ts', import.meta.url);

const contract = JSON.parse(await readFile(schemaUrl, 'utf8'));
const defs = contract.$defs;

// eventType -> payload $def, read from the contract's if/then branches.
const payloadByEvent = {};
for (const branch of contract.allOf) {
  const eventType = branch.if?.properties?.eventType?.const;
  const ref = branch.then?.properties?.payload?.$ref;
  if (eventType && ref) payloadByEvent[eventType] = ref.split('/').pop();
}

const declared = defs.Envelope.properties.eventType.enum;
const unmapped = declared.filter((t) => !payloadByEvent[t]);
if (unmapped.length > 0)
  throw new Error(`Event types without a payload schema: ${unmapped.join(', ')}`);

// Name each $def after its key so references compile to named interfaces.
const named = Object.fromEntries(Object.entries(defs).map(([k, v]) => [k, { ...v, title: k }]));
const root = {
  title: 'EventContracts',
  type: 'object',
  additionalProperties: false,
  properties: Object.fromEntries(Object.keys(defs).map((k) => [k, { $ref: `#/$defs/${k}` }])),
  $defs: named,
};

const types = await compile(root, 'EventContracts', {
  bannerComment: '',
  additionalProperties: false,
  declareExternallyReferenced: true,
  strictIndexSignatures: true,
  format: false,
});

const events = Object.keys(payloadByEvent).sort();
const out = `/* Generated from schema/event-contracts.schema.json by \`pnpm codegen\`. Do not edit. */
${types.replace(/export interface EventContracts \{[\s\S]*?\n\}\n/, '')}
export const EVENT_TYPES = ${JSON.stringify(events)} as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface EventPayloadMap {
${events.map((e) => `  ${e}: ${payloadByEvent[e]};`).join('\n')}
}

/** A domain event whose payload type is determined by its eventType. */
export type DomainEvent<T extends EventType = EventType> = {
  [K in T]: Omit<Envelope, 'eventType' | 'payload'> & { eventType: K; payload: EventPayloadMap[K] };
}[T];
`;

await mkdir(new URL('.', outUrl), { recursive: true });
await writeFile(outUrl, out);
console.log(`events: ${events.length} event types, ${Object.keys(defs).length} definitions`);
