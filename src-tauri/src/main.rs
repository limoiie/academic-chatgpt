#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::sync::Arc;

use specta::collect_types;

use crate::commands::db_api;
use crate::core::db::*;
pub(crate) use crate::core::result::{Error, Result};

mod commands;
mod core;

#[tokio::main]
async fn main() {
    let db = PrismaClient::_builder().build().await.unwrap();

    #[cfg(debug_assertions)]
    tauri_specta::ts::export(
        collect_types![
            db_api::get_documents,
            db_api::create_document,
            db_api::get_collections,
            db_api::create_collection,
            db_api::get_indexes,
            db_api::create_index,
            db_api::get_embeddings,
            db_api::create_embeddings,
            db_api::get_sessions,
            db_api::create_session
        ],
        "../utils/bindings.ts",
    )
    .unwrap();

    #[cfg(debug_assertions)]
    db._db_push().await.unwrap();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            db_api::create_document,
            db_api::get_documents,
            db_api::get_collections,
            db_api::create_collection,
            db_api::get_indexes,
            db_api::create_index,
            db_api::get_embeddings,
            db_api::create_embeddings,
            db_api::get_sessions,
            db_api::create_session
        ])
        .manage(Arc::new(db))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
