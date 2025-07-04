# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Slash command support with `/project:` and `/user:` prefixes
- Support for both Claude Code (`$ARGUMENTS`) and Handlebars (`{{variable}}`) template syntax
- Comprehensive unit tests for slash command functionality
- Documentation for slash commands in `/docs/features/slash-commands.md`
- Real-time task detail updates with WebSocket and interval refresh fallback
- バッチタスク機能の実装 - 複数のリポジトリに対して同じタスクを並列実行
  - Web UIで複数リポジトリ選択時に自動的にバッチタスクを作成
  - 各タスクにリポジトリ名を表示
  - グループIDによるバッチタスクのステータス確認API
- タスクキューにメタデータ（groupId, repositoryName）のサポートを追加
- モバイル対応Web UI
  - レスポンシブデザインの実装
  - タッチ操作に最適化されたUI要素
  - モバイルでのタスクID表示とコピー機能
- QRコード表示機能（ngrok使用時）
  - `SHOW_QR_CODE=true`でターミナルにQRコードを表示
  - スマートフォンからの簡単アクセス

### Fixed
- Task detail view not updating when left open during task execution
- Unit test failures related to API authentication
- WebSocket update handling to fetch fresh data from server
- バッチタスクで重複したタスクが表示される問題を修正
- Web UIでタスクIDが切れて表示される問題を修正（ホバーで全体表示）

### Changed
- Template engine now supports dual syntax for maximum compatibility
- Improved error handling in slash command processing
- Default timeout changed from 5 minutes to 10 minutes

## [0.2.0] - 2024-12-30

### Added
- ngrok integration for external access during development
- Automatic ngrok tunnel creation when `ENABLE_NGROK=true`
- Display of external access URLs with API key

## [0.1.0] - 2024-12-30

### Added
- Initial release of CC-Anywhere
- HTTP server with Fastify framework
- Claude Code SDK integration
- RESTful API endpoints for task management
- WebSocket support for real-time updates
- Task queue system with priority support
- Worker system (inline, standalone, managed modes)
- SQLite database for task persistence
- Comprehensive test suite
- API authentication with API key
- Web UI for task management
- Repository configuration support
- Timeout handling with phase-specific timeouts
- Automatic retry functionality
- Docker support
- Comprehensive documentation