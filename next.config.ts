import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';

const apk = '/downloads/zuerst-android.apk';

const config: NextConfig = {
  output: 'export',
  outputFileTracingRoot: process.cwd(),
  trailingSlash: true,
  poweredByHeader: false,
  env: { NEXT_PUBLIC_ZUERST_APK: existsSync(`public${apk}`) ? apk : '' },
};

export default config;
