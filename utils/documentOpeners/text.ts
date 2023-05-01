import { readTextFile } from '@tauri-apps/api/fs';

export async function openTextDocument(filePathOrBlob: string | Blob) {
  let text;
  let metadata: { source: string; [key: string]: any };
  if (typeof filePathOrBlob === 'string') {
    text = await readTextFile(filePathOrBlob);
    metadata = { source: filePathOrBlob };
  } else {
    text = await filePathOrBlob.text();
    metadata = { source: 'blob', blobType: filePathOrBlob.type };
  }
  return { text, metadata };
}
