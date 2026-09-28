/** A product's name in one external system, with that system's display priority. */
export interface ExternalName {
  system: string;
  name: string;
  isPrimary: boolean;
  /** Lower shows first; 0 means the system is never used for display. */
  displayPriority: number;
}

/**
 * The name people see for a product (MST-003): the primary name from the external system with
 * the lowest display priority, else the internal name. With the seeded priorities that is
 * NDDB → SAP → internal, as the legacy HOD and Purchase screens showed it.
 */
export function displayName(internalName: string, external: readonly ExternalName[]): string {
  const candidates = external
    .filter((e) => e.isPrimary && e.displayPriority > 0 && e.name.trim() !== '')
    .sort((a, b) => a.displayPriority - b.displayPriority || a.system.localeCompare(b.system));
  return candidates[0]?.name ?? internalName;
}
