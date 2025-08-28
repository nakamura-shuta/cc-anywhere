import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES Moduleで__dirnameを取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// プロジェクトルートの.envファイルを読み込み
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// system-tests/.envも読み込み（上書き）
dotenv.config();

export default defineConfig({
  // テストディレクトリ
  testDir: './api-tests',
  
  // タイムアウト設定
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  
  // 並列実行
  fullyParallel: false,  // APIテストは順次実行
  workers: 1,
  
  // リトライ設定
  retries: 0,
  
  // レポーター
  reporter: [
    ['list'],
  ],
  
  // プロジェクト（ブラウザは使わないが、Playwrightのテストランナーとして必要）
  projects: [
    {
      name: 'api-tests',
      testMatch: '*.test.ts',
    },
  ],
});