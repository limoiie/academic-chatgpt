use serde::{Deserialize, Serialize};
use specta::Type;

use crate::commands::db::DbState;
use crate::prisma::vector_db_client;

#[derive(Serialize, Type)]
pub struct VectorDbClientExData {
    id: i32,
    name: String,
    r#type: String,
    info: serde_json::Value,
}

impl VectorDbClientExData {
    pub fn from_data(data: vector_db_client::Data) -> crate::Result<Self> {
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
pub async fn get_vector_db_client_by_id(
    db: DbState<'_>,
    client_id: i32,
) -> crate::Result<Option<VectorDbClientExData>> {
    db.vector_db_client()
        .find_unique(vector_db_client::id::equals(client_id))
        .exec()
        .await
        .map(|opt| opt.map(VectorDbClientExData::from_data).transpose())?
}

#[tauri::command]
#[specta::specta]
pub async fn get_vector_db_clients(db: DbState<'_>) -> crate::Result<Vec<VectorDbClientExData>> {
    db.vector_db_client()
        .find_many(vec![])
        .exec()
        .await
        .map(|vec| {
            vec.into_iter()
                .map(VectorDbClientExData::from_data)
                .collect::<Result<Vec<_>, _>>()
        })?
}

#[derive(Deserialize, Type)]
pub struct CreateVectorDbClientData {
    name: String,
    r#type: String,
    info: serde_json::Value,
}

#[tauri::command]
#[specta::specta]
pub async fn create_vector_db_client(
    db: DbState<'_>,
    data: CreateVectorDbClientData,
) -> crate::Result<VectorDbClientExData> {
    let info = serde_json::to_string(&data.info)?;
    db.vector_db_client()
        .create(data.name, data.r#type, info, vec![])
        .exec()
        .await
        .map(VectorDbClientExData::from_data)?
}

#[tauri::command]
#[specta::specta]
pub async fn upsert_vector_db_client(
    db: DbState<'_>,
    client_id: i32,
    data: CreateVectorDbClientData,
) -> crate::Result<VectorDbClientExData> {
    let info = serde_json::to_string(&data.info)?;
    db.vector_db_client()
        .upsert(
            vector_db_client::id::equals(client_id),
            (data.name.clone(), data.r#type.clone(), info.clone(), vec![]),
            vec![
                vector_db_client::name::set(data.name),
                vector_db_client::r#type::set(data.r#type),
                vector_db_client::info::set(info),
            ],
        )
        .exec()
        .await
        .map(VectorDbClientExData::from_data)?
}
