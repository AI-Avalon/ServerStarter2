import { z } from 'zod';

export const BackupScheduleSetting = z
  .object({
    enabled: z.boolean().default(false),
    intervalHours: z.number().min(1).max(24 * 30).default(24),
    maxBackups: z.number().min(1).max(365).default(10),
    beforeStart: z.boolean().default(false),
    afterStop: z.boolean().default(false),
    lastBackupTime: z.number().optional(),
  })
  .default({});
export type BackupScheduleSetting = z.infer<typeof BackupScheduleSetting>;
