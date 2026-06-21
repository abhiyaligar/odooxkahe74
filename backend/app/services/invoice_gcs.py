"""Upload invoice PDFs to GCS and return a signed/public URL."""
import os
import uuid
from datetime import timedelta
from app.services.gcs import get_gcs_client


async def upload_invoice_to_gcs(pdf_bytes: bytes, invoice_number: str) -> tuple[str, str]:
    """
    Upload invoice PDF bytes to GCS.
    Returns (public_url, blob_name).
    """
    bucket_name = os.getenv("GCS_BUCKET_NAME")
    if not bucket_name:
        raise ValueError("GCS_BUCKET_NAME is not configured.")

    client = get_gcs_client()
    bucket = client.bucket(bucket_name)

    blob_name = f"invoices/{invoice_number}.pdf"
    blob = bucket.blob(blob_name)
    blob.upload_from_string(pdf_bytes, content_type="application/pdf")

    # Try public access first (works if bucket is set to fine-grained ACL)
    try:
        blob.make_public()
        public_url = f"https://storage.googleapis.com/{bucket_name}/{blob_name}"
        return public_url, blob_name
    except Exception:
        pass

    # Fallback: generate a signed URL valid for 7 days
    try:
        signed_url = blob.generate_signed_url(
            expiration=timedelta(days=7),
            method="GET",
            version="v4",
        )
        return signed_url, blob_name
    except Exception:
        # Last resort: return the standard GCS URL
        return f"https://storage.googleapis.com/{bucket_name}/{blob_name}", blob_name
