FROM python:3.12-slim

WORKDIR /srv/app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY static ./static
RUN mkdir -p /srv/app/data/uploads

ENV RTK_DB=/srv/app/data/rtk_crm.db \
    RTK_UPLOADS=/srv/app/data/uploads \
    RTK_SECRET=change-me-in-production

EXPOSE 8000
VOLUME ["/srv/app/data"]

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
