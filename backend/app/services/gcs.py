import uuid
import os
import json
from fastapi import UploadFile
from google.cloud import storage

def get_gcs_client() -> storage.Client:
    credentials_json = os.getenv("GCS_CREDENTIALS_JSON")
    if credentials_json:
        try:
            # Strip outer quotes in case the env var was wrapped in quotes in Render
            cleaned_json = credentials_json.strip().strip("'\"")
            info = json.loads(cleaned_json)
            return storage.Client.from_service_account_info(info)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to parse GCS_CREDENTIALS_JSON: {e}")

    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if credentials_path and os.path.exists(credentials_path):
        try:
            return storage.Client.from_service_account_json(credentials_path)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to load credentials from GOOGLE_APPLICATION_CREDENTIALS: {e}")

    try:
        return storage.Client()
    except Exception as e:
        raise ValueError(
            "Google Cloud Storage credentials were not found or could not be loaded. "
            "Please ensure that the GCS_CREDENTIALS_JSON environment variable is configured in Render "
            "with the minified Service Account JSON key."
        ) from e

async def upload_avatar_to_gcs(file: UploadFile) -> str:
    bucket_name = os.getenv("GCS_BUCKET_NAME")
    if not bucket_name:
        raise ValueError("GCS_BUCKET_NAME environment variable is not configured.")
        
    client = get_gcs_client()
    bucket = client.bucket(bucket_name)
    
    # Generate unique blob name
    ext = os.path.splitext(file.filename)[1] if file.filename else ""
    blob_name = f"avatars/{uuid.uuid4()}{ext}"
    
    blob = bucket.blob(blob_name)
    
    # Read file content
    content = await file.read()
    
    # Reset file pointer
    await file.seek(0)
    
    # Upload binary content
    blob.upload_from_string(content, content_type=file.content_type)
    
    # Make public
    try:
        blob.make_public()
    except Exception:
        # Catch exception in case public access is managed at bucket-level (Uniform Access)
        pass
        
    return f"https://storage.googleapis.com/{bucket_name}/{blob_name}"
