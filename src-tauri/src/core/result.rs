use serde::ser::StdError;
use serde::{Serialize, Serializer};

/// Wrap anyhow::Error so that we can serialize it.
#[derive(Debug)]
pub(crate) struct Error(anyhow::Error);

pub(crate) type Result<T, E = Error> = anyhow::Result<T, E>;

/// Support to convert from any std errors to crate::result::Error
impl<E> From<E> for Error
where
    E: StdError + Send + Sync + 'static,
{
    #[cold]
    fn from(error: E) -> Self {
        Error(anyhow::Error::from(error))
    }
}

impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let err = serde_error::Error::new(&*self.0);
        serializer.serialize_newtype_struct("Error", &err)
    }
}
