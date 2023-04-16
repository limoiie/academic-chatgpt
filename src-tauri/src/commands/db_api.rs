use std::sync::Arc;

use serde::{Deserialize, Serialize};
use specta::{specta, Type};
use tauri::State;

use crate::core::fs::hash_file_in_md5;
use crate::prisma::*;

type DbState<'a> = State<'a, Arc<PrismaClient>>;

///
/// Document chunk operations
///

#[derive(Deserialize, Type)]
pub(crate) struct CreateGetOrCreateSplittingData {
    #[serde(rename = "chunkSize")]
    chunk_size: i32,
    #[serde(rename = "chunkOverlap")]
    chunk_overlap: i32,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_or_create_splitting(
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
pub(crate) enum GetOrCreateSplittingData {
    Id(i32),
    Config(CreateGetOrCreateSplittingData),
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_or_create_splitting_id(
    db: DbState<'_>,
    data: GetOrCreateSplittingData,
) -> crate::Result<i32> {
    match data {
        GetOrCreateSplittingData::Id(id) => Ok(id),
        GetOrCreateSplittingData::Config(data) => Ok(get_or_create_splitting(db, data).await?.id),
    }
}

document_chunk::select!(document_chunk_only_md5hash { md_5_hash });

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_chunk_md5hashes_by_documents_and_splitting(
    db: DbState<'_>,
    document_ids: Vec<i32>,
    splitting: GetOrCreateSplittingData,
) -> crate::Result<Vec<document_chunk_only_md5hash::Data>> {
    let splitting_id = get_or_create_splitting_id(db.clone(), splitting).await?;

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
    let splitting_id = get_or_create_splitting_id(db.clone(), splitting).await?;

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
    let splitting_id = get_or_create_splitting_id(db.clone(), data.splitting).await?;

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

///
/// Embeddings on Document Chunk operations
///

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
                .as_chunks::<4>()
                .0
                .iter()
                .map(|b| f32::from_be_bytes(*b))
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

#[tauri::command]
#[specta::specta]
pub(crate) async fn add_documents(
    db: DbState<'_>,
    documents: Vec<CreateDocumentData>,
) -> crate::Result<Vec<document::Data>> {
    let mut docs = vec![];
    for document in documents {
        let doc = get_or_create_document(db.clone(), document).await?;
        docs.push(doc);
    }
    Ok(docs)
}

///
/// Collections on Documents operations
///

#[tauri::command]
#[specta::specta]
pub(crate) async fn delete_collection_on_documents(
    db: DbState<'_>,
    collection_id: i32,
) -> crate::Result<i32> {
    Ok(db
        .collections_on_documents()
        .delete_many(vec![collections_on_documents::collection_id::equals(
            collection_id,
        )])
        .exec()
        .await? as i32)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn delete_documents_in_collection(
    db: DbState<'_>,
    collection_id: i32,
    document_ids: Vec<i32>,
) -> crate::Result<i32> {
    Ok(db
        .collections_on_documents()
        .delete_many(vec![
            collections_on_documents::collection_id::equals(collection_id),
            collections_on_documents::document_id::in_vec(document_ids),
        ])
        .exec()
        .await? as i32)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn add_documents_to_collection(
    db: DbState<'_>,
    collection_id: i32,
    document_ids: Vec<i32>,
) -> crate::Result<Vec<collections_on_documents::Data>> {
    Ok(db
        ._batch(
            document_ids
                .into_iter()
                .map(|document_id| {
                    db.collections_on_documents().upsert(
                        collections_on_documents::collection_id_document_id(
                            collection_id,
                            document_id,
                        ),
                        (
                            collection::id::equals(collection_id),
                            document::id::equals(document_id),
                            vec![],
                        ),
                        vec![
                            collections_on_documents::collection_id::set(collection_id),
                            collections_on_documents::document_id::set(document_id),
                        ],
                    )
                })
                .collect::<Vec<_>>(),
        )
        .await?)
}

///
/// Collections operations
///

#[tauri::command]
#[specta::specta]
pub(crate) async fn delete_collection_by_id(
    db: DbState<'_>,
    collection_id: i32,
) -> crate::Result<collection::Data> {
    delete_collection_on_documents(db.clone(), collection_id).await?;
    delete_collections_on_indexes_by_id(
        db.clone(),
        get_collections_on_indexes_by_collection_id(db.clone(), collection_id)
            .await?
            .into_iter()
            .map(|p| p.id)
            .collect(),
    )
    .await?;
    Ok(db
        .collection()
        .delete(collection::id::equals(collection_id))
        .exec()
        .await?)
}

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

collection::include!(collection_with_indexes { index_profiles });

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_collections_with_index_profiles(
    db: DbState<'_>,
) -> crate::Result<Vec<collection_with_indexes::Data>> {
    Ok(db
        .collection()
        .find_many(vec![])
        .include(collection_with_indexes::include())
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

#[tauri::command]
#[specta::specta]
pub(crate) async fn update_collection_name(
    db: DbState<'_>,
    collection_id: i32,
    collection_name: String,
) -> crate::Result<collection::Data> {
    Ok(db
        .collection()
        .update(
            collection::id::equals(collection_id),
            vec![collection::name::set(collection_name)],
        )
        .exec()
        .await?)
}

#[derive(Serialize, Type)]
pub(crate) struct VectorDbClientExData {
    id: i32,
    name: String,
    r#type: String,
    info: serde_json::Value,
}

impl VectorDbClientExData {
    pub(crate) fn from_data(data: vector_db_client::Data) -> crate::Result<Self> {
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
pub(crate) async fn get_vector_db_client_by_id(
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
pub(crate) async fn get_vector_db_clients(
    db: DbState<'_>,
) -> crate::Result<Vec<VectorDbClientExData>> {
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
pub(crate) struct CreateVectorDbClientData {
    name: String,
    r#type: String,
    info: serde_json::Value,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn create_vector_db_client(
    db: DbState<'_>,
    data: CreateVectorDbClientData,
) -> crate::Result<VectorDbConfigExData> {
    let info = serde_json::to_string(&data.info)?;
    db.vector_db_config()
        .create(data.name, data.r#type, info, vec![])
        .exec()
        .await
        .map(VectorDbConfigExData::from_data)?
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn upsert_vector_db_client(
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

///
/// Vector Db Config operations
///

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

///
/// Embeddings Client operations
///

#[derive(Serialize, Type)]
pub(crate) struct EmbeddingsClientExData {
    id: i32,
    name: String,
    r#type: String,
    info: serde_json::Value,
}

impl EmbeddingsClientExData {
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
) -> crate::Result<Vec<EmbeddingsClientExData>> {
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
pub(crate) async fn get_embeddings_client_by_id(
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
pub(crate) async fn upsert_embeddings_client(
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

///
/// Embeddings Config operations
///

#[derive(Serialize, Deserialize, Type)]
pub(crate) struct GetEmbeddingsConfigData {
    id: i32,
    name: String,
    #[serde(rename = "clientType")]
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
    #[serde(rename = "clientType")]
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

#[tauri::command]
#[specta::specta]
pub(crate) async fn upsert_embeddings_config(
    db: DbState<'_>,
    config_id: i32,
    data: CreateEmbeddingsConfigData,
) -> crate::Result<GetEmbeddingsConfigData> {
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
        .map(GetEmbeddingsConfigData::from_data)?
}

///
/// Index Profile operations
///

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

///
/// Collection on Index Profile operations
///

#[tauri::command]
#[specta::specta]
pub(crate) async fn delete_collections_on_indexes_by_id(
    db: DbState<'_>,
    collection_index_ids: Vec<String>,
) -> crate::Result<i32> {
    delete_sessions_by_index_ids(db.clone(), collection_index_ids.clone()).await?;
    Ok(db
        .collections_on_index_profiles()
        .delete_many(vec![collections_on_index_profiles::id::in_vec(
            collection_index_ids,
        )])
        .exec()
        .await? as i32)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_collections_on_indexes_by_collection_id(
    db: DbState<'_>,
    collection_id: i32,
) -> crate::Result<Vec<collections_on_index_profiles::Data>> {
    Ok(db
        .collections_on_index_profiles()
        .find_many(vec![collections_on_index_profiles::collection_id::equals(
            collection_id,
        )])
        .exec()
        .await?)
}

collections_on_index_profiles::include!(collection_on_index_profile_with_all {
    index: include {
        embeddings_client embeddings_config vector_db_client vector_db_config splitting
    }
});

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_collections_on_indexes_by_collection_id_with_all(
    db: DbState<'_>,
    collection_id: i32,
) -> crate::Result<Vec<collection_on_index_profile_with_all::Data>> {
    Ok(db
        .collections_on_index_profiles()
        .find_many(vec![collections_on_index_profiles::collection_id::equals(
            collection_id,
        )])
        .include(collection_on_index_profile_with_all::include())
        .exec()
        .await?)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_collection_on_index_by_id(
    db: DbState<'_>,
    collection_index_id: String,
) -> crate::Result<Option<collections_on_index_profiles::Data>> {
    Ok(db
        .collections_on_index_profiles()
        .find_unique(collections_on_index_profiles::id::equals(
            collection_index_id,
        ))
        .exec()
        .await?)
}

#[derive(Deserialize, Type)]
pub(crate) struct CreateCollectionIndexProfileData {
    name: String,
    #[serde(rename = "collectionId")]
    collection_id: i32,
    #[serde(rename = "indexId")]
    index_id: i32,
    #[serde(rename = "indexedDocuments")]
    indexed_documents: String,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn create_collection_on_index(
    db: DbState<'_>,
    data: CreateCollectionIndexProfileData,
) -> crate::Result<collections_on_index_profiles::Data> {
    Ok(db
        .collections_on_index_profiles()
        .create(
            data.name,
            collection::id::equals(data.collection_id),
            index_profile::id::equals(data.index_id),
            data.indexed_documents,
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
pub(crate) async fn delete_sessions_by_index_id(
    db: DbState<'_>,
    index_id: String,
) -> crate::Result<i32> {
    Ok(db
        .session()
        .delete_many(vec![session::index_profile_id::equals(index_id)])
        .exec()
        .await? as i32)
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn delete_sessions_by_index_ids(
    db: DbState<'_>,
    index_ids: Vec<String>,
) -> crate::Result<i32> {
    Ok(db
        .session()
        .delete_many(vec![session::index_profile_id::in_vec(index_ids)])
        .exec()
        .await? as i32)
}

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

#[tauri::command]
#[specta::specta]
pub(crate) async fn get_sessions_by_collection_on_index_id(
    db: DbState<'_>,
    index_id: String,
) -> crate::Result<Vec<session::Data>> {
    Ok(db
        .session()
        .find_many(vec![session::index_profile_id::equals(index_id)])
        .exec()
        .await?)
}

#[derive(Deserialize, Type)]
pub(crate) struct CreateSessionsData {
    name: String,
    #[serde(rename = "indexProfileId")]
    index_profile_id: String,
    history: String,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn create_session(
    db: DbState<'_>,
    data: CreateSessionsData,
) -> crate::Result<session::Data> {
    Ok(db
        .session()
        .create(
            data.name,
            collections_on_index_profiles::id::equals(data.index_profile_id),
            data.history,
            vec![],
        )
        .exec()
        .await?)
}

#[derive(Deserialize, Type)]
pub(crate) struct UpdateSessionsData {
    id: i32,
    name: Option<String>,
    history: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn update_session(
    db: DbState<'_>,
    data: UpdateSessionsData,
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
