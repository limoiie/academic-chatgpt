use std::sync::Arc;

use serde::Deserialize;
use specta::Type;
use tauri::State;

use crate::core::db::*;
use crate::core::fs::hash_file_in_md5;

type DbState<'a> = State<'a, Arc<PrismaClient>>;

///
/// Documents operations
///

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_documents(db: DbState<'_>) -> crate::Result<Vec<document::Data>> {
    db.document()
        .find_many(vec![])
        .exec()
        .await
        .map_err(crate::Error::from)
}

#[derive(Deserialize, Type)]
pub(crate) struct CreateDocumentData {
    filename: String,
    filepath: String,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn create_document(
    db: DbState<'_>,
    data: CreateDocumentData,
) -> crate::Result<document::Data> {
    let md5_hash = hash_file_in_md5(&data.filepath).await?;
    let update_time = prisma_client_rust::chrono::prelude::Local::now().into();
    db.document()
        .create(data.filename, data.filepath, md5_hash, update_time, vec![])
        .exec()
        .await
        .map_err(crate::Error::from)
}

///
/// Collections operations
///

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_collections(db: DbState<'_>) -> crate::Result<Vec<collection::Data>> {
    db.collection()
        .find_many(vec![])
        .exec()
        .await
        .map_err(crate::Error::from)
}

#[derive(Deserialize, Type)]
pub(crate) struct CreateCollectionData {
    name: String,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn create_collection(
    db: DbState<'_>,
    data: CreateCollectionData,
) -> crate::Result<collection::Data> {
    db.collection()
        .create(data.name, vec![])
        .exec()
        .await
        .map_err(crate::Error::from)
}

///
/// Index operations
///

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_indexes(db: DbState<'_>) -> crate::Result<Vec<index::Data>> {
    db.index()
        .find_many(vec![])
        .exec()
        .await
        .map_err(crate::Error::from)
}

#[derive(Deserialize, Type)]
pub(crate) struct CreateIndexData {
    name: String,
    client: String,
    meta: serde_json::Value,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn create_index(
    db: DbState<'_>,
    data: CreateIndexData,
) -> crate::Result<index::Data> {
    let meta = serde_json::to_string(&data.meta)?;
    let update_time = prisma_client_rust::chrono::prelude::Local::now().into();
    db.index()
        .create(data.name, data.client, meta, update_time, vec![])
        .exec()
        .await
        .map_err(crate::Error::from)
}

///
/// Embeddings operations
///

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_embeddings(db: DbState<'_>) -> crate::Result<Vec<embeddings::Data>> {
    db.embeddings()
        .find_many(vec![])
        .exec()
        .await
        .map_err(crate::Error::from)
}

#[derive(Deserialize, Type)]
pub(crate) struct CreateEmbeddingsData {
    name: String,
    client: String,
    meta: serde_json::Value,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn create_embeddings(
    db: DbState<'_>,
    data: CreateEmbeddingsData,
) -> crate::Result<embeddings::Data> {
    let meta = serde_json::to_string(&data.meta)?;
    let update_time = prisma_client_rust::chrono::prelude::Local::now().into();
    db.embeddings()
        .create(data.name, data.client, meta, update_time, vec![])
        .exec()
        .await
        .map_err(crate::Error::from)
}

///
/// Sessions operations
///

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_sessions(db: DbState<'_>) -> crate::Result<Vec<session::Data>> {
    db.session()
        .find_many(vec![])
        .exec()
        .await
        .map_err(crate::Error::from)
}

#[derive(Deserialize, Type)]
pub(crate) struct CreateSessionsData {
    name: String,
    collection_id: i32,
    embeddings_id: i32,
    index_id: i32,
    history: serde_json::Value,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn create_session(
    db: DbState<'_>,
    data: CreateSessionsData,
) -> crate::Result<session::Data> {
    let history = serde_json::to_string(&data.history)?;
    db.session()
        .create(
            data.name,
            collection::id::equals(data.collection_id),
            indexes_on_embeddings::embeddings_id_index_id(data.embeddings_id, data.index_id),
            history,
            vec![],
        )
        .exec()
        .await
        .map_err(crate::Error::from)
}
