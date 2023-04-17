use serde::Deserialize;
use specta::Type;

use crate::commands::db::splittings::GetOrCreateSplittingData;
use crate::commands::db::{splittings, DbState};
use crate::prisma::{document, document_chunk, splitting};

document_chunk::select!(document_chunk_only_md5hash { md_5_hash });

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_chunk_md5hashes_by_documents_and_splitting(
    db: DbState<'_>,
    document_ids: Vec<i32>,
    splitting: GetOrCreateSplittingData,
) -> crate::Result<Vec<document_chunk_only_md5hash::Data>> {
    let splitting_id = splittings::get_or_create_splitting_id(db.clone(), splitting).await?;

    Ok(db
        .document_chunk()
        .find_many(vec![
            document_chunk::document_id::in_vec(document_ids),
            document_chunk::splitting_id::equals(splitting_id),
        ])
        .select(document_chunk_only_md5hash::select())
        .exec()
        .await?)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_document_chunks(
    db: DbState<'_>,
    document_id: i32,
    splitting: GetOrCreateSplittingData,
) -> crate::Result<Vec<document_chunk::Data>> {
    let splitting_id = splittings::get_or_create_splitting_id(db.clone(), splitting).await?;

    Ok(db
        .document_chunk()
        .find_many(vec![
            document_chunk::document_id::equals(document_id),
            document_chunk::splitting_id::equals(splitting_id),
        ])
        .exec()
        .await?)
}

#[derive(Deserialize, Type)]
pub(crate) struct CreateChunkData {
    content: String,
    metadata: String,
}

#[derive(Deserialize, Type)]
pub(crate) struct CreateChunksByDocumentData {
    #[serde(rename = "documentId")]
    document_id: i32,
    splitting: GetOrCreateSplittingData,
    chunks: Vec<CreateChunkData>,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn create_chunks_by_document(
    db: DbState<'_>,
    data: CreateChunksByDocumentData,
) -> crate::Result<Vec<document_chunk::Data>> {
    let splitting_id = splittings::get_or_create_splitting_id(db.clone(), data.splitting).await?;

    Ok(db
        ._batch(data.chunks.into_iter().enumerate().map(|(no, chunk_data)| {
            let digest = md5::compute(chunk_data.content.as_str());
            db.document_chunk().create(
                document::id::equals(data.document_id),
                splitting::id::equals(splitting_id),
                no as i32,
                chunk_data.content,
                chunk_data.metadata,
                format!("{:x}", digest),
                vec![],
            )
        }))
        .await?)
}
