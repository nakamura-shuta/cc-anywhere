# レスポンシブデザイン実装ガイド

## 概要

CC-AnywhereのWebインターフェースをAndroid Chrome環境を含むモバイルデバイスで快適に使用できるよう、レスポンシブデザインを実装しました。

## 実装内容

### 1. ブレークポイント設計

Tailwind CSSのデフォルトブレークポイントを使用：

```css
/* モバイル（スマートフォン） */
@media (max-width: 640px) { } /* sm: */

/* タブレット */
@media (min-width: 641px) and (max-width: 1024px) { } /* md:, lg: */

/* デスクトップ */
@media (min-width: 1025px) { } /* lg:, xl: */
```

### 2. 実装済み機能

#### ナビゲーション
- **モバイルメニュー** (`/frontend/src/lib/components/mobile-menu.svelte`)
  - ハンバーガーメニューアイコン
  - Sheet UIによるスライドメニュー
  - 44x44pxの最小タッチターゲット確保

#### タスク一覧画面
- **レスポンシブレイアウト**
  - デスクトップ: テーブル表示
  - モバイル/タブレット: カード表示
- **TaskCard** (`/frontend/src/routes/tasks/components/TaskCard.svelte`)
  - タッチ操作に最適化されたカードUI
  - 重要情報の優先表示

#### タスク詳細画面
- **タブナビゲーション**
  - モバイル向けに2列表示
  - アイコンとラベルの縦配置オプション
- **ボタンサイズ最適化**
  - モバイルでは縮小表示テキスト

#### 新規タスク作成画面
- **フォームレイアウト**
  - グリッドレイアウトのレスポンシブ対応
  - ボタンの全幅表示（モバイル）

### 3. グローバル最適化

#### CSS設定 (`/frontend/src/app.css`)
```css
/* タッチターゲット最適化 */
@media (hover: none) and (pointer: coarse) {
  button, 
  a[role="button"],
  input[type="checkbox"],
  input[type="radio"],
  .touch-target {
    @apply min-h-[44px] min-w-[44px];
  }
}

/* スクロールパフォーマンス最適化 */
.scroll-container {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/* アニメーション削減対応 */
@media (prefers-reduced-motion: reduce) {
  /* アニメーションを最小化 */
}
```

## 使用方法

### レスポンシブユーティリティ

Tailwind CSSのレスポンシブ修飾子を使用：

```svelte
<!-- テキストサイズ -->
<h1 class="text-2xl lg:text-3xl">タイトル</h1>

<!-- 表示/非表示 -->
<span class="hidden sm:inline">デスクトップのみ</span>
<span class="sm:hidden">モバイルのみ</span>

<!-- レイアウト -->
<div class="flex flex-col lg:flex-row">
  <!-- コンテンツ -->
</div>
```

### モバイル判定フック

```typescript
import { IsMobile } from '$lib/hooks/is-mobile.svelte.ts';

const isMobile = new IsMobile(768); // ブレークポイント指定
```

## テスト方法

### Chrome DevTools
1. F12でDevToolsを開く
2. デバイスツールバーをクリック
3. 各デバイスサイズでテスト
   - Mobile S (320px)
   - Mobile M (375px)
   - Mobile L (425px)
   - Tablet (768px)

### 実機テスト
- Android Chrome
- iOS Safari
- タブレットブラウザ

## 今後の改善点

### 優先度：高
- [ ] パフォーマンス最適化
  - 仮想スクロールの実装
  - 画像の遅延読み込み
- [ ] アクセシビリティ改善
  - ARIA属性の追加
  - キーボードナビゲーション

### 優先度：中
- [ ] PWA対応
- [ ] オフライン対応

### 優先度：低（ユーザー要望により）
- [ ] スワイプジェスチャー
- [ ] ソフトキーボード対応の詳細調整

## 注意事項

- デスクトップUIを損なわないよう、モバイルファーストで実装
- 最小タッチターゲットサイズ（44x44px）を維持
- パフォーマンスを考慮し、不要なアニメーションは削減