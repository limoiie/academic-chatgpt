<template>
  <a-list class="log-console" :data-source="logs">
    <!--suppress VueUnrecognizedSlot -->
    <template #renderItem="{ item }">
      <a-list-item>
        <!--suppress TypeScriptUnresolvedReference -->
        <p>{{ item.level }}: {{ item.message }}</p>
        <p class="w-32 text-end col-span-1 whitespace-nowrap">[{{ (item.timestamp as Date).toLocaleTimeString() }}]</p>
      </a-list-item>
    </template>

    <!--suppress VueUnrecognizedSlot -->
    <template #footer ref="bottom" />
  </a-list>
</template>

<script setup lang="ts">
const bottom = ref<Element | null>(null);
const props = defineProps<{ scrollToEnd: boolean; logs: LogMessage[] }>();
const { scrollToEnd, logs } = props;
watch(toRef(props, 'scrollToEnd'), () => {
  console.log('updated', bottom.value)
  bottom.value?.scrollIntoView({ behavior: 'smooth', block: 'end' });
});
</script>

<style lang="sass">
.log-console
  .ant-list-footer
    padding: 0

  .ant-list-items
    padding: 8px
    background: #fafafa
    border-radius: 4px

  li
    &.ant-list-item
      padding: 0
      border: 0 !important

    &.ant-list-item:hover
      background: #e6f7ff

    p
      margin: 0
</style>
