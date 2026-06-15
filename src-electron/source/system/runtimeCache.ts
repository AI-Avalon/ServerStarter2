import {
  bedrockRuntimePath,
  playitRuntimePath,
  runtimePath,
} from 'app/src-electron/source/const';
import { Failable } from 'app/src-electron/schema/error';
import { isError } from 'app/src-electron/util/error/error';

export type ManagedRuntimeCache = 'java' | 'bedrock' | 'playit' | 'all';

export async function clearManagedRuntimeCache(
  target: ManagedRuntimeCache
): Promise<Failable<void>> {
  const paths =
    target === 'all'
      ? [runtimePath, bedrockRuntimePath, playitRuntimePath]
      : target === 'java'
      ? [runtimePath]
      : target === 'bedrock'
      ? [bedrockRuntimePath]
      : [playitRuntimePath];

  for (const path of paths) {
    const result = await path.remove();
    if (isError(result)) return result;
  }
}
