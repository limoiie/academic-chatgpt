<template>
  <a-form :model="formState">
    <!-- Config Name -->
    <a-form-item
      label="Name"
      name="configName"
      :rules="[{ required: true, message: 'Please choose an unique name for this config!' }]"
    >
      <a-input v-model:value="formState.configName" />
    </a-form-item>
    <!-- Embedding Client -->
    <a-form-item label="Client" name="client" :rules="[{ required: true }]">
      <div class="border px-2 pb-2">
        <a-tabs v-model:activeKey="formState.client">
          <!-- OpenAI panel -->
          <a-tab-pane key="openai" tab="OpenAI">
            <a-form :model="formState.meta">
              <a-form-item label="Api Key" name="apiKey" :rules="[{ required: true }]">
                <a-input v-model:value="formState.meta.apiKey" />
              </a-form-item>
              <a-tooltip>
                <template #title>OpenAI only supports 1536 so far</template>
                <a-form-item label="Embedding Dim" name="dimension" :rules="[{ required: true }]">
                  <a-input-number v-model:value="formState.meta.dimension" :default-value="1536" disabled />
                </a-form-item>
              </a-tooltip>
            </a-form>
          </a-tab-pane>
        </a-tabs>
      </div>
    </a-form-item>
  </a-form>
</template>

<script lang="ts"></script>

<script setup lang="ts">
const formState = useState<CreateEmbeddingsConfigFormState>('creatingEmbeddingsConfig', () => {
  return {
    client: 'openai',
    configName: '',
    meta: {},
  };
});
</script>
