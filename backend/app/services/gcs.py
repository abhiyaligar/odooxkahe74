import uuid
import os
import json
from fastapi import UploadFile
from google.cloud import storage

def get_gcs_client() -> storage.Client:
    credentials_json = os.getenv("GCS_CREDENTIALS_JSON")
    if credentials_json:
        try:
            info = json.loads(credentials_json)
            return storage.Client.from_service_account_info(info)
        except Exception:
            pass
    return storage.Client()

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
