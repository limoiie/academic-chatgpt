use serde::Deserialize;
use specta::Type;

use crate::commands::db::{documents, DbState};
use crate::prisma::{collection, document};

collection::include!(collection_with_indexes { indexes });

#[tauri::command]
#[specta::specta]
pub async fn delete_collection_by_id(
    db: DbState<'_>,
    collection_id: i32,
) -> crate::Result<collection::Data> {
    Ok(db
        .collection()
        .delete(collection::id::equals(collection_id))
        .exec()
        .await?)
}

#[tauri::command]
#[specta::specta]
pub async fn get_collection_by_id(
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
pub async fn get_collections_with_indexes(
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
pub async fn get_collections(db: DbState<'_>) -> crate::Result<Vec<collection::Data>> {
    Ok(db.collection().find_many(vec![]).exec().await?)
}

#[derive(Deserialize, Type)]
pub struct CreateCollectionData {
    name: String,
    documents: Vec<documents::CreateDocumentData>,
}

// noinspection RsWrongGenericArgumentsNumber
#[tauri::command]
#[specta::specta]
pub async fn create_collection(
    app: tauri::AppHandle,
    db: DbState<'_>,
    data: CreateCollectionData,
) -> crate::Result<collection::Data> {
    let collection = db.collection().create(data.name, vec![]).exec().await?;
    for doc_create_data in data.documents {
        let doc =
            documents::get_or_create_document(app.clone(), db.clone(), doc_create_data).await?;
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
pub async fn update_collection_name(
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
