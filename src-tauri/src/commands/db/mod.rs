use std::sync::Arc;

use tauri::State;

use crate::prisma::PrismaClient;

pub(crate) mod collection_indexes;
pub(crate) mod collections;
pub(crate) mod collections_on_documents;
pub(crate) mod document_chunks;
pub(crate) mod documents;
pub(crate) mod embedding_vectors;
pub(crate) mod embeddings_clients;
pub(crate) mod embeddings_configs;
pub(crate) mod index_profiles;
pub(crate) mod sessions;
pub(crate) mod splittings;
pub(crate) mod vector_db_clients;
pub(crate) mod vector_db_configs;

pub(crate) type DbState<'a> = State<'a, Arc<PrismaClient>>;
