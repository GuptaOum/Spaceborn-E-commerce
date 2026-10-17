"""Reads uploads from the same place the Node API wrote them: S3 in AWS, a shared directory locally."""

import os

import boto3

from . import settings

_s3 = None


class TooLarge(Exception):
    pass


def read(key: str) -> bytes:
    limit = settings.MAX_FILE_MB * 1024 * 1024
    if settings.UPLOADS_BUCKET:
        global _s3
        _s3 = _s3 or boto3.client("s3", region_name=settings.AWS_REGION)
        obj = _s3.get_object(Bucket=settings.UPLOADS_BUCKET, Key=key)
        if obj["ContentLength"] > limit:
            raise TooLarge(key)
        return obj["Body"].read()
    root = os.path.realpath(settings.UPLOAD_DIR)
    path = os.path.realpath(os.path.join(root, key))
    if not path.startswith(root + os.sep):
        raise ValueError("invalid storage key")
    if os.path.getsize(path) > limit:
        raise TooLarge(key)
    with open(path, "rb") as f:
        return f.read()
