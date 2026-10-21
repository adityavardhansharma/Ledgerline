FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY pyproject.toml ./
COPY ledgerline_engine ./ledgerline_engine
RUN pip install --no-cache-dir .
EXPOSE 8000
CMD ["uvicorn", "ledgerline_engine.api:app", "--host", "0.0.0.0", "--port", "8000"]
