import type { BackendDefinition, BackendId } from './contracts';
import { backendDefinitions } from './definitions';

export type { BackendDefinition, BackendId, BackendWebAdapter } from './contracts';

const definitionById = new Map<BackendId, BackendDefinition>(
  backendDefinitions.map((definition) => [definition.id, definition] as const)
);

export function listBackends(): readonly BackendDefinition[] {
  return backendDefinitions;
}

export function getBackend(id: string): BackendDefinition | undefined {
  return definitionById.get(id);
}

export function requireBackend(id: string): BackendDefinition {
  const definition = getBackend(id);
  if (!definition) throw new Error(`未知后端：${id}`);
  return definition;
}
