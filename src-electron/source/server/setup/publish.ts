import { Listener } from '@ngrok/ngrok';
import { PublishRuntimeStatus, PublishSetting } from 'app/src-electron/schema/publish';
import { Version } from 'app/src-electron/schema/version';
import { closeNgrok, runNgrok } from './ngrok';
import { runPlayitAgent } from './playit';
import { Failable } from 'app/src-electron/schema/error';
import { fromRuntimeError, isError } from 'app/src-electron/util/error/error';

export type PublishSession = {
  status: PublishRuntimeStatus;
  close: () => Promise<void>;
};

export async function readyPublishSession(options: {
  setting: PublishSetting;
  version: Version;
  token: string | undefined;
  port: number;
}): Promise<Failable<PublishSession | undefined>> {
  const setting = normalizePublishSetting(options.setting, options.version);
  if (!setting.enabled || setting.provider === 'none') return undefined;

  if (setting.provider === 'ngrok') {
    if (options.version.type === 'bedrock') {
      return fromRuntimeError(new Error('NGROK_DOES_NOT_SUPPORT_BEDROCK_UDP'));
    }
    if (!options.token) return undefined;

    const listener = await runNgrok(
      options.token,
      options.port,
      setting.remote_addr
    );
    if (isError(listener)) return listener;
    return createNgrokSession(listener, options.port);
  }

  const playit = await runPlayitAgent({
    localPort: options.port,
    protocol: setting.protocol,
  });
  if (isError(playit)) return playit;
  return playit;
}

function createNgrokSession(
  listener: Listener,
  port: number
): PublishSession {
  const url = listener.url();
  const publicAddress = url ? url.replace(/^tcp:\/\//, '') : undefined;
  return {
    status: {
      enabled: true,
      provider: 'ngrok',
      protocol: 'tcp',
      localPort: port,
      publicAddress,
    },
    close: () => closeNgrok(listener),
  };
}

export function normalizePublishSetting(
  setting: PublishSetting,
  version: Version
): PublishSetting {
  if (version.type === 'bedrock' && setting.provider === 'ngrok') {
    return {
      enabled: setting.enabled,
      provider: 'playit',
      protocol: 'udp',
    };
  }

  if (setting.provider === 'playit') {
    return {
      ...setting,
      protocol: version.type === 'bedrock' ? 'udp' : setting.protocol,
    };
  }

  return setting;
}
