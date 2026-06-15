import { z } from 'zod';
import { Failable } from 'app/src-electron/schema/error';
import { AllBedrockVersion, VersionId } from 'app/src-electron/schema/version';
import { BytesData } from 'app/src-electron/util/binary/bytesData';
import { Path } from 'app/src-electron/util/binary/path';
import { fromRuntimeError, isError } from 'app/src-electron/util/error/error';
import { VersionListLoader } from './base';

const bedrockDownloadLinksURL =
  'https://net-secondary.web.minecraft-services.net/api/v1.0/download/links';

const bedrockDownloadLinksZod = z.object({
  result: z.object({
    links: z
      .object({
        downloadType: z.string(),
        downloadUrl: z.string(),
      })
      .array(),
  }),
});

type BedrockPlatform = AllBedrockVersion[number]['platform'];

const bedrockDownloadTypes: Record<BedrockPlatform, string> = {
  windows: 'serverBedrockWindows',
  linux: 'serverBedrockLinux',
};

export class BedrockVersionLoader extends VersionListLoader<'bedrock'> {
  constructor(cachePath: Path) {
    super(cachePath, 'bedrock', AllBedrockVersion);
  }

  async getFromURL(): Promise<Failable<AllBedrockVersion>> {
    const jsonBytes = await BytesData.fromURL(
      bedrockDownloadLinksURL,
      undefined,
      {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ServerStarter2',
      }
    );
    if (isError(jsonBytes)) return jsonBytes;

    const parsed = await jsonBytes.json(bedrockDownloadLinksZod);
    if (isError(parsed)) return parsed;

    const versions = (Object.entries(bedrockDownloadTypes) as [
      BedrockPlatform,
      string
    ][])
      .map(([platform, downloadType]) => {
        const url = parsed.result.links.find(
          (entry) => entry.downloadType === downloadType
        )?.downloadUrl;
        if (!url) return undefined;
        return createBedrockVersion(platform, url);
      })
      .filter((v): v is AllBedrockVersion[number] => v !== undefined);

    if (versions.length > 0) return versions;

    return fromRuntimeError(
      new Error('BEDROCK_DOWNLOAD_LINKS_NOT_FOUND')
    );
  }
}

function createBedrockVersion(
  platform: BedrockPlatform,
  url: string
): AllBedrockVersion[number] | undefined {
  if (isPreviewBedrockUrl(url)) return undefined;

  const id = extractBedrockVersionFromUrl(url);
  if (!id) return undefined;

  return {
    id: VersionId.parse(id),
    platform,
    url,
  };
}

export function isPreviewBedrockUrl(url: string): boolean {
  return /preview/i.test(url);
}

export function extractBedrockVersionFromUrl(
  url: string
): string | undefined {
  return url.match(/bedrock-server-([^/\\]+)\.zip(?:$|\?)/)?.[1];
}

/** In Source Testing */
if (import.meta.vitest) {
  const { describe, test, expect } = import.meta.vitest;

  describe('bedrock version loader', () => {
    test('extract stable bedrock version', () => {
      expect(
        extractBedrockVersionFromUrl(
          'https://www.minecraft.net/bedrockdedicatedserver/bin-win/bedrock-server-1.21.100.7.zip'
        )
      ).toBe('1.21.100.7');
    });

    test('detect preview url', () => {
      expect(
        isPreviewBedrockUrl(
          'https://www.minecraft.net/bedrockdedicatedserver/bin-win-preview/bedrock-server-1.21.110.20.zip'
        )
      ).toBe(true);
    });
  });
}
