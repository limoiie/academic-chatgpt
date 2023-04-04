use tauri::{AppHandle, command, Manager, Runtime};

use crate::core::result as result;

#[command]
pub(crate) fn split_documents<R: Runtime>(app: AppHandle<R>) -> String {
    let fs_scope = app.fs_scope();
    format!("Split! {fs_scope:#?}")
}

#[command]
pub(crate) async fn read_file(file_path: String) -> result::Result<Vec<u8>> {
    tokio::fs::read(file_path).await.map_err(result::Error::from)
}
