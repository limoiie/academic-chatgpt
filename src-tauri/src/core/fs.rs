use tokio::io::AsyncReadExt;

pub(crate) async fn hash_file_in_md5<P: AsRef<std::path::Path>>(
    file_path: P,
) -> std::io::Result<String> {
    let mut context = md5::Context::new();
    let mut file = tokio::fs::File::open(file_path).await?;
    let mut buffer = vec![0u8; 4 * 1024 * 1024];
    loop {
        let read = file.read(&mut buffer).await?;
        if read > 0 {
            context.consume(&buffer[..read]);
        } else {
            break;
        }
    }
    let digest = context.compute();
    Ok(format!("{:x}", digest))
}
