<template>
  <div>
    <a-modal
      v-model:visible="isCreatingConfig"
      :confirm-loading="isConfirmLoading"
      @ok="onCreate"
      ok-text="Create"
      title="New Indexing Config"
    >
      <CreateIndexConfig :valid="false" />
    </a-modal>

    <a-space>
      <a-select
        ref="select"
        v-model:value="selectedConfigId"
        class="w-40"
        :options="availableConfigs"
        :field-names="{ label: 'label', value: 'value', options: 'options' }"
        :loading="isLoadingConfigs"
      />
      <a-button :disabled="isLoadingConfigs" shape="circle" @click="openNewConfigModal">
        <template #icon>
          <PlusCircleOutlined />
        </template>
      </a-button>
    </a-space>
  </div>
</template>

<script setup lang="ts">
import { PlusCircleOutlined } from '@ant-design/icons-vue';
import { message, SelectProps } from 'ant-design-vue';
import { integer } from 'vscode-languageserver-types';
import { Index } from '~/utils/bindings';

const isLoadingConfigs = ref(false);
const isCreatingConfig = ref(false);
const isConfirmLoading = ref(false);

const { configId } = defineProps<{ configId: integer | undefined }>();
const emits = defineEmits(['update:configId']);

const selectedConfigId = ref<number | undefined>(configId);
watch(selectedConfigId, (newConfigId) => {
  emits('update:configId', newConfigId);
});

function dbConfigToUi(config: Index) {
  return {
    value: config.id,
    label: config.name,
  };
}

const { data: availableConfigs } = useAsyncData('availableIndexConfigs', async () => {
  isLoadingConfigs.value = true;
  let data: SelectProps['options'] = [];
  try {
    const indexConfigs = await getIndexes();
    data = indexConfigs.map(dbConfigToUi);
  } catch (e) {
    message.error('Failed to load index configs');
  }
  isLoadingConfigs.value = false;
  return data;
});

async function openNewConfigModal() {
  isCreatingConfig.value = true;
}

async function onCreate() {
  isConfirmLoading.value = true;
  await nextTick(async () => {
    const conf = useState<CreateIndexConfigFormState>('creatingIndexConfig');
    if (conf.value) {
      // todo: validate

      // update db
      const newDbConf = await createIndex({
        client: conf.value.client,
        name: conf.value.configName,
        meta: conf.value.meta,
      });

      // update ui
      selectedConfigId.value = newDbConf.id;
      availableConfigs.value = [dbConfigToUi(newDbConf), ...(availableConfigs.value || [])];

      // notify
      message.info(`New ${conf.value.configName} Index Created!`);
    }

    isCreatingConfig.value = false;
    isConfirmLoading.value = false;
  });
}
</script>
