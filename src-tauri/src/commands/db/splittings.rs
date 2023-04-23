use crate::commands::db::DbState;
use crate::prisma::splitting;
use serde::Deserialize;
use specta::Type;

///
/// Document chunk operations
///

#[derive(Deserialize, Type)]
pub struct CreateGetOrCreateSplittingData {
    #[serde(rename = "chunkSize")]
    chunk_size: i32,
    #[serde(rename = "chunkOverlap")]
    chunk_overlap: i32,
}

#[tauri::command]
#[specta::specta]
pub async fn get_or_create_splitting(
    db: DbState<'_>,
    data: CreateGetOrCreateSplittingData,
) -> crate::Result<splitting::Data> {
    let existing = db
        .splitting()
        .find_unique(splitting::chunk_overlap_chunk_size(
            data.chunk_overlap,
            data.chunk_size,
        ))
        .exec()
        .await?;
    if let Some(data) = existing {
        Ok(data)
    } else {
        Ok(db
            .splitting()
            .create(data.chunk_size, data.chunk_overlap, vec![])
            .exec()
            .await?)
    }
}

#[derive(Deserialize, Type)]
pub enum GetOrCreateSplittingData {
    Id(i32),
    Config(CreateGetOrCreateSplittingData),
}

#[tauri::command]
#[specta::specta]
pub async fn get_or_create_splitting_id(
    db: DbState<'_>,
    data: GetOrCreateSplittingData,
) -> crate::Result<i32> {
    match data {
        GetOrCreateSplittingData::Id(id) => Ok(id),
        GetOrCreateSplittingData::Config(data) => Ok(get_or_create_splitting(db, data).await?.id),
    }
}
