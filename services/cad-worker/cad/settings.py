import os

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
QUEUE = os.environ.get("CELERY_CAD_QUEUE", "cad")
UPLOADS_BUCKET = os.environ.get("UPLOADS_BUCKET") or None
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", ".uploads")
AWS_REGION = os.environ.get("AWS_REGION", "ap-south-1")
MAX_FILE_MB = int(os.environ.get("MAX_UPLOAD_MB", "50"))


def db_params() -> dict[str, str]:
    ssl = os.environ.get("DB_SSL", "disable")
    ca = os.environ.get("DB_SSL_CA_PATH")
    sslmode = "disable" if ssl == "disable" else ("verify-full" if ca else "require")
    params = {
        "host": os.environ["DB_HOST"],
        "port": os.environ.get("DB_PORT", "5432"),
        "dbname": os.environ["DB_NAME"],
        "user": os.environ["DB_USER"],
        "password": os.environ["DB_PASSWORD"],
        "sslmode": sslmode,
        "connect_timeout": "5",
        "application_name": "spaceborn-cad-worker",
    }
    if ca and sslmode == "verify-full":
        params["sslrootcert"] = ca
    return params
