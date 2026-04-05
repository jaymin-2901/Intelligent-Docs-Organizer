FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./backend/
RUN npm ci --omit=dev --prefix ./backend

COPY backend ./backend
COPY python ./python

RUN if [ -f ./python/requirements.txt ]; then \
      pip3 install --no-cache-dir -r ./python/requirements.txt; \
    fi

WORKDIR /app/backend

ENV NODE_ENV=production
EXPOSE 5000

CMD ["npm", "start"]
