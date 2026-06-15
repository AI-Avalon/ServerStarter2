import { z } from 'zod';
import { PublishRuntimeStatus } from 'app/src-electron/schema/publish';
import { playitRuntimePath } from 'app/src-electron/source/const';
import { BytesData } from 'app/src-electron/util/binary/bytesData';
import { Path } from 'app/src-electron/util/binary/path';
import { ChildProcessPromise, interactiveProcess } from 'app/src-electron/util/binary/subprocess';
import { fromRuntimeError, isError } from 'app/src-electron/util/error/error';
import { Failable } from 'app/src-electron/util/error/failable';
import { osPlatform } from 'app/src-electron/util/os/os';

const playitLatestReleaseURL =
  'https://api.github.com/repos/playit-cloud/playit-agent/releases/latest';

const GithubRelease = z.object({
  tag_name: z.string(),
  assets: z
    .object({
      name: z.string(),
      browser_download_url: z.string(),
    })
    .array(),
});

export type PlayitAgentSession = {
  status: PublishRuntimeStatus;
  close: () => Promise<void>;
};

export async function runPlayitAgent(options: {
  localPort: number;
  protocol: 'tcp' | 'udp';
}): Promise<Failable<PlayitAgentSession>> {
  const executable = await readyPlayitAgent();
  if (isError(executable)) return executable;

  const workDir = playitRuntimePath.child('agent');
  await workDir.mkdir(true);

  const status: PublishRuntimeStatus = {
    enabled: true,
    provider: 'playit',
    protocol: options.protocol,
    localPort: options.localPort,
    message: 'playit agent starting',
  };

  const onOutput = (chunk: string) => {
    const claimUrl = extractPlayitClaimUrl(chunk);
    if (claimUrl) status.claimUrl = claimUrl;

    const publicAddress = extractPlayitAddress(chunk);
    if (publicAddress) status.publicAddress = publicAddress;

    if (/connected|tunnel/i.test(chunk)) {
      status.message = chunk.trim();
    }
  };

  const process = interactiveProcess(
    executable,
    [],
    onOutput,
    onOutput,
    workDir,
    true,
    undefined,
    1000 * 5
  );

  void process.then((result) => {
    if (isError(result)) status.message = result.key;
    else status.message = 'playit agent stopped';
  });

  return {
    status,
    close: () => stopPlayit(process),
  };
}

async function stopPlayit(process: ChildProcessPromise) {
  await process.kill();
}

export async function readyPlayitAgent(): Promise<Failable<Path>> {
  if (osPlatform !== 'windows-x64') {
    return fromRuntimeError(new Error('PLAYIT_AUTODOWNLOAD_WINDOWS_ONLY'));
  }

  const executable = playitRuntimePath.child('playit.exe');
  if (executable.exists()) return executable;

  const releaseBytes = await BytesData.fromURL(
    playitLatestReleaseURL,
    undefined,
    {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ServerStarter2',
    }
  );
  if (isError(releaseBytes)) return releaseBytes;

  const release = await releaseBytes.json(GithubRelease);
  if (isError(release)) return release;

  const asset = release.assets.find((asset) =>
    /^playit-windows-x86_64.*\.exe$/i.test(asset.name)
  );
  if (!asset) return fromRuntimeError(new Error('PLAYIT_WINDOWS_ASSET_MISSING'));

  const agentBytes = await BytesData.fromURL(asset.browser_download_url);
  if (isError(agentBytes)) return agentBytes;

  await executable.parent().mkdir(true);
  const write = await agentBytes.write(executable.path, true);
  if (isError(write)) return write;

  return executable;
}

export function extractPlayitClaimUrl(text: string): string | undefined {
  return text.match(/https:\/\/playit\.gg\/claim\/[A-Za-z0-9_-]+/)?.[0];
}

export function extractPlayitAddress(text: string): string | undefined {
  return text.match(
    /(?:[A-Za-z0-9-]+\.)+playit\.(?:gg|cloud)(?::\d+)?/
  )?.[0];
}

/** In Source Testing */
if (import.meta.vitest) {
  const { describe, test, expect } = import.meta.vitest;

  describe('playit output parser', () => {
    test('claim url', () => {
      expect(
        extractPlayitClaimUrl('claim agent at https://playit.gg/claim/abc_123')
      ).toBe('https://playit.gg/claim/abc_123');
    });

    test('public address', () => {
      expect(
        extractPlayitAddress('address: example.at.playit.gg:19132')
      ).toBe('example.at.playit.gg:19132');
    });
  });
}
