use crate::commands::db::DbState;
use crate::prisma::{collection, collections_on_documents, document};

#[tauri::command]
#[specta::specta]
pub async fn delete_collection_on_documents(
    db: DbState<'_>,
    collection_id: i32,
) -> crate::Result<i32> {
    Ok(db
        .collections_on_documents()
        .delete_many(vec![collections_on_documents::collection_id::equals(
            collection_id,
        )])
        .exec()
        .await? as i32)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_documents_in_collection(
    db: DbState<'_>,
    collection_id: i32,
    document_ids: Vec<i32>,
) -> crate::Result<i32> {
    Ok(db
        .collections_on_documents()
        .delete_many(vec![
            collections_on_documents::collection_id::equals(collection_id),
            collections_on_documents::document_id::in_vec(document_ids),
        ])
        .exec()
        .await? as i32)
}

#[tauri::command]
#[specta::specta]
pub async fn add_documents_to_collection(
    db: DbState<'_>,
    collection_id: i32,
    document_ids: Vec<i32>,
) -> crate::Result<Vec<collections_on_documents::Data>> {
    Ok(db
        ._batch(
            document_ids
                .into_iter()
                .map(|document_id| {
                    db.collections_on_documents().upsert(
                        collections_on_documents::collection_id_document_id(
                            collection_id,
                            document_id,
                        ),
                        (
                            collection::id::equals(collection_id),
                            document::id::equals(document_id),
                            vec![],
                        ),
                        vec![
                            collections_on_documents::collection_id::set(collection_id),
                            collections_on_documents::document_id::set(document_id),
                        ],
                    )
                })
                .collect::<Vec<_>>(),
        )
        .await?)
}
