import { BedrockVersion } from 'app/src-electron/schema/version';
import { bedrockRuntimePath } from 'app/src-electron/source/const';
import { ZipFile } from 'app/src-electron/util/binary/archive/zipFile';
import { BytesData } from 'app/src-electron/util/binary/bytesData';
import { Path } from 'app/src-electron/util/binary/path';
import { fromRuntimeError, isError } from 'app/src-electron/util/error/error';
import { Failable } from 'app/src-electron/util/error/failable';
import { osPlatform } from 'app/src-electron/util/os/os';

const BEDROCK_EXE_WINDOWS = 'bedrock_server.exe';
const BEDROCK_EXE_LINUX = 'bedrock_server';

export function getBedrockExecutableName(version: BedrockVersion): string {
  return version.platform === 'windows'
    ? BEDROCK_EXE_WINDOWS
    : BEDROCK_EXE_LINUX;
}

export function getBedrockRuntimeDir(version: BedrockVersion): Path {
  return bedrockRuntimePath.child(version.platform, version.id);
}

export async function readyBedrockServer(
  version: BedrockVersion
): Promise<Failable<Path>> {
  if (version.platform === 'windows' && osPlatform !== 'windows-x64') {
    return fromRuntimeError(new Error('BEDROCK_WINDOWS_ONLY_ON_THIS_BUILD'));
  }
  if (version.platform === 'linux' && osPlatform !== 'debian') {
    return fromRuntimeError(new Error('BEDROCK_LINUX_REQUIRES_UBUNTU'));
  }

  const runtimeDir = getBedrockRuntimeDir(version);
  const executablePath = runtimeDir.child(getBedrockExecutableName(version));
  if (executablePath.exists()) return executablePath;

  await runtimeDir.emptyDir();

  const zipPath = bedrockRuntimePath.child(
    'downloads',
    `${version.platform}-${version.id}.zip`
  );
  const zipBytes = await BytesData.fromUrlOrPath(zipPath, version.url);
  if (isError(zipBytes)) return zipBytes;

  const zip = new ZipFile(zipPath);
  const extract = await zip.extract(runtimeDir);
  if (isError(extract)) return extract;

  if (!executablePath.exists()) {
    return fromRuntimeError(
      new Error(`BEDROCK_EXECUTABLE_NOT_FOUND:${executablePath.path}`)
    );
  }

  if (version.platform === 'linux') {
    await executablePath.changePermission(0o755);
  }

  return executablePath;
}

export async function readyBedrockServerFiles(
  version: BedrockVersion,
  targetPath: Path
): Promise<Failable<Path>> {
  const executable = await readyBedrockServer(version);
  if (isError(executable)) return executable;

  const runtimeDir = getBedrockRuntimeDir(version);
  const runtimeFiles = await runtimeDir.iter();
  if (isError(runtimeFiles)) return runtimeFiles;

  await Promise.all(
    runtimeFiles
      .filter((path) => !isMutableBedrockFile(path.basename()))
      .map((path) => path.copyTo(targetPath.child(path.basename())))
  );

  const targetExecutable = targetPath.child(getBedrockExecutableName(version));
  if (!targetExecutable.exists()) {
    return fromRuntimeError(
      new Error(`BEDROCK_EXECUTABLE_NOT_READY:${targetExecutable.path}`)
    );
  }

  if (version.platform === 'linux') {
    await targetExecutable.changePermission(0o755);
  }

  return targetExecutable;
}

function isMutableBedrockFile(name: string): boolean {
  return new Set([
    'worlds',
    'server.properties',
    'permissions.json',
    'allowlist.json',
    'whitelist.json',
  ]).has(name);
}

export function getBedrockRunEnvironment() {
  if (osPlatform === 'debian' || osPlatform === 'redhat') {
    return {
      ...process.env,
      LD_LIBRARY_PATH: '.',
    };
  }
  return process.env;
}

/** In Source Testing */
if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest;

  test('bedrock executable names', () => {
    expect(
      getBedrockExecutableName({
        type: 'bedrock',
        id: '1.21.0.0' as BedrockVersion['id'],
        platform: 'windows',
        url: 'https://example.com/bedrock-server-1.21.0.0.zip',
      })
    ).toBe(BEDROCK_EXE_WINDOWS);
  });
}
