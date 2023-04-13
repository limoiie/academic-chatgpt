<template>
  <a-form :model="formState">
    <!-- Config Name -->
    <a-form-item
      label="Name"
      name="configName"
      :rules="[{ required: true, message: 'Please choose an unique name for this config!' }]"
    >
      <a-input v-model:value="formState.name" />
    </a-form-item>
    <!-- Index Client -->
    <a-form-item label="Client" name="client" :rules="[{ required: true }]">
      <div class="border px-2 pb-2">
        <a-tabs v-model:activeKey="formState.clientType">
          <!-- Pinecone panel -->
          <a-tab-pane key="pinecone" tab="Pinecone">
            <a-form :model="formState.meta">
              <a-form-item label="Api Key" name="apiKey" :rules="[{ required: true }]">
                <a-input v-model:value="formState.meta.apiKey" />
              </a-form-item>
              <a-form-item label="Environment" name="environment" :rules="[{ required: true }]">
                <a-input v-model:value="formState.meta.environment" />
              </a-form-item>
              <a-form-item label="Index Name" name="indexName" :rules="[{ required: true }]">
                <a-input v-model:value="formState.meta.indexName" />
              </a-form-item>
              <a-tooltip>
                <template #title>OpenAI only supports 1536 so far</template>
                <a-form-item label="Embedding Dim" name="dimension" :rules="[{ required: true }]">
                  <a-input-number v-model:value="formState.meta.dimension" :default-value="1536" />
                </a-form-item>
              </a-tooltip>
              <a-form-item label="Similarity Metric" name="metric" :rules="[{ required: true }]">
                <a-select v-model:value="formState.meta.metric" :options="pineconeMetrics" />
              </a-form-item>
            </a-form>
          </a-tab-pane>
        </a-tabs>
      </div>
    </a-form-item>
  </a-form>
</template>

<script setup lang="ts">
const pineconeMetrics = [
  {
    label: 'Cosine',
    value: 'cosine',
  },
];

const formState = useState<CreateVectorDbConfigFormState>('creatingVectorDbConfig', () => {
  return {
    clientType: 'pinecone',
    name: '',
    meta: {
      metric: 'cosine'
    },
  };
});
</script>
