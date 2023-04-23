use serde::{Deserialize, Serialize};
use specta::Type;

use crate::commands::db::DbState;
use crate::prisma::embeddings_client;

#[derive(Serialize, Type)]
pub struct EmbeddingsClientExData {
    id: i32,
    name: String,
    r#type: String,
    info: serde_json::Value,
}

impl EmbeddingsClientExData {
    pub fn from_data(data: embeddings_client::Data) -> crate::Result<Self> {
        Ok(Self {
            id: data.id,
            name: data.name,
            r#type: data.r#type,
            info: serde_json::from_str(data.info.as_str())?,
        })
    }
}

#[tauri::command]
#[specta::specta]
pub async fn get_embeddings_clients(db: DbState<'_>) -> crate::Result<Vec<EmbeddingsClientExData>> {
    db.embeddings_client()
        .find_many(vec![])
        .exec()
        .await
        .map(|data| {
            data.into_iter()
                .map(EmbeddingsClientExData::from_data)
                .collect::<Result<Vec<_>, _>>()
        })?
}

#[tauri::command]
#[specta::specta]
pub async fn get_embeddings_client_by_id(
    db: DbState<'_>,
    client_id: i32,
) -> crate::Result<Option<EmbeddingsClientExData>> {
    db.embeddings_client()
        .find_unique(embeddings_client::id::equals(client_id))
        .exec()
        .await?
        .map(EmbeddingsClientExData::from_data)
        .transpose()
}

#[derive(Deserialize, Type)]
pub struct CreateEmbeddingsClientData {
    name: String,
    r#type: String,
    info: serde_json::Value,
}

#[tauri::command]
#[specta::specta]
pub async fn create_embeddings_client(
    db: DbState<'_>,
    data: CreateEmbeddingsClientData,
) -> crate::Result<EmbeddingsClientExData> {
    let info = serde_json::to_string(&data.info)?;
    db.embeddings_client()
        .create(data.name, data.r#type, info, vec![])
        .exec()
        .await
        .map(EmbeddingsClientExData::from_data)?
}

#[tauri::command]
#[specta::specta]
pub async fn upsert_embeddings_client(
    db: DbState<'_>,
    client_id: i32,
    data: CreateEmbeddingsClientData,
) -> crate::Result<EmbeddingsClientExData> {
    let info = serde_json::to_string(&data.info)?;
    db.embeddings_client()
        .upsert(
            embeddings_client::id::equals(client_id),
            (data.name.clone(), data.r#type.clone(), info.clone(), vec![]),
            vec![
                embeddings_client::name::set(data.name),
                embeddings_client::r#type::set(data.r#type),
                embeddings_client::info::set(info),
            ],
        )
        .exec()
        .await
        .map(EmbeddingsClientExData::from_data)?
}
