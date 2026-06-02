# 1. Base Image: OS 환경 및 시스템 의존성 설정
FROM --platform=linux/amd64 node:20-bookworm-slim AS base

# 시스템 패키지 업데이트 및 설치 (Vulkan 라이브러리 등)
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    libvulkan1 \
    libgomp1 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Real-ESRGAN-ncnn-vulkan Linux(Ubuntu) 버전 다운로드 및 설치 (모델 파일 포함 버전)
RUN mkdir -p /opt/realesrgan && \
    curl -L https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-ubuntu.zip -o /tmp/realesrgan.zip && \
    unzip /tmp/realesrgan.zip -d /opt/realesrgan && \
    chmod +x /opt/realesrgan/realesrgan-ncnn-vulkan && \
    ln -s /opt/realesrgan/realesrgan-ncnn-vulkan /usr/local/bin/realesrgan-ncnn-vulkan && \
    rm -f /tmp/realesrgan.zip

# 2. Dependencies Image: 패키지 설치만 담당
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# 3. Builder Image: Vite 빌드
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 4. Runner Image: 실제 실행 환경 (최종 이미지)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

# 서버 파일 및 빌드된 프론트엔드 복사
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV PORT 3000

# Express 서버 실행
CMD ["npm", "start"]
