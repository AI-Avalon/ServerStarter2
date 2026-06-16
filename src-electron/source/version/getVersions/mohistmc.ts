import { z } from 'zod';
import { Failable } from 'app/src-electron/schema/error';
import { BytesData } from 'app/src-electron/util/binary/bytesData';
import { Path } from 'app/src-electron/util/binary/path';
import { isError, isValid } from 'app/src-electron/util/error/error';
import { AllMohistmcVersion, VersionId } from '../../../schema/version';
import { VersionListLoader } from './base';

// Mohistのバージョン一覧を返すURLとその解析パーサー
const mohistAllVersionsURL = 'https://api.mohistmc.com/project/mohist/versions';
const mohistAllVersionsZod = z.object({ name: z.string() }).array();

// 各バージョンのビルド情報一覧を返すURLとその解析パーサー
const mohistEachVersionURL = (versionName: string) =>
  `https://api.mohistmc.com/project/mohist/${versionName}/builds`;
const mohistEachVersionZod = z
  .object({
    id: z.number(),
    file_sha256: z.string().optional(),
    build_date: z.string().optional(),
    commit: z
      .object({
        hash: z.string().optional(),
        changelog: z.string().optional(),
        author: z.string().optional(),
        commit_date: z.string().optional(),
      })
      .optional(),
    loader: z
      .object({
        forge_version: z.string().optional(),
        neoforge_version: z.string().optional(),
      })
      .optional(),
  })
  .passthrough()
  .array()
  .min(1);

// Jarのダウンロードリンク
const mohistJarURL = (versionName: string, buildId: number) =>
  `https://api.mohistmc.com/project/mohist/${versionName}/builds/${buildId}/download`;

/**
 * Mohist版のVersionLoaderを作成
 */
export class MohistMCVersionLoader extends VersionListLoader<'mohistmc'> {
  constructor(cachePath: Path) {
    super(cachePath, 'mohistmc', AllMohistmcVersion);
  }

  async getFromURL() {
    // 全バージョンのメタ情報を読み込み
    const allVerMeta = await this.loadAllVersion();
    if (isError(allVerMeta)) return allVerMeta;

    // メタ情報を各バージョンオブジェクトに変換
    const results = await Promise.all(
      allVerMeta.reverse().map(loadEachVersion)
    );
    return results.filter(isValid);
  }

  /**
   * 全てのバージョンのメタ情報を収集
   */
  private async loadAllVersion(): Promise<Failable<string[]>> {
    const jsonBytes = await BytesData.fromURL(mohistAllVersionsURL);
    if (isError(jsonBytes)) return jsonBytes;
    const parsedJson = await jsonBytes.json(mohistAllVersionsZod);
    if (isError(parsedJson)) return parsedJson;

    const versions = parsedJson.map((v) => v.name);

    // idsをバージョン順に並び替え
    await this.sortIds(versions);
    return versions.reverse();
  }
}

/**
 * メタ情報から当該バージョンのオブジェクトを生成
 */
async function loadEachVersion(
  versionName: string
): Promise<Failable<AllMohistmcVersion[number]>> {
  const jsonBytes = await BytesData.fromURL(mohistEachVersionURL(versionName));
  if (isError(jsonBytes)) return jsonBytes;
  const parsedEachVerJson = await jsonBytes.json(mohistEachVersionZod);
  if (isError(parsedEachVerJson)) return parsedEachVerJson;

  const builds = parsedEachVerJson
    .filter((b) => b.id)
    .map((b) => {
      return {
        id: b.id,
        name: b.commit?.hash ?? `${versionName}-${b.id}`,
        forge_version: b.loader?.forge_version,
        jar: {
          sha256: b.file_sha256,
          url: mohistJarURL(versionName, b.id),
        },
      };
    })
    .reverse();

  return {
    id: VersionId.parse(versionName),
    builds,
  };
}

/** In Source Testing */
if (import.meta.vitest) {
  const { test, expect, vi } = import.meta.vitest;
  test('mohist build metadata includes jar hash', async () => {
    const ver = '1.20.1';
    const build = 157;
    const sha256 =
      '922f21008d63230033e85565fbff959f2a5158e23021ef4c5343c51d096757d0';

    const fromURLSpy = vi
      .spyOn(BytesData, 'fromURL')
      .mockImplementation((url) => {
        expect(url).toBe(mohistEachVersionURL(ver));
        return BytesData.fromText(
          JSON.stringify([
            {
              id: build,
              file_sha256: sha256,
              commit: { hash: '2c49e69c7d50fa5ba8210c8648cc8d0f9135fe22' },
              loader: { forge_version: '47.4.0' },
            },
          ])
        );
      });

    // バージョンの中のビルド一覧を取得
    const allVers = await loadEachVersion(ver);
    expect(isError(allVers)).toBe(false);
    if (isError(allVers)) return;

    // ビルド一覧から対象のビルドを取得
    const targetVer = allVers.builds.find((b) => b.id === build);
    expect(targetVer).toBeDefined();
    if (!targetVer) return;

    expect(targetVer.jar.url).toBe(mohistJarURL(ver, build));
    expect(targetVer.jar.sha256).toBe(sha256);

    fromURLSpy.mockRestore();
  });
}
