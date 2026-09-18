export type VersionParts = readonly [number, number, number];

export const CHROME_VERSION_COMPONENT_MAX = 65535;

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseVersion(value: unknown): VersionParts | null {
  if (typeof value !== "string") return null;
  const match = VERSION_PATTERN.exec(value.trim());
  if (!match) return null;
  const parts = [Number(match[1]), Number(match[2]), Number(match[3])] as const;
  return parts.every((part) => part >= 0 && part <= CHROME_VERSION_COMPONENT_MAX) ? parts : null;
}

export function normalizeVersion(value: unknown): string | null {
  const parts = parseVersion(value);
  return parts ? parts.join(".") : null;
}
