# syntax=docker/dockerfile:1
FROM python:3.10-alpine

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 11112

COPY . .

CMD ["python", "app.py"]