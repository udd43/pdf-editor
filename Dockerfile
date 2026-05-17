# 1. Base Image: OS 환경 및 시스템 의존성 설정
FROM node:20-bookworm-slim AS base

# 시스템 패키지 업데이트 및 설치 (Vulkan 라이브러리 등)
# node:20-bookworm-slim은 Debian 기반이므로 apt-get을 사용합니다.
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    libvulkan1 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# waifu2x-ncnn-vulkan Linux(Ubuntu) 버전 다운로드 및 설치
RUN mkdir -p /opt/waifu2x && \
    curl -L https://github.com/nihui/waifu2x-ncnn-vulkan/releases/download/20220728/waifu2x-ncnn-vulkan-20220728-ubuntu.zip -o /tmp/waifu2x.zip && \
    unzip /tmp/waifu2x.zip -d /tmp/waifu2x_extracted && \
    mv /tmp/waifu2x_extracted/waifu2x-ncnn-vulkan-20220728-ubuntu/* /opt/waifu2x/ && \
    ln -s /opt/waifu2x/waifu2x-ncnn-vulkan /usr/local/bin/waifu2x-ncnn-vulkan && \
    rm -rf /tmp/waifu2x.zip /tmp/waifu2x_extracted

# 2. Dependencies Image: 패키지 설치만 담당
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# 3. Builder Image: Next.js 빌드
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 텔레메트리 끄기 (선택사항)
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# 4. Runner Image: 실제 실행 환경 (최종 이미지)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# 빌드된 결과물 복사
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV PORT 3000

# 서버 실행
CMD ["npm", "start"]
