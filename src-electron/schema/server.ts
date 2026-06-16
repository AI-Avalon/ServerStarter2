import { z } from 'zod';
import { PublishRuntimeStatus } from './publish';

/** サーバー開始時にフロントエンドにわたる情報 */
export const ServerStartNotification = z.object({
  /** Ngrokのurl (Ngrokを使用している場合のみ) */
  ngrokURL: z.string().optional(),
  /** 外部公開アドレス (ngrok/playit等を利用している場合のみ) */
  publicAddress: z.string().optional(),
  /** 外部公開機能の状態 */
  publish: PublishRuntimeStatus.optional(),
  /**
   * 実際に使用したLANのport番号
   * Ngrokを使用するとプロパティのポートとは異なる番号が使われるため
   */
  port: z.number(),
});
export type ServerStartNotification = z.infer<typeof ServerStartNotification>;
