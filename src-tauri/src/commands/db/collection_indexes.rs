use serde::Deserialize;
use specta::Type;

use crate::commands::db::{sessions, DbState};
use crate::prisma::{
    collection, collection_index, collection_index_on_document, document, index_profile,
};

collection_index::include!(collection_index_with_all {
    index: include {
        embeddings_client embeddings_config vector_db_client vector_db_config splitting
    }
    indexed_documents
});

#[tauri::command]
#[specta::specta]
pub(crate) async fn delete_collection_indexes_by_id(
    db: DbState<'_>,
    collection_index_ids: Vec<String>,
) -> crate::Result<i32> {
    sessions::delete_sessions_by_index_ids(db.clone(), collection_index_ids.clone()).await?;
    Ok(db
        .collection_index()
        .delete_many(vec![collection_index::id::in_vec(collection_index_ids)])
        .exec()
        .await? as i32)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn remove_documents_from_collection_index(
    db: DbState<'_>,
    index_id: String,
    document_ids: Vec<i32>,
) -> crate::Result<i32> {
    Ok(db
        .collection_index_on_document()
        .delete_many(vec![
            collection_index_on_document::index_id::equals(index_id),
            collection_index_on_document::document_id::in_vec(document_ids),
        ])
        .exec()
        .await? as i32)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_collection_indexes_by_collection_id(
    db: DbState<'_>,
    collection_id: i32,
) -> crate::Result<Vec<collection_index::Data>> {
    Ok(db
        .collection_index()
        .find_many(vec![collection_index::collection_id::equals(collection_id)])
        .exec()
        .await?)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_collection_indexes_by_collection_id_with_all(
    db: DbState<'_>,
    collection_id: i32,
) -> crate::Result<Vec<collection_index_with_all::Data>> {
    Ok(db
        .collection_index()
        .find_many(vec![collection_index::collection_id::equals(collection_id)])
        .include(collection_index_with_all::include())
        .exec()
        .await?)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_collection_index_by_id(
    db: DbState<'_>,
    collection_index_id: String,
) -> crate::Result<Option<collection_index::Data>> {
    Ok(db
        .collection_index()
        .find_unique(collection_index::id::equals(collection_index_id))
        .exec()
        .await?)
}

#[derive(Deserialize, Type)]
pub(crate) struct CreateCollectionIndexData {
    name: String,
    #[serde(rename = "collectionId")]
    collection_id: i32,
    #[serde(rename = "indexId")]
    index_id: i32,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn create_collection_index(
    db: DbState<'_>,
    data: CreateCollectionIndexData,
) -> crate::Result<collection_index::Data> {
    Ok(db
        .collection_index()
        .create(
            data.name,
            collection::id::equals(data.collection_id),
            index_profile::id::equals(data.index_id),
            vec![],
        )
        .exec()
        .await?)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn upsert_documents_in_collection_index(
    db: DbState<'_>,
    id: String,
    document_ids: Vec<i32>,
) -> crate::Result<Vec<collection_index_on_document::Data>> {
    Ok(db
        ._batch(document_ids.into_iter().map(|document_id| {
            db.collection_index_on_document().upsert(
                collection_index_on_document::index_id_document_id(id.clone(), document_id),
                (
                    collection_index::id::equals(id.clone()),
                    document::id::equals(document_id),
                    vec![],
                ),
                vec![
                    collection_index_on_document::index_id::set(id.clone()),
                    collection_index_on_document::document_id::set(document_id),
                ],
            )
        }))
        .await?)
}
