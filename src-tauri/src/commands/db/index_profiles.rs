use serde::Deserialize;
use specta::Type;

use crate::commands::db::DbState;
use crate::prisma::{
    embeddings_client, embeddings_config, index_profile, splitting, vector_db_client,
    vector_db_config,
};

index_profile::include!(index_profile_with_all {
    embeddings_client embeddings_config vector_db_client vector_db_config splitting
});

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_index_profiles_with_all(
    db: DbState<'_>,
) -> crate::Result<Vec<index_profile_with_all::Data>> {
    Ok(db
        .index_profile()
        .find_many(vec![])
        .include(index_profile_with_all::include())
        .exec()
        .await?)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_index_profiles(db: DbState<'_>) -> crate::Result<Vec<index_profile::Data>> {
    Ok(db.index_profile().find_many(vec![]).exec().await?)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_index_profile_by_id(
    db: DbState<'_>,
    index_profile_id: i32,
) -> crate::Result<Option<index_profile::Data>> {
    Ok(db
        .index_profile()
        .find_unique(index_profile::id::equals(index_profile_id))
        .exec()
        .await?)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_index_profile_with_all_by_id(
    db: DbState<'_>,
    index_profile_id: i32,
) -> crate::Result<Option<index_profile_with_all::Data>> {
    Ok(db
        .index_profile()
        .find_unique(index_profile::id::equals(index_profile_id))
        .include(index_profile_with_all::include())
        .exec()
        .await?)
}

#[derive(Deserialize, Type)]
pub(crate) struct CreateIndexProfileData {
    name: String,
    #[serde(rename = "splittingId")]
    splitting_id: i32,
    #[serde(rename = "embeddingsClientId")]
    embeddings_client_id: i32,
    #[serde(rename = "embeddingsConfigId")]
    embeddings_config_id: i32,
    #[serde(rename = "vectorDbClientId")]
    vector_db_client_id: i32,
    #[serde(rename = "vectorDbConfigId")]
    vector_db_config_id: i32,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn create_index_profile(
    db: DbState<'_>,
    data: CreateIndexProfileData,
) -> crate::Result<index_profile::Data> {
    Ok(db
        .index_profile()
        .create(
            data.name,
            splitting::id::equals(data.splitting_id),
            embeddings_client::id::equals(data.embeddings_client_id),
            embeddings_config::id::equals(data.embeddings_config_id),
            vector_db_client::id::equals(data.vector_db_client_id),
            vector_db_config::id::equals(data.vector_db_config_id),
            vec![],
        )
        .exec()
        .await?)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn create_index_profile_with_all(
    db: DbState<'_>,
    data: CreateIndexProfileData,
) -> crate::Result<index_profile_with_all::Data> {
    Ok(db
        .index_profile()
        .create(
            data.name,
            splitting::id::equals(data.splitting_id),
            embeddings_client::id::equals(data.embeddings_client_id),
            embeddings_config::id::equals(data.embeddings_config_id),
            vector_db_client::id::equals(data.vector_db_client_id),
            vector_db_config::id::equals(data.vector_db_config_id),
            vec![],
        )
        .include(index_profile_with_all::include())
        .exec()
        .await?)
}
