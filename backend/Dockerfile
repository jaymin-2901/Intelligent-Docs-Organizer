FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python3-venv build-essential \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./backend/
RUN npm ci --omit=dev --prefix ./backend \
  && npm rebuild sqlite3 --build-from-source --prefix ./backend

COPY backend ./backend
COPY python ./python

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN if [ -f ./python/requirements-render.txt ]; then \
      pip install --no-cache-dir -r ./python/requirements-render.txt; \
    elif [ -f ./python/requirements.txt ]; then \
      pip install --no-cache-dir -r ./python/requirements.txt; \
    fi

WORKDIR /app/backend

ENV NODE_ENV=production
EXPOSE 5000

CMD ["npm", "start"]
