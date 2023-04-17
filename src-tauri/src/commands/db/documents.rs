use crate::commands::db::DbState;
use crate::core::fs::hash_file_in_md5;
use crate::prisma::{collections_on_documents, document};
use serde::Deserialize;
use specta::Type;

///
/// Documents operations
///

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_documents(db: DbState<'_>) -> crate::Result<Vec<document::Data>> {
    Ok(db.document().find_many(vec![]).exec().await?)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_documents_by_collection_id(
    db: DbState<'_>,
    collection_id: i32,
) -> crate::Result<Vec<document::Data>> {
    let doc_ids = db
        .collections_on_documents()
        .find_many(vec![collections_on_documents::collection_id::equals(
            collection_id,
        )])
        .exec()
        .await?
        .into_iter()
        .map(|rel| rel.document_id);
    let data = db
        ._batch(doc_ids.into_iter().map(|document_id| {
            db.document()
                .find_first(vec![document::id::equals(document_id)])
        }))
        .await?
        .into_iter()
        .flatten()
        .collect::<Vec<_>>();
    Ok(data)
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
    Ok(db
        .document()
        .create(data.filename, data.filepath, md5_hash, update_time, vec![])
        .exec()
        .await?)
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
        Ok(db
            .document()
            .create(data.filename, data.filepath, md5_hash, update_time, vec![])
            .exec()
            .await?)
    }
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn add_documents(
    db: DbState<'_>,
    documents: Vec<CreateDocumentData>,
) -> crate::Result<Vec<document::Data>> {
    let mut docs = vec![];
    for document in documents {
        let doc = get_or_create_document(db.clone(), document).await?;
        docs.push(doc);
    }
    Ok(docs)
}
