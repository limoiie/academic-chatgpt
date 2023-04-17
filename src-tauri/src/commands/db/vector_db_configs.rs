use serde::{Deserialize, Serialize};
use specta::Type;

use crate::commands::db::DbState;
use crate::prisma::vector_db_config;

#[derive(Serialize, Type)]
pub(crate) struct VectorDbConfigExData {
    id: i32,
    name: String,

    #[serde(rename = "clientType")]
    client_type: String,
    meta: serde_json::Value,
}

impl VectorDbConfigExData {
    pub(crate) fn from_data(data: vector_db_config::Data) -> crate::Result<Self> {
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
pub(crate) async fn get_vector_db_config_by_id(
    db: DbState<'_>,
    vector_db_config_id: i32,
) -> crate::Result<Option<VectorDbConfigExData>> {
    db.vector_db_config()
        .find_unique(vector_db_config::id::equals(vector_db_config_id))
        .exec()
        .await
        .map(|opt| opt.map(VectorDbConfigExData::from_data).transpose())?
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_vector_db_configs(
    db: DbState<'_>,
) -> crate::Result<Vec<VectorDbConfigExData>> {
    db.vector_db_config()
        .find_many(vec![])
        .exec()
        .await
        .map(|vec| {
            vec.into_iter()
                .map(VectorDbConfigExData::from_data)
                .collect::<Result<Vec<_>, _>>()
        })?
}

#[derive(Deserialize, Type)]
pub(crate) struct CreateVectorDbData {
    name: String,
    #[serde(rename = "clientType")]
    client_type: String,
    meta: serde_json::Value,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn create_vector_db_config(
    db: DbState<'_>,
    data: CreateVectorDbData,
) -> crate::Result<VectorDbConfigExData> {
    let meta = serde_json::to_string(&data.meta)?;
    db.vector_db_config()
        .create(data.name, data.client_type, meta, vec![])
        .exec()
        .await
        .map(VectorDbConfigExData::from_data)?
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn upsert_vector_db_config(
    db: DbState<'_>,
    config_id: i32,
    data: CreateVectorDbData,
) -> crate::Result<VectorDbConfigExData> {
    let meta = serde_json::to_string(&data.meta)?;
    db.vector_db_config()
        .upsert(
            vector_db_config::id::equals(config_id),
            (
                data.name.clone(),
                data.client_type.clone(),
                meta.clone(),
                vec![],
            ),
            vec![
                vector_db_config::name::set(data.name),
                vector_db_config::client_type::set(data.client_type),
                vector_db_config::meta::set(meta),
            ],
        )
        .exec()
        .await
        .map(VectorDbConfigExData::from_data)?
}
