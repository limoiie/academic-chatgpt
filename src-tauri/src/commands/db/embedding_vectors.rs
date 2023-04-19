use serde::{Deserialize, Serialize};
use specta::Type;

use crate::commands::db::DbState;
use crate::prisma::{embedding_vectors_on_document_chunks, embeddings_config};

#[derive(Serialize, Type)]
pub(crate) struct EmbeddingVectorData {
    #[serde(rename = "md5Hash")]
    pub md_5_hash: String,
    #[serde(rename = "vector")]
    pub vector: Vec<f32>,
    #[serde(rename = "embeddingsConfigId")]
    pub embeddings_config_id: i32,
}

#[derive(Deserialize, Type)]
pub(crate) struct GetEmbeddingVectorByMD5Hash {
    #[serde(rename = "embeddingsConfigId")]
    embeddings_config_id: i32,
    #[serde(rename = "md5Hash")]
    md5_hash: String,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_embedding_vector_by_md5hash(
    db: DbState<'_>,
    data: GetEmbeddingVectorByMD5Hash,
) -> crate::Result<Option<EmbeddingVectorData>> {
    Ok(db
        .embedding_vectors_on_document_chunks()
        .find_unique(
            embedding_vectors_on_document_chunks::embeddings_config_id_md_5_hash(
                data.embeddings_config_id,
                data.md5_hash,
            ),
        )
        .exec()
        .await?
        .map(|data| EmbeddingVectorData {
            md_5_hash: data.md_5_hash,
            vector: data
                .vector
                .chunks(4)
                .map(|b| b.try_into().unwrap())
                .map(f32::from_be_bytes)
                .collect(),
            embeddings_config_id: data.embeddings_config_id,
        }))
}

#[derive(Deserialize, Type)]
pub(crate) struct UpsertEmbeddingVectorByMD5Hash {
    identity: GetEmbeddingVectorByMD5Hash,
    vector: Vec<f32>,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn upsert_embedding_vector_by_md5hash(
    db: DbState<'_>,
    data: UpsertEmbeddingVectorByMD5Hash,
) -> crate::Result<embedding_vectors_on_document_chunks::Data> {
    let vector = data
        .vector
        .into_iter()
        .flat_map(|tensor| tensor.to_be_bytes())
        .collect::<Vec<_>>();
    Ok(db
        .embedding_vectors_on_document_chunks()
        .upsert(
            embedding_vectors_on_document_chunks::embeddings_config_id_md_5_hash(
                data.identity.embeddings_config_id,
                data.identity.md5_hash.clone(),
            ),
            (
                data.identity.md5_hash,
                embeddings_config::id::equals(data.identity.embeddings_config_id),
                vector,
                vec![],
            ),
            vec![],
        )
        .exec()
        .await?)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn upsert_embedding_vector_by_md5hash_in_batch(
    db: DbState<'_>,
    data: Vec<UpsertEmbeddingVectorByMD5Hash>,
) -> crate::Result<i32> {
    Ok(db
        ._batch(data.into_iter().map(|data| {
            db.embedding_vectors_on_document_chunks().upsert(
                embedding_vectors_on_document_chunks::embeddings_config_id_md_5_hash(
                    data.identity.embeddings_config_id,
                    data.identity.md5_hash.clone(),
                ),
                (
                    data.identity.md5_hash,
                    embeddings_config::id::equals(data.identity.embeddings_config_id),
                    data.vector
                        .into_iter()
                        .flat_map(|tensor| tensor.to_be_bytes())
                        .collect(),
                    vec![],
                ),
                vec![],
            )
        }))
        .await?
        .len() as i32)
}
