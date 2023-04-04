#![cfg_attr(
all(not(debug_assertions), target_os = "windows"),
windows_subsystem = "windows"
)]

use commands::process_documents;

mod commands;
mod core;

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![process_documents::split_documents, process_documents::read_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
