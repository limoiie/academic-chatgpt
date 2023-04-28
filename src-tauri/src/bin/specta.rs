extern crate app;

use app::commands::{db, fs};

fn main() {
    generate_tauri_specta_bindings("./plugins/tauri/bindings.ts")
        .expect("error while generating tauri specta bindings");
}

/// Generate typescript bindings for invoke commands.
///
/// This will generate a well-typed binding ts file that wraps the raw tauri invoke, so that we can
/// call them as normally ts functions.
///
/// # Arguments
///
/// * `export_path`: where the bindings file should be exported to.
///
// noinspection DuplicatedCode
fn generate_tauri_specta_bindings<P: AsRef<std::path::Path>>(
    export_path: P,
) -> Result<(), specta::ts::TsExportError> {
    tauri_specta::ts::export(
        specta::collect_types![
            db::splittings::get_or_create_splitting,
            db::documents::get_documents,
            db::documents::get_documents_by_collection_id,
            db::documents::get_or_create_document,
            db::documents::add_documents,
            db::documents::delete_document,
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
            db::sessions::update_session,
            fs::hash_str_in_md5
        ],
        export_path,
    )
}
