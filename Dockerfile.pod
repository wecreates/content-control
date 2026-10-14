# Same web service, with CPU print dependencies. No credentials in image/build args.
FROM node:22-bookworm-slim AS node
FROM python:3.12-slim-bookworm
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates ffmpeg tesseract-ocr tesseract-ocr-eng fonts-dejavu-core git \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json requirements-pod-runtime.txt ./
RUN npm ci --ignore-scripts --omit=dev \
 && pip install --no-cache-dir -r requirements-pod-runtime.txt
COPY . .
RUN useradd --uid 10001 --create-home podworker && chown -R podworker:podworker /app
ENV NODE_ENV=production PUBLICATION_ENABLED=false POD_PUBLICATION_ENABLED=false POD_SERVICE_ENABLED=false POD_PRODUCTION_ENABLED=false
USER podworker
EXPOSE 10000
CMD ["npm", "start"]
