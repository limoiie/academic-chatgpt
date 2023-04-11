#![feature(slice_as_chunks)]
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::sync::Arc;

use specta::collect_types;

use crate::commands::db_api;
pub(crate) use crate::core::result::Result;
use crate::prisma::*;

mod commands;
mod core;
pub(crate) mod prisma;

#[tokio::main]
async fn main() {
    let db = PrismaClient::_builder().build().await.unwrap();

    #[cfg(debug_assertions)]
    tauri_specta::ts::export(
        collect_types![
            db_api::get_or_create_splitting,
            db_api::get_documents,
            db_api::get_documents_by_collection_id,
            db_api::create_document,
            db_api::delete_collection_by_id,
            db_api::get_collection_by_id,
            db_api::get_collections_with_index_profiles,
            db_api::get_collections,
            db_api::create_collection,
            db_api::get_vector_db_config_by_id,
            db_api::get_vector_db_configs,
            db_api::create_vector_db_config,
            db_api::get_embeddings_clients,
            db_api::create_embeddings_client,
            db_api::get_embeddings_configs_by_client_type,
            db_api::get_embeddings_config_by_id,
            db_api::get_embeddings_configs,
            db_api::create_embeddings_config,
            db_api::get_document_chunks,
            db_api::create_chunks_by_document,
            db_api::get_embedding_vector_by_md5hash,
            db_api::upsert_embedding_vector_by_md5hash,
            db_api::upsert_embedding_vector_by_md5hash_in_batch,
            db_api::delete_index_profiles_by_id,
            db_api::get_index_profiles_by_collection_id,
            db_api::get_index_profiles_by_collection_id_with_all,
            db_api::get_index_profile_by_id,
            db_api::create_collection_index_profile,
            db_api::delete_session_by_id,
            db_api::delete_sessions_by_index_profile_id,
            db_api::get_sessions,
            db_api::create_session,
            db_api::update_session
        ],
        "../utils/bindings.ts",
    )
    .unwrap();

    #[cfg(debug_assertions)]
    db._db_push().await.unwrap();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            db_api::get_or_create_splitting,
            db_api::get_documents,
            db_api::get_documents_by_collection_id,
            db_api::create_document,
            db_api::delete_collection_by_id,
            db_api::get_collection_by_id,
            db_api::get_collections_with_index_profiles,
            db_api::get_collections,
            db_api::create_collection,
            db_api::get_vector_db_config_by_id,
            db_api::get_vector_db_configs,
            db_api::create_vector_db_config,
            db_api::get_embeddings_clients,
            db_api::create_embeddings_client,
            db_api::get_embeddings_configs_by_client_type,
            db_api::get_embeddings_config_by_id,
            db_api::get_embeddings_configs,
            db_api::create_embeddings_config,
            db_api::get_document_chunks,
            db_api::create_chunks_by_document,
            db_api::get_embedding_vector_by_md5hash,
            db_api::upsert_embedding_vector_by_md5hash,
            db_api::upsert_embedding_vector_by_md5hash_in_batch,
            db_api::delete_index_profiles_by_id,
            db_api::get_index_profiles_by_collection_id,
            db_api::get_index_profiles_by_collection_id_with_all,
            db_api::get_index_profile_by_id,
            db_api::create_collection_index_profile,
            db_api::delete_session_by_id,
            db_api::delete_sessions_by_index_profile_id,
            db_api::get_sessions,
            db_api::create_session,
            db_api::update_session
        ])
        .manage(Arc::new(db))
        .plugin(tauri_plugin_store::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
