/** Tabs of the entity object details page (shared by the server page and the client view). */
export const ENTITY_TABS = ["general", "attributes", "display", "mapping", "dependency", "privileges"] as const;
export type EntityTab = (typeof ENTITY_TABS)[number];

export function toEntityTab(value: unknown): EntityTab {
  return (ENTITY_TABS as readonly string[]).includes(String(value)) ? (value as EntityTab) : "general";
}
