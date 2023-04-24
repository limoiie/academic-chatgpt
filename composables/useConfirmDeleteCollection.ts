import { ExclamationCircleOutlined } from '@ant-design/icons-vue';
import { createVNode } from '@vue/runtime-core';
import { message, Modal } from 'ant-design-vue';
import { useCollectionStore } from '~/store/collections';

/**
 * Open a confirm dialog to delete collection.
 */
export async function useConfirmDeleteCollection(collectionId: number, e: Event | undefined = undefined) {
  Modal.confirm({
    title: 'Do you want to continue?',
    icon: createVNode(ExclamationCircleOutlined),
    content: 'Delete collection will delete all its indexes and chat sessions.',
    okText: 'Yes',
    async onOk() {
      await deleteCollection(collectionId);
    },
  });
  e?.stopPropagation();
}

async function deleteCollection(collectionId: number) {
  const collectionStore = useCollectionStore();
  await collectionStore
    .deleteCollectionById(collectionId)
    .then(({ deleted, fallback }) => {
      if (!deleted) {
        message.warn(`Unable to delete collection#${collectionId}: not found`);
        return undefined;
      }
      message.info(`Deleted collection#${collectionId}!`);
      return fallback;
    })
    .then((fallback) => {
      if (fallback) {
        navigateTo(`/main/collections/${fallback.id}`);
      } else if (fallback === null) {
        navigateTo('/main/collections');
      }
    })
    .catch((e) => {
      message.error(`Failed to delete collection: ${errToString(e)}`);
    });
}
