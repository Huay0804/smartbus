FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render/Heroku sẽ set PORT; local mặc định 8000
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "gunicorn wsgi:app --bind 0.0.0.0:${PORT}"]

