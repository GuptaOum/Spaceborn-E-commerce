FROM python:3.12-slim AS build
WORKDIR /app
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
COPY services/cad-worker/requirements.lock ./requirements.lock
RUN python -m venv /venv && /venv/bin/pip install -r requirements.lock

FROM python:3.12-slim
WORKDIR /app
ENV PATH=/venv/bin:$PATH PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /etc/ssl/certs/rds-global-bundle.pem
COPY --from=build /venv /venv
COPY services/cad-worker/cad ./cad
RUN useradd --system --uid 10001 cad
USER cad
CMD ["celery", "-A", "cad.worker", "worker", "--loglevel=INFO", "--concurrency=2", "--max-tasks-per-child=50", "-Q", "cad"]
