#![feature(slice_as_chunks)]
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::Manager;

use crate::commands::db;
pub(crate) use crate::core::result::Result;

mod commands;
mod core;
mod prisma;

const DB_NAME: &str = "dev.db";

#[tokio::main]
async fn main() {
    #[cfg(debug_assertions)]
    tauri_specta::ts::export(
        specta::collect_types![
            db::splittings::get_or_create_splitting,
            db::documents::get_documents,
            db::documents::get_documents_by_collection_id,
            db::documents::get_or_create_document,
            db::documents::add_documents,
            db::collections_on_documents::delete_collection_on_documents,
            db::collections_on_documents::delete_documents_in_collection,
            db::collections_on_documents::add_documents_to_collection,
            db::collections::delete_collection_by_id,
            db::collections::get_collection_by_id,
            db::collections::get_collections_with_indexes,
            db::collections::get_collections,
            db::collections::create_collection,
            db::collections::update_collection_name,
            db::vector_db_clients::get_vector_db_client_by_id,
            db::vector_db_clients::get_vector_db_clients,
            db::vector_db_clients::create_vector_db_client,
            db::vector_db_clients::upsert_vector_db_client,
            db::vector_db_configs::get_vector_db_config_by_id,
            db::vector_db_configs::get_vector_db_configs,
            db::vector_db_configs::create_vector_db_config,
            db::vector_db_configs::upsert_vector_db_config,
            db::embeddings_clients::get_embeddings_clients,
            db::embeddings_clients::get_embeddings_client_by_id,
            db::embeddings_clients::create_embeddings_client,
            db::embeddings_clients::upsert_embeddings_client,
            db::embeddings_configs::get_embeddings_configs_by_client_type,
            db::embeddings_configs::get_embeddings_config_by_id,
            db::embeddings_configs::get_embeddings_configs,
            db::embeddings_configs::create_embeddings_config,
            db::embeddings_configs::upsert_embeddings_config,
            db::document_chunks::get_chunk_md5hashes_by_documents_and_splitting,
            db::document_chunks::get_document_chunks,
            db::document_chunks::create_chunks_by_document,
            db::embedding_vectors::get_embedding_vector_by_md5hash,
            db::embedding_vectors::upsert_embedding_vector_by_md5hash,
            db::embedding_vectors::upsert_embedding_vector_by_md5hash_in_batch,
            db::index_profiles::get_index_profiles_with_all,
            db::index_profiles::get_index_profiles,
            db::index_profiles::get_index_profile_with_all_by_id,
            db::index_profiles::get_index_profile_by_id,
            db::index_profiles::create_index_profile_with_all,
            db::index_profiles::create_index_profile,
            db::collection_indexes::delete_collection_indexes_by_id,
            db::collection_indexes::get_collection_indexes_by_collection_id,
            db::collection_indexes::get_collection_indexes_by_collection_id_with_all,
            db::collection_indexes::get_collection_index_by_id,
            db::collection_indexes::create_collection_index,
            db::collection_indexes::upsert_documents_in_collection_index,
            db::collection_indexes::remove_documents_from_collection_index,
            db::sessions::delete_session_by_id,
            db::sessions::delete_sessions_by_index_id,
            db::sessions::get_sessions_by_index_id,
            db::sessions::get_sessions,
            db::sessions::create_session,
            db::sessions::update_session
        ],
        "../plugins/tauri/bindings.ts",
    )
    .unwrap();

    // todo: invoke via http server only if the feature is enabled
    let http = crate::core::http_invoke::Invoke::new(
        if cfg!(feature = "custom-protocol") {
            ["tauri://localhost"]
        } else {
            ["http://localhost:3000"]
        },
        8080,
    );

    let app = tauri::Builder::default()
        .invoke_system(http.initialization_script(), http.responder())
        .setup(move |app| {
            http.start(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::splittings::get_or_create_splitting,
            db::documents::get_documents,
            db::documents::get_documents_by_collection_id,
            db::documents::get_or_create_document,
            db::documents::add_documents,
            db::collections_on_documents::delete_collection_on_documents,
            db::collections_on_documents::delete_documents_in_collection,
            db::collections_on_documents::add_documents_to_collection,
            db::collections::delete_collection_by_id,
            db::collections::get_collection_by_id,
            db::collections::get_collections_with_indexes,
            db::collections::get_collections,
            db::collections::create_collection,
            db::collections::update_collection_name,
            db::vector_db_clients::get_vector_db_client_by_id,
            db::vector_db_clients::get_vector_db_clients,
            db::vector_db_clients::create_vector_db_client,
            db::vector_db_clients::upsert_vector_db_client,
            db::vector_db_configs::get_vector_db_config_by_id,
            db::vector_db_configs::get_vector_db_configs,
            db::vector_db_configs::create_vector_db_config,
            db::vector_db_configs::upsert_vector_db_config,
            db::embeddings_clients::get_embeddings_clients,
            db::embeddings_clients::get_embeddings_client_by_id,
            db::embeddings_clients::create_embeddings_client,
            db::embeddings_clients::upsert_embeddings_client,
            db::embeddings_configs::get_embeddings_configs_by_client_type,
            db::embeddings_configs::get_embeddings_config_by_id,
            db::embeddings_configs::get_embeddings_configs,
            db::embeddings_configs::create_embeddings_config,
            db::embeddings_configs::upsert_embeddings_config,
            db::document_chunks::get_chunk_md5hashes_by_documents_and_splitting,
            db::document_chunks::get_document_chunks,
            db::document_chunks::create_chunks_by_document,
            db::embedding_vectors::get_embedding_vector_by_md5hash,
            db::embedding_vectors::upsert_embedding_vector_by_md5hash,
            db::embedding_vectors::upsert_embedding_vector_by_md5hash_in_batch,
            db::index_profiles::get_index_profiles_with_all,
            db::index_profiles::get_index_profiles,
            db::index_profiles::get_index_profile_with_all_by_id,
            db::index_profiles::get_index_profile_by_id,
            db::index_profiles::create_index_profile_with_all,
            db::index_profiles::create_index_profile,
            db::collection_indexes::delete_collection_indexes_by_id,
            db::collection_indexes::get_collection_indexes_by_collection_id,
            db::collection_indexes::get_collection_indexes_by_collection_id_with_all,
            db::collection_indexes::get_collection_index_by_id,
            db::collection_indexes::create_collection_index,
            db::collection_indexes::upsert_documents_in_collection_index,
            db::collection_indexes::remove_documents_from_collection_index,
            db::sessions::delete_session_by_id,
            db::sessions::delete_sessions_by_index_id,
            db::sessions::get_sessions_by_index_id,
            db::sessions::get_sessions,
            db::sessions::create_session,
            db::sessions::update_session
        ])
        .plugin(tauri_plugin_store::Builder::default().build())
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    let db = {
        let app_config_dir = tauri::api::path::app_config_dir(app.config().as_ref())
            .expect("error while getting app config dir");
        let url = "file:".to_string()
            + app_config_dir
                .join(DB_NAME)
                .to_str()
                .expect("error while getting db path");
        prisma::PrismaClient::_builder()
            .with_url(url)
            .build()
            .await
            .expect("error while building prisma client")
    };

    #[cfg(debug_assertions)]
    db._db_push().await.expect("error while pushing db");

    app.manage(std::sync::Arc::new(db));
    app.run(|_, _| {});
}
