use serde::Deserialize;
use specta::Type;

use crate::commands::db::documents::CreateDocumentData;
use crate::commands::db::{collection_indexes, collections_on_documents, documents, DbState};
use crate::prisma::{collection, document};

collection::include!(collection_with_indexes { indexes });

#[tauri::command]
#[specta::specta]
pub(crate) async fn delete_collection_by_id(
    db: DbState<'_>,
    collection_id: i32,
) -> crate::Result<collection::Data> {
    collections_on_documents::delete_collection_on_documents(db.clone(), collection_id).await?;
    collection_indexes::delete_collection_indexes_by_id(
        db.clone(),
        collection_indexes::get_collection_indexes_by_collection_id(db.clone(), collection_id)
            .await?
            .into_iter()
            .map(|p| p.id)
            .collect(),
    )
    .await?;
    Ok(db
        .collection()
        .delete(collection::id::equals(collection_id))
        .exec()
        .await?)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_collection_by_id(
    db: DbState<'_>,
    collection_id: i32,
) -> crate::Result<Option<collection::Data>> {
    Ok(db
        .collection()
        .find_first(vec![collection::id::equals(collection_id)])
        .exec()
        .await?)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_collections_with_indexes(
    db: DbState<'_>,
) -> crate::Result<Vec<collection_with_indexes::Data>> {
    Ok(db
        .collection()
        .find_many(vec![])
        .include(collection_with_indexes::include())
        .exec()
        .await?)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_collections(db: DbState<'_>) -> crate::Result<Vec<collection::Data>> {
    Ok(db.collection().find_many(vec![]).exec().await?)
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
    let collection = db.collection().create(data.name, vec![]).exec().await?;
    for doc_create_data in data.documents {
        let doc = documents::get_or_create_document(db.clone(), doc_create_data).await?;
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

#[tauri::command]
#[specta::specta]
pub(crate) async fn update_collection_name(
    db: DbState<'_>,
    collection_id: i32,
    collection_name: String,
) -> crate::Result<collection::Data> {
    Ok(db
        .collection()
        .update(
            collection::id::equals(collection_id),
            vec![collection::name::set(collection_name)],
        )
        .exec()
        .await?)
}
