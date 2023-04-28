use serde::Deserialize;
use specta::Type;

use crate::commands::db::DbState;
use crate::prisma::{collection_index, session};

#[tauri::command]
#[specta::specta]
pub async fn delete_sessions_by_index_id(db: DbState<'_>, index_id: String) -> crate::Result<i32> {
    Ok(db
        .session()
        .delete_many(vec![session::index_id::equals(index_id)])
        .exec()
        .await? as i32)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_sessions_by_index_ids(
    db: DbState<'_>,
    index_ids: Vec<String>,
) -> crate::Result<i32> {
    Ok(db
        .session()
        .delete_many(vec![session::index_id::in_vec(index_ids)])
        .exec()
        .await? as i32)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_session_by_id(
    db: DbState<'_>,
    session_id: i32,
) -> crate::Result<session::Data> {
    Ok(db
        .session()
        .delete(session::id::equals(session_id))
        .exec()
        .await?)
}

#[tauri::command]
#[specta::specta]
pub async fn get_sessions(db: DbState<'_>) -> crate::Result<Vec<session::Data>> {
    Ok(db.session().find_many(vec![]).exec().await?)
}

#[tauri::command]
#[specta::specta]
pub async fn get_sessions_by_index_id(
    db: DbState<'_>,
    index_id: String,
) -> crate::Result<Vec<session::Data>> {
    Ok(db
        .session()
        .find_many(vec![session::index_id::equals(index_id)])
        .exec()
        .await?)
}

#[derive(Deserialize, Type)]
pub struct CreateSessionData {
    name: String,
    #[serde(rename = "indexId")]
    index_id: String,
    history: String,
}

#[tauri::command]
#[specta::specta]
pub async fn create_session(
    db: DbState<'_>,
    data: CreateSessionData,
) -> crate::Result<session::Data> {
    Ok(db
        .session()
        .create(
            data.name,
            collection_index::id::equals(data.index_id),
            data.history,
            vec![],
        )
        .exec()
        .await?)
}

#[derive(Deserialize, Type)]
pub struct UpdateSessionData {
    id: i32,
    name: Option<String>,
    history: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub async fn update_session(
    db: DbState<'_>,
    data: UpdateSessionData,
) -> crate::Result<session::Data> {
    Ok(db
        .session()
        .update(
            session::id::equals(data.id),
            vec![
                data.history.map(session::history::set),
                data.name.map(session::name::set),
            ]
            .into_iter()
            .flatten()
            .collect(),
        )
        .exec()
        .await?)
}
