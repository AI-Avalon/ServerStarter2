<script setup lang="ts">
import { computed } from 'vue';
import {
  AllBedrockVersion,
  BedrockVersion,
} from 'app/src-electron/schema/version';
import { isError } from 'app/src-public/scripts/error';
import { $T } from 'src/i18n/utils/tFunc';
import { useConsoleStore } from 'src/stores/ConsoleStore';
import { useMainStore } from 'src/stores/MainStore';
import SsSelect from 'src/components/util/base/ssSelect.vue';

interface Prop {
  versionData: AllBedrockVersion;
}
const prop = defineProps<Prop>();

const mainStore = useMainStore();
const consoleStore = useConsoleStore();

function buildBedrockVer(ver: AllBedrockVersion[number]): BedrockVersion {
  return {
    type: 'bedrock',
    id: ver.id,
    platform: ver.platform,
    url: ver.url,
  };
}

function updateWorldVersion(ver: AllBedrockVersion[number]) {
  if (mainStore.world?.version) {
    mainStore.world.version = buildBedrockVer(ver);
    if (!isError(mainStore.world.properties)) {
      mainStore.world.properties['server-port'] = 19132;
      mainStore.world.properties['query.port'] = 19132;
    }
    mainStore.world.publish_setting = {
      enabled: true,
      provider: 'playit',
      protocol: 'udp',
    };
    mainStore.world.ngrok_setting.use_ngrok = false;
  }
}

const bedrockVer = computed({
  get: () => {
    const ver = mainStore.world?.version;
    if (!ver || ver.type !== 'bedrock') return prop.versionData[0];
    return (
      prop.versionData.find(
        (data) => data.id === ver.id && data.platform === ver.platform
      ) ?? prop.versionData[0]
    );
  },
  set: (val) => updateWorldVersion(val),
});

if (bedrockVer.value) {
  updateWorldVersion(bedrockVer.value);
}
</script>

<template>
  <SsSelect
    v-model="bedrockVer"
    :options="
      versionData.map((ver, idx) => {
        return {
          data: ver,
          label:
            idx === 0
              ? `${ver.id} ${ver.platform}【${$T('home.version.latestVersion')}】`
              : `${ver.id} ${ver.platform}`,
        };
      })
    "
    :label="$T('home.version.versionType')"
    option-label="label"
    option-value="data"
    :disable="consoleStore.status(mainStore.selectedWorldID) !== 'Stop'"
    class="col"
    style="min-width: 10rem"
  />
</template>
