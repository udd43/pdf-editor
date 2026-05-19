import type { NextConfig } from "next";
import fs from "fs";

// VERSION 파일에서 Docker Hub 태그명(버전)을 읽어 빌드 시점에 환경변수로 주입
const version = fs.readFileSync("./VERSION", "utf-8").trim();

const nextConfig: NextConfig = {
  reactStrictMode: false,
  devIndicators: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
};

export default nextConfig;
