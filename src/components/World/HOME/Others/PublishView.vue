<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import type { PublishProvider } from 'app/src-electron/schema/publish';
import { $T, tError } from 'src/i18n/utils/tFunc';
import { useConsoleStore } from 'src/stores/ConsoleStore';
import { useMainStore } from 'src/stores/MainStore';
import { useSystemStore } from 'src/stores/SystemStore';
import { checkError } from 'src/components/Error/Error';
import SsBtn from 'src/components/util/base/ssBtn.vue';
import NgrokSettingDialog from './Ngrok/NgrokSettingDialog.vue';
import { NgrokDialogProp, NgrokDialogReturns } from './Ngrok/steps/iNgrok';

const $q = useQuasar();
const sysStore = useSystemStore();
const mainStore = useMainStore();
const consoleStore = useConsoleStore();

const providerOptions: { label: string; value: PublishProvider }[] = [
  { label: $T('home.publish.none'), value: 'none' },
  { label: $T('home.publish.ngrok'), value: 'ngrok' },
  { label: $T('home.publish.playit'), value: 'playit' },
];


const canEdit = computed(() => consoleStore.isAllWorldStop());
const isBedrock = computed(() => mainStore.world?.version.type === 'bedrock');
const isUseNgrok = () => (sysStore.systemSettings.user.ngrokToken ?? '') !== '';

const publishEnabled = computed({
  get: () => mainStore.world?.publish_setting.enabled ?? false,
  set: (value) => {
    if (!mainStore.world) return;
    mainStore.world.publish_setting.enabled = value;
    if (!value) {
      mainStore.world.publish_setting.provider = 'none';
      mainStore.world.ngrok_setting.use_ngrok = false;
    } else if (mainStore.world.publish_setting.provider === 'none') {
      mainStore.world.publish_setting.provider = isBedrock.value
        ? 'playit'
        : 'ngrok';
    }
  },
});

const provider = computed({
  get: () => mainStore.world?.publish_setting.provider ?? 'none',
  set: (value: PublishProvider) => {
    if (!mainStore.world) return;
    const next = isBedrock.value && value === 'ngrok' ? 'playit' : value;
    mainStore.world.publish_setting.provider = next;
    mainStore.world.publish_setting.enabled = next !== 'none';
    mainStore.world.publish_setting.protocol =
      isBedrock.value || next === 'playit' ? 'udp' : 'tcp';
    mainStore.world.ngrok_setting.use_ngrok = next === 'ngrok';
  },
});

function onNgrokClick() {
  $q.dialog({
    component: NgrokSettingDialog,
    componentProps: {
      token: sysStore.systemSettings.user.ngrokToken ?? '',
    } as NgrokDialogProp,
  }).onOk((p: NgrokDialogReturns) => {
    sysStore.systemSettings.user.ngrokToken = p.token;
    if (p.isAllUesNgrok) {
      mainStore.allWorlds.update((w) => {
        if (w.version.type !== 'bedrock') {
          w.ngrok_setting.use_ngrok = true;
          w.publish_setting = {
            enabled: true,
            provider: 'ngrok',
            protocol: 'tcp',
          };
        }
      });
    }
  });
}

async function clearPlayitCache() {
  const result = await window.API.invokeClearManagedRuntimeCache('playit');
  checkError(result, undefined, (e) => tError(e));
}
</script>

<template>
  <p class="text-caption" style="white-space: pre-line; opacity: 0.6">
    {{ isBedrock ? $T('home.publish.bedrockNotice') : $T('home.ngrok.desc') }}
  </p>
  <p
    v-if="provider === 'playit'"
    class="text-caption"
    style="white-space: pre-line; opacity: 0.6"
  >
    {{ $T('home.publish.playitNotice') }}
  </p>

  <div class="row items-center q-gutter-md">
    <q-toggle
      v-model="publishEnabled"
      :label="
        publishEnabled ? $T('home.publish.enabled') : $T('home.publish.disabled')
      "
      :disable="!canEdit"
    />
    <q-select
      v-model="provider"
      :options="providerOptions"
      emit-value
      map-options
      dense
      outlined
      :label="$T('home.publish.provider')"
      :disable="!canEdit || !publishEnabled"
      style="min-width: 14rem"
    />
    <SsBtn
      v-if="provider === 'ngrok'"
      :label="$t(isUseNgrok() ? 'home.ngrok.btnRegisted' : 'home.ngrok.btn')"
      :disable="!canEdit"
      @click="onNgrokClick"
    />
    <SsBtn
      v-if="provider === 'playit'"
      :label="$T('home.publish.reinstallPlayit')"
      :disable="!canEdit"
      @click="clearPlayitCache"
    />
  </div>
</template>
