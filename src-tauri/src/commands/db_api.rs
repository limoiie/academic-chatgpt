use std::sync::Arc;

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use crate::core::fs::hash_file_in_md5;
use crate::prisma::*;

type DbState<'a> = State<'a, Arc<PrismaClient>>;

///
/// Document chunk operations
///

#[derive(Deserialize, Type)]
pub(crate) struct CreateSplittingData {
    chunk_size: i32,
    chunk_overlap: i32,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_or_create_splitting(
    db: DbState<'_>,
    data: CreateSplittingData,
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
pub(crate) enum SplittingData {
    Id(i32),
    Config(CreateSplittingData),
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_or_create_splitting_id(
    db: DbState<'_>,
    data: SplittingData,
) -> crate::Result<i32> {
    match data {
        SplittingData::Id(id) => Ok(id),
        SplittingData::Config(data) => Ok(get_or_create_splitting(db, data).await?.id),
    }
}

#[derive(Deserialize, Type)]
pub(crate) struct GetDocumentChunkData {
    document_id: i32,
    splitting: SplittingData,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_document_chunks(
    db: DbState<'_>,
    data: GetDocumentChunkData,
) -> crate::Result<Vec<document_chunk::Data>> {
    let splitting_id = get_or_create_splitting_id(db.clone(), data.splitting).await?;

    Ok(db
        .document_chunk()
        .find_many(vec![
            document_chunk::document_id::equals(data.document_id),
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
    data: GetDocumentChunkData,
    chunks: Vec<CreateChunkData>,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn create_chunks_by_document(
    db: DbState<'_>,
    data: CreateChunksByDocumentData,
) -> crate::Result<Vec<document_chunk::Data>> {
    let splitting_id = get_or_create_splitting_id(db.clone(), data.data.splitting).await?;

    Ok(db
        ._batch(data.chunks.into_iter().enumerate().map(|(no, chunk_data)| {
            db.document_chunk().create(
                document::id::equals(data.data.document_id),
                splitting::id::equals(splitting_id),
                no as i32,
                chunk_data.content,
                chunk_data.metadata,
                vec![],
            )
        }))
        .await?)
}

///
/// Embeddings on Document Chunk operations
///
#[derive(Deserialize, Type)]
pub(crate) struct GetEmbeddingsOnDocumentChunkData {
    document_id: i32,
    splitting_id: i32,
    document_chunk_no: i32,
    embeddings_config_id: i32,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_embeddings_on_document_chunk(
    db: DbState<'_>,
    data: GetEmbeddingsOnDocumentChunkData,
) -> crate::Result<Option<embeddings_on_document_chunks::Data>> {
    Ok(db.embeddings_on_document_chunks()
        .find_unique(
            embeddings_on_document_chunks::document_id_splitting_id_document_chunk_no_embeddings_config_id(
                data.document_id,
                data.splitting_id,
                data.document_chunk_no,
                data.embeddings_config_id,
            )
        )
        .exec()
        .await
        ?)
}

#[derive(Deserialize, Type)]
pub(crate) struct UpsertEmbeddingsOnDocumentChunkData {
    identity: GetEmbeddingsOnDocumentChunkData,
    vector: Vec<u8>,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn upsert_embeddings_on_document_chunk(
    db: DbState<'_>,
    data: UpsertEmbeddingsOnDocumentChunkData,
) -> crate::Result<embeddings_on_document_chunks::Data> {
    Ok(db.embeddings_on_document_chunks()
        .upsert(
            embeddings_on_document_chunks::document_id_splitting_id_document_chunk_no_embeddings_config_id(
                data.identity.document_id,
                data.identity.splitting_id,
                data.identity.document_chunk_no,
                data.identity.embeddings_config_id,
            ),
            (
                document_chunk::document_id_splitting_id_no(
                    data.identity.document_id,
                    data.identity.splitting_id,
                    data.identity.document_chunk_no,
                ),
                embeddings_config::id::equals(data.identity.embeddings_config_id),
                data.vector,
                vec![],
            ),
            vec![],
        )
        .exec()
        .await?)
}

///
/// Documents operations
///

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_documents(db: DbState<'_>) -> crate::Result<Vec<document::Data>> {
    Ok(db.document().find_many(vec![]).exec().await?)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_documents_by_collection_id(
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
        ._batch(doc_ids.into_iter().map(|document_id| {
            db.document()
                .find_first(vec![document::id::equals(document_id)])
        }))
        .await?
        .into_iter()
        .flatten()
        .collect::<Vec<_>>();
    Ok(data)
}

#[derive(Deserialize, Type)]
pub(crate) struct CreateDocumentData {
    filename: String,
    filepath: String,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn create_document(
    db: DbState<'_>,
    data: CreateDocumentData,
) -> crate::Result<document::Data> {
    let md5_hash = hash_file_in_md5(&data.filepath).await?;
    let update_time = prisma_client_rust::chrono::prelude::Local::now().into();
    Ok(db
        .document()
        .create(data.filename, data.filepath, md5_hash, update_time, vec![])
        .exec()
        .await?)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_or_create_document(
    db: DbState<'_>,
    data: CreateDocumentData,
) -> crate::Result<document::Data> {
    let md5_hash = hash_file_in_md5(&data.filepath).await?;
    let found = db
        .document()
        .find_first(vec![document::md_5_hash::equals(md5_hash.clone())])
        .exec()
        .await?;

    if let Some(found) = found {
        Ok(found)
    } else {
        let update_time = prisma_client_rust::chrono::prelude::Local::now().into();
        Ok(db
            .document()
            .create(data.filename, data.filepath, md5_hash, update_time, vec![])
            .exec()
            .await?)
    }
}

///
/// Collections operations
///

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_collection_by_id(
    db: DbState<'_>,
    collection_id: i32,
) -> crate::Result<Option<collection::Data>> {
    Ok(db
        .collection()
        .find_first(vec![collection::id::equals(collection_id)])
        .exec()
        .await?)
}

collection::include!(collection_with_profiles { profiles });

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_collections_with_index_profiles(
    db: DbState<'_>,
) -> crate::Result<Vec<collection_with_profiles::Data>> {
    Ok(db
        .collection()
        .find_many(vec![])
        .include(collection_with_profiles::include())
        .exec()
        .await?)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_collections(db: DbState<'_>) -> crate::Result<Vec<collection::Data>> {
    Ok(db.collection().find_many(vec![]).exec().await?)
}

#[derive(Deserialize, Type)]
pub(crate) struct CreateCollectionData {
    name: String,
    documents: Vec<CreateDocumentData>,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn create_collection(
    db: DbState<'_>,
    data: CreateCollectionData,
) -> crate::Result<collection::Data> {
    let collection = db.collection().create(data.name, vec![]).exec().await?;

    for doc_create_data in data.documents {
        let doc = get_or_create_document(db.clone(), doc_create_data).await?;
        db.collections_on_documents()
            .create(
                collection::id::equals(collection.id),
                document::id::equals(doc.id),
                vec![],
            )
            .exec()
            .await?;
    }
    Ok(collection)
}

///
/// Vector Db Config operations
///

#[derive(Serialize, Type)]
pub(crate) struct GetVectorDbConfigData {
    id: i32,
    name: String,
    client: String,
    client_info: serde_json::Value,
    meta: serde_json::Value,
}

impl GetVectorDbConfigData {
    pub(crate) fn from_data(data: vector_db_config::Data) -> crate::Result<Self> {
        Ok(Self {
            id: data.id,
            name: data.name,
            client: data.client,
            client_info: serde_json::from_str(data.client_info.as_str())?,
            meta: serde_json::from_str(data.meta.as_str())?,
        })
    }
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_vector_db_config_by_id(
    db: DbState<'_>,
    vector_db_config_id: i32,
) -> crate::Result<Option<GetVectorDbConfigData>> {
    db.vector_db_config()
        .find_unique(vector_db_config::id::equals(vector_db_config_id))
        .exec()
        .await
        .map(|opt| opt.map(GetVectorDbConfigData::from_data).transpose())?
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_vector_db_configs(
    db: DbState<'_>,
) -> crate::Result<Vec<GetVectorDbConfigData>> {
    db.vector_db_config()
        .find_many(vec![])
        .exec()
        .await
        .map(|vec| {
            vec.into_iter()
                .map(GetVectorDbConfigData::from_data)
                .collect::<Result<Vec<_>, _>>()
        })?
}

#[derive(Deserialize, Type)]
pub(crate) struct CreateVectorDbData {
    name: String,
    client: String,
    client_info: serde_json::Value,
    meta: serde_json::Value,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn create_vector_db_config(
    db: DbState<'_>,
    data: CreateVectorDbData,
) -> crate::Result<GetVectorDbConfigData> {
    let client_info = serde_json::to_string(&data.client_info)?;
    let meta = serde_json::to_string(&data.meta)?;
    db.vector_db_config()
        .create(data.name, data.client, client_info, meta, vec![])
        .exec()
        .await
        .map(GetVectorDbConfigData::from_data)?
}

///
/// Embeddings Client operations
///

#[derive(Serialize, Type)]
pub(crate) struct GetEmbeddingsClientData {
    id: i32,
    name: String,
    r#type: String,
    info: serde_json::Value,
}

impl GetEmbeddingsClientData {
    pub(crate) fn from_data(data: embeddings_client::Data) -> crate::Result<Self> {
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
pub(crate) async fn get_embeddings_clients(
    db: DbState<'_>,
) -> crate::Result<Vec<GetEmbeddingsClientData>> {
    db.embeddings_client()
        .find_many(vec![])
        .exec()
        .await
        .map(|data| {
            data.into_iter()
                .map(GetEmbeddingsClientData::from_data)
                .collect::<Result<Vec<_>, _>>()
        })?
}

#[derive(Deserialize, Type)]
pub(crate) struct CreateEmbeddingsClientData {
    name: String,
    r#type: String,
    info: serde_json::Value,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn create_embeddings_client(
    db: DbState<'_>,
    data: CreateEmbeddingsClientData,
) -> crate::Result<GetEmbeddingsClientData> {
    let info = serde_json::to_string(&data.info)?;
    db.embeddings_client()
        .create(data.name, data.r#type, info, vec![])
        .exec()
        .await
        .map(GetEmbeddingsClientData::from_data)?
}

///
/// Embeddings Config operations
///

#[derive(Serialize, Deserialize, Type)]
pub(crate) struct GetEmbeddingsConfigData {
    id: i32,
    name: String,
    client_type: String,
    meta: serde_json::Value,
}

impl GetEmbeddingsConfigData {
    pub(crate) fn from_data(data: embeddings_config::Data) -> crate::Result<Self> {
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
pub(crate) async fn get_embeddings_configs_by_client_type(
    db: DbState<'_>,
    client_type: String,
) -> crate::Result<Vec<GetEmbeddingsConfigData>> {
    db.embeddings_config()
        .find_many(vec![embeddings_config::client_type::equals(client_type)])
        .exec()
        .await
        .map(|data| {
            data.into_iter()
                .map(GetEmbeddingsConfigData::from_data)
                .collect::<Result<Vec<_>, _>>()
        })?
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_embeddings_config_by_id(
    db: DbState<'_>,
    embeddings_config_id: i32,
) -> crate::Result<Option<GetEmbeddingsConfigData>> {
    db.embeddings_config()
        .find_unique(embeddings_config::id::equals(embeddings_config_id))
        .exec()
        .await
        .map(|opt| opt.map(GetEmbeddingsConfigData::from_data).transpose())?
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_embeddings_configs(
    db: DbState<'_>,
) -> crate::Result<Vec<GetEmbeddingsConfigData>> {
    db.embeddings_config()
        .find_many(vec![])
        .exec()
        .await
        .map(|vec| {
            vec.into_iter()
                .map(GetEmbeddingsConfigData::from_data)
                .collect::<Result<Vec<_>, _>>()
        })?
}

#[derive(Deserialize, Type)]
pub(crate) struct CreateEmbeddingsConfigData {
    name: String,
    client_type: String,
    meta: serde_json::Value,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn create_embeddings_config(
    db: DbState<'_>,
    data: CreateEmbeddingsConfigData,
) -> crate::Result<GetEmbeddingsConfigData> {
    let meta = serde_json::to_string(&data.meta)?;
    db.embeddings_config()
        .create(data.name, data.client_type, meta, vec![])
        .exec()
        .await
        .map(GetEmbeddingsConfigData::from_data)?
}

///
/// Collection Index Profile operations
///

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_index_profiles_by_collection_id(
    db: DbState<'_>,
    collection_id: i32,
) -> crate::Result<Vec<collection_index_profile::Data>> {
    Ok(db
        .collection_index_profile()
        .find_many(vec![collection_index_profile::collection_id::equals(
            collection_id,
        )])
        .exec()
        .await?)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_index_profile_by_id(
    db: DbState<'_>,
    index_profile_id: i32,
) -> crate::Result<Option<collection_index_profile::Data>> {
    Ok(db
        .collection_index_profile()
        .find_unique(collection_index_profile::id::equals(index_profile_id))
        .exec()
        .await?)
}

#[derive(Deserialize, Type)]
pub(crate) struct CreateCollectionIndexProfileData {
    name: String,
    collection_id: i32,
    splitting_id: i32,
    embeddings_config_id: i32,
    vector_db_config_id: i32,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn create_collection_index_profile(
    db: DbState<'_>,
    data: CreateCollectionIndexProfileData,
) -> crate::Result<collection_index_profile::Data> {
    Ok(db
        .collection_index_profile()
        .create(
            data.name,
            collection::id::equals(data.collection_id),
            splitting::id::equals(data.splitting_id),
            embeddings_config::id::equals(data.embeddings_config_id),
            vector_db_config::id::equals(data.vector_db_config_id),
            vec![],
        )
        .exec()
        .await?)
}

///
/// Sessions operations
///

#[tauri::command]
#[specta::specta]
pub(crate) async fn delete_session_by_id(
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
pub(crate) async fn get_sessions(db: DbState<'_>) -> crate::Result<Vec<session::Data>> {
    Ok(db.session().find_many(vec![]).exec().await?)
}

#[derive(Deserialize, Type)]
pub(crate) struct CreateSessionsData {
    name: String,
    collection_profile_id: i32,
    history: serde_json::Value,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn create_session(
    db: DbState<'_>,
    data: CreateSessionsData,
) -> crate::Result<session::Data> {
    let history = serde_json::to_string(&data.history)?;
    Ok(db
        .session()
        .create(
            data.name,
            collection_index_profile::id::equals(data.collection_profile_id),
            history,
            vec![],
        )
        .exec()
        .await?)
}
