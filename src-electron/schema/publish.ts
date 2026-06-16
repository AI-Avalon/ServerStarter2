import { z } from 'zod';

export const PublishProvider = z.enum(['none', 'ngrok', 'playit']);
export type PublishProvider = z.infer<typeof PublishProvider>;

export const PublishProtocol = z.enum(['tcp', 'udp']);
export type PublishProtocol = z.infer<typeof PublishProtocol>;

export const PublishSetting = z
  .object({
    enabled: z.boolean().default(false),
    provider: PublishProvider.default('none'),
    protocol: PublishProtocol.default('tcp'),
    remote_addr: z.string().optional(),
  })
  .default({});
export type PublishSetting = z.infer<typeof PublishSetting>;

export const PublishRuntimeStatus = z.object({
  enabled: z.boolean(),
  provider: PublishProvider,
  protocol: PublishProtocol,
  localPort: z.number(),
  publicAddress: z.string().optional(),
  claimUrl: z.string().optional(),
  message: z.string().optional(),
});
export type PublishRuntimeStatus = z.infer<typeof PublishRuntimeStatus>;
