FROM python:3.10-slim

WORKDIR /app
COPY challenge.py /app
COPY H1dd3n-_F1@g.txt /app
RUN pip install --no-cache-dir flask

EXPOSE 5005
CMD ["python", "challenge.py"] 