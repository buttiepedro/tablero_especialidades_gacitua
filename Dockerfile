FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
ENV FLASK_ENV=production

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

RUN addgroup --system app && adduser --system --group app
RUN mkdir -p /nonexistent && chown app:app /nonexistent

EXPOSE 5000

USER app

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]
