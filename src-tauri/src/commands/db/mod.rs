use crate::prisma::PrismaClient;

pub mod collection_indexes;
pub mod collections;
pub mod collections_on_documents;
pub mod document_chunks;
pub mod documents;
pub mod embedding_vectors;
pub mod embeddings_clients;
pub mod embeddings_configs;
pub mod index_profiles;
pub mod sessions;
pub mod splittings;
pub mod vector_db_clients;
pub mod vector_db_configs;

pub(crate) type DbState<'a> = tauri::State<'a, std::sync::Arc<PrismaClient>>;
