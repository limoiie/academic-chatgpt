<template>
  <a-drawer
    title="Createing new index profile"
    :visible="visible"
    @update:visible="emits('update:visible')"
    width="480"
  >
    <a-space class="w-full" direction="vertical">
      <a-form class="form" :model="formState" :label-col="{ span: 11 }">
        <a-form-item
          label="Index Profile Name"
          name="name"
          :rules="[
            { required: true, message: 'Missing profile name.', trigger: ['blur', 'change'] },
            {
              validator: notInValidate(indexProfileNames),
              message: 'Name already exists',
              trigger: ['blur', 'change'],
            },
          ]"
        >
          <a-input v-model:value="formState.name" />
        </a-form-item>

        <a-form-item label="Chunk Size / Overlap">
          <a-input-group>
            <a-input-number v-model:value="formState.chunkSize" />
            <span> / </span>
            <a-input-number v-model:value="formState.chunkOverlap" />
          </a-input-group>
        </a-form-item>

        <a-form-item label="Embedding Client">
          <SelectOrCreateEmbeddingsClient class="flex" v-model:value="formState.embeddingsClient" />
        </a-form-item>

        <a-form-item label="Embeddings Configuration">
          <SelectOrCreateEmbeddingsConfig
            class="flex"
            :client-type="formState.embeddingsClient?.type"
            v-model:value="formState.embeddingsConfig"
          />
        </a-form-item>

        <a-form-item label="Vectorstore Client">
          <SelectOrCreateVectorDbClient class="flex" v-model:value="formState.vectorDbClient" />
        </a-form-item>

        <a-form-item label="Vectorstore Configuration">
          <SelectOrCreateVectorDbConfig
            class="flex"
            :client-type="formState.vectorDbClient?.type"
            v-model:value="formState.vectorDbConfig"
          />
        </a-form-item>
      </a-form>

      <a-button type="primary" @click="create" :loading="isChildCreating" :disabled="!isFormValid">Create</a-button>
    </a-space>
  </a-drawer>
</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia';
import { defineEmits, reactive, ref } from 'vue';
import {
  EmbeddingsClientExData,
  EmbeddingsConfigExData,
  VectorDbClientExData,
  VectorDbConfigExData,
} from '~/plugins/tauri/bindings';
import { useIndexProfileStore } from '~/store/indexProfiles';

const isChildCreating = ref(false);
const emits = defineEmits(['onCreate']);
const { visible } = defineProps<{
  visible: boolean;
}>();

const indexProfileStore = useIndexProfileStore();
const { indexProfileNames } = storeToRefs(indexProfileStore);

onMounted(async () => {
  await indexProfileStore.load();
});

interface FormState {
  name: string;
  chunkOverlap: number;
  chunkSize: number;
  embeddingsClient: EmbeddingsClientExData | undefined;
  embeddingsConfig: EmbeddingsConfigExData | undefined;
  vectorDbClient: VectorDbClientExData | undefined;
  vectorDbConfig: VectorDbConfigExData | undefined;
}

const formState = reactive<FormState>({
  name: 'default',
  chunkSize: 1000,
  chunkOverlap: 200,
  embeddingsClient: undefined,
  embeddingsConfig: undefined,
  vectorDbClient: undefined,
  vectorDbConfig: undefined,
});
const isFormValid = computed(() => {
  console.log(
    'computed',
    formState.chunkSize,
    formState.chunkOverlap,
    formState.vectorDbConfig,
    formState.vectorDbClient,
    formState.embeddingsConfig,
    formState.embeddingsClient,
    formState.name,
  );
  return (
    formState.chunkSize > formState.chunkOverlap &&
    formState.chunkOverlap > 0 &&
    formState.vectorDbConfig != undefined &&
    formState.vectorDbClient != undefined &&
    formState.embeddingsConfig != undefined &&
    formState.embeddingsClient != undefined &&
    formState.name
  );
});

function create() {
  //   todo: create the index
}
</script>

<style scoped></style>
