# CC-Anywhere

Claude Code SDKをHTTP経由で利用可能にするAPIサーバー

## クイックスタート

```bash
# インストール
npm install

# 設定
cp .env.example .env
# .envでCLAUDE_API_KEYを設定

# 起動
npm run dev
```

アクセス: http://localhost:5000

## 主な機能

- Claude Code SDK統合
- 非同期タスク実行
- WebSocketリアルタイム通信
- Git Worktree対応
- スケジューラー