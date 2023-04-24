#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

extern crate app;
extern crate dotenv;

use tauri::Manager;

use app::commands::db;

const DB_NAME: &str = "dev.db";

#[tokio::main]
async fn main() {
    let tauri_builder = tauri::Builder::default();
    #[cfg(feature = "http-invoke")]
    let tauri_builder = switch_to_http_invoke_system(tauri_builder);

    let app = register_invoke_handlers(tauri_builder)
        .plugin(tauri_plugin_store::Builder::default().build())
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    prepare_env(&app);
    prepare_prisma_db(&app).await;

    app.run(|_, _| {});
}

fn prepare_env(app: &tauri::App<tauri::Wry>) {
    // read env variables
    dotenv::dotenv().ok();

    let path_resolver = app.app_handle().app_handle().path_resolver();

    // prepare config dir
    let app_config_dir = path_resolver
        .app_config_dir()
        .expect("error while getting app config dir");
    if !app_config_dir.exists() {
        std::fs::create_dir_all(&app_config_dir).expect("error while creating app config dir");
    }
}

/// Register all invoke handlers.
///
/// Registered handlers can be called from the frontend using `invoke`.
///
/// # Arguments
///
/// * `tauri_builder`:
///
/// returns: Builder<Wry<EventLoopMessage>>
///
// noinspection DuplicatedCode
fn register_invoke_handlers(
    tauri_builder: tauri::Builder<tauri::Wry>,
) -> tauri::Builder<tauri::Wry> {
    tauri_builder.invoke_handler(tauri::generate_handler![
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
}

/// Switch the default tauri invoke system to HTTP.
///
/// The original tauri invoke system is based on IPC. When you want to run tauri app inner a
/// browser, the ipc system is not available. So for using tauri in browser, we need to switch
/// the invoke system to HTTP to cross the browser's security policy.
///
/// The invoke port is set by the environment variable `INVOKE_PORT`. If the environment variable
/// is not set, the default port is 8080.
///
/// # Arguments
///
/// * `tauri_builder`:
///
/// returns: Builder<Wry<EventLoopMessage>>
///
#[cfg(feature = "http-invoke")]
fn switch_to_http_invoke_system(
    tauri_builder: tauri::Builder<tauri::Wry>,
) -> tauri::Builder<tauri::Wry> {
    #[cfg(feature = "custom-protocol")]
    let allowed_origins = ["tauri://localhost"];
    #[cfg(not(feature = "custom-protocol"))]
    let allowed_origins = ["http://localhost:3000"];

    let invoke_port = std::env::var("NUXT_INVOKE_PORT")
        .unwrap_or(Default::default())
        .parse()
        .unwrap_or(8080u16);

    let http = crate::core::http_invoke::Invoke::new(allowed_origins, invoke_port);

    println!("Listening on port {} for HTTP invoke system.", invoke_port);
    tauri_builder
        .invoke_system(http.initialization_script(), http.responder())
        .setup(move |app| {
            http.start(app.handle());
            Ok(())
        })
}

/// Prepare the prisma database.
///
/// Connect to the prisma database and create the database if it does not exist. The prisma
/// database is a sqlite database.
///
/// # Arguments
///
/// * `app`:
///
async fn prepare_prisma_db(app: &tauri::App<tauri::Wry>) {
    let db = {
        let app_config_dir = app
            .app_handle()
            .path_resolver()
            .app_config_dir()
            .expect("error while getting app config dir");
        let url = "file:".to_string()
            + app_config_dir
                .join(DB_NAME)
                .to_str()
                .expect("error while getting db path");
        app::prisma::PrismaClient::_builder()
            .with_url(url)
            .build()
            .await
            .expect("error while building prisma client")
    };

    #[cfg(debug_assertions)]
    db._db_push().await.expect("error while pushing db");
    #[cfg(not(debug_assertions))]
    db._migrate_deploy()
        .await
        .expect("error while migrating db");

    app.manage(std::sync::Arc::new(db));
}
