use serde::Deserialize;
use specta::Type;

use crate::commands::db::DbState;
use crate::core::fs::{hash_file_in_md5, hash_in_md5};
use crate::prisma::{collections_on_documents, document};

#[tauri::command]
#[specta::specta]
pub async fn get_documents(db: DbState<'_>) -> crate::Result<Vec<document::Data>> {
    Ok(db.document().find_many(vec![]).exec().await?)
}

/// Get all documents of a collection.
#[tauri::command]
#[specta::specta]
pub async fn get_documents_by_collection_id(
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
        ._batch(
            doc_ids
                .into_iter()
                .map(|document_id| db.document().find_unique(document::id::equals(document_id))),
        )
        .await?
        .into_iter()
        .flatten()
        .collect::<Vec<_>>();
    Ok(data)
}

#[derive(Deserialize, Type)]
pub enum CreateDocumentData {
    Path { filename: String, filepath: String },
    File { filename: String, content: Vec<u8> },
}

/// Create a document and store it in `app_local_data_dir/upload` folder.
///
/// If the file already exists, it will not be copied again.  The file will be renamed to
/// `<md5_hash>.<extension>`.
// noinspection RsWrongGenericArgumentsNumber
#[tauri::command]
#[specta::specta]
pub async fn get_or_create_document(
    app: tauri::AppHandle,
    db: DbState<'_>,
    data: CreateDocumentData,
) -> crate::Result<document::Data> {
    let update_time = prisma_client_rust::chrono::prelude::Local::now().into();
    let uploaded_dir = prepare_upload_folder(app.config().as_ref()).await?;
    let (filename, md5_hash, target_path) = match data {
        CreateDocumentData::Path { filename, filepath } => {
            let md5_hash = hash_file_in_md5(&filepath).await?;
            let target_path = uploaded_dir.join(&md5_hash);
            if !target_path.exists() {
                tokio::fs::copy(&filepath, &target_path).await?;
            }
            (filename, md5_hash, target_path)
        }
        CreateDocumentData::File { filename, content } => {
            let md5_hash = hash_in_md5(&content).await?;
            let target_path = uploaded_dir.join(&md5_hash);
            if !target_path.exists() {
                tokio::fs::write(&target_path, content).await?;
            }
            (filename, md5_hash, target_path)
        }
    };
    Ok(db
        .document()
        .create(
            filename,
            target_path.to_str().unwrap().to_string(),
            md5_hash,
            update_time,
            vec![],
        )
        .exec()
        .await?)
}

// noinspection RsWrongGenericArgumentsNumber
#[tauri::command]
#[specta::specta]
pub async fn add_documents(
    app: tauri::AppHandle,
    db: DbState<'_>,
    documents: Vec<CreateDocumentData>,
) -> crate::Result<Vec<document::Data>> {
    let mut docs = vec![];
    for document in documents {
        let doc = get_or_create_document(app.clone(), db.clone(), document).await?;
        docs.push(doc);
    }
    Ok(docs)
}

async fn prepare_upload_folder(config: &tauri::Config) -> std::io::Result<std::path::PathBuf> {
    let app_data_dir = tauri::api::path::app_local_data_dir(config).unwrap();
    let uploaded_dir = app_data_dir.join("uploaded");

    tokio::fs::create_dir_all(&uploaded_dir).await?;
    Ok(uploaded_dir)
}
