use serde::{Deserialize, Serialize};
use specta::Type;

use crate::commands::db::DbState;
use crate::prisma::embeddings_config;

#[derive(Serialize, Deserialize, Type)]
pub struct EmbeddingsConfigExData {
    id: i32,
    name: String,
    #[serde(rename = "clientType")]
    client_type: String,
    meta: serde_json::Value,
}

impl EmbeddingsConfigExData {
    pub fn from_data(data: embeddings_config::Data) -> crate::Result<Self> {
        Ok(Self {
            id: data.id,
            name: data.name,
            client_type: data.client_type,
            meta: serde_json::from_str(data.meta.as_str())?,
        })
    }
}

#[tauri::command]
#[specta::specta]
pub async fn get_embeddings_configs_by_client_type(
    db: DbState<'_>,
    client_type: String,
) -> crate::Result<Vec<EmbeddingsConfigExData>> {
    db.embeddings_config()
        .find_many(vec![embeddings_config::client_type::equals(client_type)])
        .exec()
        .await
        .map(|data| {
            data.into_iter()
                .map(EmbeddingsConfigExData::from_data)
                .collect::<Result<Vec<_>, _>>()
        })?
}

#[tauri::command]
#[specta::specta]
pub async fn get_embeddings_config_by_id(
    db: DbState<'_>,
    embeddings_config_id: i32,
) -> crate::Result<Option<EmbeddingsConfigExData>> {
    db.embeddings_config()
        .find_unique(embeddings_config::id::equals(embeddings_config_id))
        .exec()
        .await
        .map(|opt| opt.map(EmbeddingsConfigExData::from_data).transpose())?
}

#[tauri::command]
#[specta::specta]
pub async fn get_embeddings_configs(db: DbState<'_>) -> crate::Result<Vec<EmbeddingsConfigExData>> {
    db.embeddings_config()
        .find_many(vec![])
        .exec()
        .await
        .map(|vec| {
            vec.into_iter()
                .map(EmbeddingsConfigExData::from_data)
                .collect::<Result<Vec<_>, _>>()
        })?
}

#[derive(Deserialize, Type)]
pub struct CreateEmbeddingsConfigData {
    name: String,
    #[serde(rename = "clientType")]
    client_type: String,
    meta: serde_json::Value,
}

#[tauri::command]
#[specta::specta]
pub async fn create_embeddings_config(
    db: DbState<'_>,
    data: CreateEmbeddingsConfigData,
) -> crate::Result<EmbeddingsConfigExData> {
    let meta = serde_json::to_string(&data.meta)?;
    db.embeddings_config()
        .create(data.name, data.client_type, meta, vec![])
        .exec()
        .await
        .map(EmbeddingsConfigExData::from_data)?
}

#[tauri::command]
#[specta::specta]
pub async fn upsert_embeddings_config(
    db: DbState<'_>,
    config_id: i32,
    data: CreateEmbeddingsConfigData,
) -> crate::Result<EmbeddingsConfigExData> {
    let meta = serde_json::to_string(&data.meta)?;
    db.embeddings_config()
        .upsert(
            embeddings_config::id::equals(config_id),
            (
                data.name.clone(),
                data.client_type.clone(),
                meta.clone(),
                vec![],
            ),
            vec![
                embeddings_config::name::set(data.name),
                embeddings_config::client_type::set(data.client_type),
                embeddings_config::meta::set(meta),
            ],
        )
        .exec()
        .await
        .map(EmbeddingsConfigExData::from_data)?
}
