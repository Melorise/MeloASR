import type { BackendId, BackendWebAdapter } from './contracts';
import { qianwenAdapter } from './qianwen';
import { yuanbaoAdapter } from './yuanbao';

const adapterById = new Map<BackendId, BackendWebAdapter>(
  [qianwenAdapter, yuanbaoAdapter]
    .map((adapter) => [adapter.definition.id, adapter] as const)
);

/** 仅供后端网页 preload 使用。 */
export function getBackendWebAdapter(id: string): BackendWebAdapter | undefined {
  return adapterById.get(id);
}
