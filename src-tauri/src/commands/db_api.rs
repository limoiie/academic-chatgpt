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

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_or_create_document(
    db: DbState<'_>,
    data: CreateDocumentData,
) -> crate::Result<document::Data> {
    let md5_hash = hash_file_in_md5(&data.filepath).await?;
    let found = db
        .document()
        .find_first(vec![document::md_5_hash::equals(md5_hash.clone())])
        .exec()
        .await?;

    if let Some(found) = found {
        Ok(found)
    } else {
        let update_time = prisma_client_rust::chrono::prelude::Local::now().into();
        db.document()
            .create(data.filename, data.filepath, md5_hash, update_time, vec![])
            .exec()
            .await
            .map_err(crate::Error::from)
    }
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
    documents: Vec<CreateDocumentData>,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn create_collection(
    db: DbState<'_>,
    data: CreateCollectionData,
) -> crate::Result<collection::Data> {
    let collection = db
        .collection()
        .create(data.name, vec![])
        .exec()
        .await
        .map_err(crate::Error::from)?;

    for doc_create_data in data.documents {
        let doc = get_or_create_document(db.clone(), doc_create_data).await?;
        db.collections_on_documents()
            .create(
                collection::id::equals(collection.id),
                document::id::equals(doc.id),
                vec![],
            )
            .exec()
            .await?;
    }
    Ok(collection)
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
/// Index-Embeddings operations
///

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_index_on_embeddings(
    db: DbState<'_>,
) -> crate::Result<Vec<indexes_on_embeddings::Data>> {
    db.indexes_on_embeddings()
        .find_many(vec![])
        .exec()
        .await
        .map_err(crate::Error::from)
}

#[derive(Deserialize, Type)]
pub(crate) struct CreateIndexOnEmbeddingsData {
    embeddings_id: i32,
    index_id: i32,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_or_create_index_on_embeddings(
    db: DbState<'_>,
    data: CreateIndexOnEmbeddingsData,
) -> crate::Result<indexes_on_embeddings::Data> {
    let existing = db
        .indexes_on_embeddings()
        .find_first(vec![indexes_on_embeddings::embeddings_id_index_id(
            data.embeddings_id,
            data.index_id,
        )])
        .exec()
        .await?;

    if let Some(existing) = existing {
        Ok(existing)
    } else {
        db.indexes_on_embeddings()
            .create(
                index::id::equals(data.index_id),
                embeddings::id::equals(data.embeddings_id),
                vec![],
            )
            .exec()
            .await
            .map_err(crate::Error::from)
    }
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_index_embeddings_by_collection(
    db: DbState<'_>,
    collection_id: i32,
) -> crate::Result<Vec<index_embeddings_on_collection::Data>> {
    db.index_embeddings_on_collection()
        .find_many(vec![index_embeddings_on_collection::collection_id::equals(
            collection_id,
        )])
        .exec()
        .await
        .map_err(crate::Error::from)
}

#[derive(Deserialize, Type)]
pub(crate) struct CreateIndexEmbeddingsByCollection {
    collection_id: i32,
    embeddings_id: i32,
    index_id: i32,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn create_index_embeddings_collection(
    db: DbState<'_>,
    data: CreateIndexEmbeddingsByCollection,
) -> crate::Result<index_embeddings_on_collection::Data> {
    let index_on_embeddings = get_or_create_index_on_embeddings(
        db.clone(),
        CreateIndexOnEmbeddingsData {
            index_id: data.index_id,
            embeddings_id: data.embeddings_id,
        },
    )
    .await?;

    db.index_embeddings_on_collection()
        .create(
            collection::id::equals(data.collection_id),
            indexes_on_embeddings::embeddings_id_index_id(
                index_on_embeddings.embeddings_id,
                index_on_embeddings.index_id,
            ),
            vec![],
        )
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
            index_embeddings_on_collection::collection_id_embeddings_id_index_id(
                data.collection_id,
                data.embeddings_id,
                data.index_id,
            ),
            history,
            vec![],
        )
        .exec()
        .await
        .map_err(crate::Error::from)
}
