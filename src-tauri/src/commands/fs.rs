#[tauri::command]
#[specta::specta]
pub async fn hash_str_in_md5(data: String) -> crate::Result<String> {
    let digest = md5::compute(data);
    Ok(format!("{:x}", digest))
}
