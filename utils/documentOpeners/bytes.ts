import { readBinaryFile } from '@tauri-apps/api/fs';

export async function openBinaryDocument(filePathOrBlob: string | Blob) {
  let bytes;
  let metadata;
  if (typeof filePathOrBlob === 'string') {
    bytes = await readBinaryFile(filePathOrBlob);
    metadata = { source: filePathOrBlob };
  } else {
    bytes = await filePathOrBlob.arrayBuffer().then((arr) => new Uint8Array(arr));
    metadata = { source: 'blob', blobType: filePathOrBlob.type };
  }
  return { bytes, metadata };
}
