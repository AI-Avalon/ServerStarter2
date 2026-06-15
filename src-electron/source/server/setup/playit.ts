import { z } from 'zod';
import { PublishRuntimeStatus } from 'app/src-electron/schema/publish';
import { playitRuntimePath } from 'app/src-electron/source/const';
import { BytesData } from 'app/src-electron/util/binary/bytesData';
import { Path } from 'app/src-electron/util/binary/path';
import {
  ChildProcessPromise,
  interactiveProcess,
} from 'app/src-electron/util/binary/subprocess';
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
      digest: z.string().optional(),
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

  let outputBuffer = '';
  const onOutput = (chunk: string) => {
    outputBuffer = updatePlayitStatusFromOutput(status, chunk, outputBuffer);
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

  const asset = selectPlayitWindowsAsset(release.assets);
  if (!asset) return fromRuntimeError(new Error('PLAYIT_WINDOWS_ASSET_MISSING'));

  const sha256 = getGithubAssetSha256(asset);
  if (!sha256) return fromRuntimeError(new Error('PLAYIT_ASSET_DIGEST_MISSING'));

  const agentBytes = await BytesData.fromURL(asset.browser_download_url, {
    type: 'sha256',
    value: sha256,
  });
  if (isError(agentBytes)) return agentBytes;

  await executable.parent().mkdir(true);
  const write = await agentBytes.write(executable.path, true);
  if (isError(write)) return write;

  return executable;
}

export function updatePlayitStatusFromOutput(
  status: PublishRuntimeStatus,
  chunk: string,
  previousBuffer: string,
  maxBufferLength = 4096
): string {
  const buffer = `${previousBuffer}${chunk}`.slice(-maxBufferLength);

  const claimUrl = extractPlayitClaimUrl(buffer);
  if (claimUrl) status.claimUrl = claimUrl;

  const publicAddress = extractPlayitAddress(buffer);
  if (publicAddress) status.publicAddress = publicAddress;

  if (/connected|tunnel|claim|auth/i.test(buffer)) {
    status.message = chunk.trim();
  }

  return buffer;
}

type GithubReleaseAsset = z.infer<typeof GithubRelease>['assets'][number];

function selectPlayitWindowsAsset(assets: GithubReleaseAsset[]) {
  return assets
    .filter((asset) => /^playit-windows-x86_64.*\.exe$/i.test(asset.name))
    .sort((a, b) => Number(/signed/i.test(b.name)) - Number(/signed/i.test(a.name)))[0];
}

export function getGithubAssetSha256(
  asset: Pick<GithubReleaseAsset, 'digest'>
): string | undefined {
  return asset.digest?.match(/^sha256:([a-f0-9]{64})$/i)?.[1].toLowerCase();
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

    test('rolling output buffer catches split claim url', () => {
      const status: PublishRuntimeStatus = {
        enabled: true,
        provider: 'playit',
        protocol: 'udp',
        localPort: 19132,
      };
      const buffer = updatePlayitStatusFromOutput(
        status,
        'https://playit.gg/claim/abc',
        'claim at '
      );
      updatePlayitStatusFromOutput(status, '_123', buffer);
      expect(status.claimUrl).toBe('https://playit.gg/claim/abc_123');
    });

    test('github asset digest parser', () => {
      expect(
        getGithubAssetSha256({
          digest:
            'sha256:2dbdaad119844cbbc062cc9774b8b462afa5f1b4b7832a9fc5ef4676cae887cf',
        })
      ).toBe(
        '2dbdaad119844cbbc062cc9774b8b462afa5f1b4b7832a9fc5ef4676cae887cf'
      );
    });
  });
}
