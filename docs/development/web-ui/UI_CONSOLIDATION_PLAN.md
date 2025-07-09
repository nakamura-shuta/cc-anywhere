# Web UI 統合計画

## 現状

現在、Web UIには2つのバージョンが存在します：

1. **index.html** 
   - 基本的な機能のみ
   - シンプルなインターフェース
   - 軽量で高速

2. **index-sdk-options.html**
   - 完全なSDKオプション対応
   - プリセット管理機能
   - 高度な設定オプション
   - より複雑なUI

## 推奨される統合方針

### オプション1: 単一ファイルに統合（推奨）

`index.html`を拡張して、すべての機能を含む単一のUIにする。

**メリット:**
- メンテナンスが容易
- ユーザーの混乱を避ける
- 機能の一貫性

**実装方法:**
1. `index-sdk-options.html`の機能を`index.html`に統合
2. 「詳細設定」セクションとして高度な機能を折りたたみ可能にする
3. 初期表示はシンプルに保ち、必要に応じて展開

### オプション2: 設定による切り替え

環境変数や設定ファイルでUIモードを切り替える。

```javascript
// 例: .env
UI_MODE=advanced  # または "basic"
```

### オプション3: 動的な切り替え

UIに「シンプルモード/詳細モード」の切り替えボタンを追加。

## 当面の対応

現時点では両方のファイルを維持し、以下のように使い分けます：

- **開発/テスト環境**: `index-sdk-options.html`を使用（全機能をテスト）
- **本番環境**: ユーザーのニーズに応じて選択

## 移行スケジュール案

1. **Phase 1**: 現状維持（両ファイル並存）
2. **Phase 2**: 機能統合とUI改善
3. **Phase 3**: 単一ファイルへの統合完了

## 設定方法

### nginx設定例

```nginx
# デフォルトでSDKオプション版を使用
location / {
    root /path/to/web;
    try_files /index-sdk-options.html =404;
}

# シンプル版へのアクセス
location /simple {
    root /path/to/web;
    try_files /index.html =404;
}
```

### 開発時の切り替え

```bash
# SDKオプション版を開く
open http://localhost:5000/index-sdk-options.html

# シンプル版を開く
open http://localhost:5000/index.html
```