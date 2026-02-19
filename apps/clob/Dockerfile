FROM python:3.12-slim

WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Expose ports for API or WebSocket services
EXPOSE 8079

# No default CMD — use CMD or entrypoint in docker-compose.yml or override via CLI
