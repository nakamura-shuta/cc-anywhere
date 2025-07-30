# shadcn-svelte 基礎ガイド

## shadcn-svelteとは？

shadcn-svelteは、Tailwind CSSをベースとした再利用可能なUIコンポーネントライブラリです。特徴は：

- **コピー＆ペースト方式**: npmパッケージではなく、必要なコンポーネントのソースコードをプロジェクトにコピー
- **カスタマイズ可能**: コンポーネントのコードを直接編集できる
- **Tailwind CSS統合**: すべてのスタイリングはTailwind CSSクラスで実装
- **アクセシビリティ対応**: WAI-ARIAに準拠した実装

## 1. セットアップ

### 初期設定

```bash
# SvelteKitプロジェクトの作成
npm create svelte@latest my-app
cd my-app
npm install

# Tailwind CSSのインストール
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# shadcn-svelteの初期化
npx shadcn-svelte@latest init
```

### components.json

プロジェクトルートに作成される設定ファイル：

```json
{
  "$schema": "https://shadcn-svelte.com/schema.json",
  "tailwind": {
    "css": "src/app.css",
    "baseColor": "slate"
  },
  "aliases": {
    "components": "$lib/components",
    "utils": "$lib/utils",
    "ui": "$lib/components/ui"
  }
}
```

## 2. コンポーネントの追加

```bash
# 個別のコンポーネントを追加
npx shadcn-svelte@latest add button
npx shadcn-svelte@latest add card
npx shadcn-svelte@latest add input

# 複数のコンポーネントを一度に追加
npx shadcn-svelte@latest add button card input table
```

## 3. 基本的なコンポーネントの使い方

### Button コンポーネント

```svelte
<script>
  import { Button } from '$lib/components/ui/button';
  
  function handleClick() {
    alert('ボタンがクリックされました！');
  }
</script>

<!-- 基本的なボタン -->
<Button onclick={handleClick}>クリック</Button>

<!-- バリアント（見た目の種類） -->
<Button variant="default">デフォルト</Button>
<Button variant="destructive">削除</Button>
<Button variant="outline">アウトライン</Button>
<Button variant="secondary">セカンダリ</Button>
<Button variant="ghost">ゴースト</Button>
<Button variant="link">リンク</Button>

<!-- サイズ -->
<Button size="sm">小さい</Button>
<Button size="default">通常</Button>
<Button size="lg">大きい</Button>
<Button size="icon">
  <Plus class="h-4 w-4" />
</Button>

<!-- 無効化 -->
<Button disabled>無効なボタン</Button>

<!-- アイコン付きボタン -->
<Button>
  <Mail class="mr-2 h-4 w-4" />
  メールを送信
</Button>
```

### Card コンポーネント

```svelte
<script>
  import * as Card from '$lib/components/ui/card';
  // または個別にインポート
  // import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '$lib/components/ui/card';
</script>

<!-- 基本的なカード -->
<Card.Root>
  <Card.Header>
    <Card.Title>カードタイトル</Card.Title>
    <Card.Description>カードの説明文</Card.Description>
  </Card.Header>
  <Card.Content>
    <p>カードの本文がここに入ります。</p>
  </Card.Content>
  <Card.Footer>
    <Button>アクション</Button>
  </Card.Footer>
</Card.Root>

<!-- 実践的な例：ユーザープロフィールカード -->
<Card.Root class="w-[350px]">
  <Card.Header>
    <Card.Title>田中太郎</Card.Title>
    <Card.Description>フロントエンドエンジニア</Card.Description>
  </Card.Header>
  <Card.Content>
    <div class="grid w-full items-center gap-4">
      <div class="flex flex-col space-y-1.5">
        <span class="text-sm text-muted-foreground">メール</span>
        <span>tanaka@example.com</span>
      </div>
      <div class="flex flex-col space-y-1.5">
        <span class="text-sm text-muted-foreground">部署</span>
        <span>開発部</span>
      </div>
    </div>
  </Card.Content>
  <Card.Footer class="flex justify-between">
    <Button variant="outline">キャンセル</Button>
    <Button>保存</Button>
  </Card.Footer>
</Card.Root>
```

### Input と Form コンポーネント

```svelte
<script>
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Button } from '$lib/components/ui/button';
  
  let email = $state('');
  let password = $state('');
  
  function handleSubmit(e) {
    e.preventDefault();
    console.log('ログイン:', { email, password });
  }
</script>

<form onsubmit={handleSubmit} class="space-y-4">
  <div class="space-y-2">
    <Label for="email">メールアドレス</Label>
    <Input
      id="email"
      type="email"
      placeholder="user@example.com"
      bind:value={email}
      required
    />
  </div>
  
  <div class="space-y-2">
    <Label for="password">パスワード</Label>
    <Input
      id="password"
      type="password"
      bind:value={password}
      required
    />
  </div>
  
  <Button type="submit" class="w-full">
    ログイン
  </Button>
</form>
```

### Table コンポーネント

```svelte
<script>
  import * as Table from '$lib/components/ui/table';
  
  let users = [
    { id: 1, name: '田中太郎', email: 'tanaka@example.com', role: '管理者' },
    { id: 2, name: '鈴木花子', email: 'suzuki@example.com', role: 'ユーザー' },
    { id: 3, name: '佐藤次郎', email: 'sato@example.com', role: 'ユーザー' }
  ];
</script>

<Table.Root>
  <Table.Header>
    <Table.Row>
      <Table.Head>名前</Table.Head>
      <Table.Head>メールアドレス</Table.Head>
      <Table.Head>役割</Table.Head>
      <Table.Head class="text-right">アクション</Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each users as user}
      <Table.Row>
        <Table.Cell class="font-medium">{user.name}</Table.Cell>
        <Table.Cell>{user.email}</Table.Cell>
        <Table.Cell>{user.role}</Table.Cell>
        <Table.Cell class="text-right">
          <Button variant="ghost" size="sm">編集</Button>
        </Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>
```

### Badge コンポーネント

```svelte
<script>
  import { Badge } from '$lib/components/ui/badge';
</script>

<!-- ステータス表示 -->
<Badge>新着</Badge>
<Badge variant="secondary">処理中</Badge>
<Badge variant="destructive">エラー</Badge>
<Badge variant="outline">下書き</Badge>

<!-- タスクステータスの例 -->
<div class="flex gap-2">
  <Badge variant="default">完了</Badge>
  <Badge variant="secondary">実行中</Badge>
  <Badge variant="destructive">失敗</Badge>
  <Badge variant="outline">キャンセル</Badge>
</div>
```

### Dialog (Modal) コンポーネント

```svelte
<script>
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  
  let open = $state(false);
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger>
    <Button>ダイアログを開く</Button>
  </Dialog.Trigger>
  <Dialog.Content class="sm:max-w-[425px]">
    <Dialog.Header>
      <Dialog.Title>プロフィールを編集</Dialog.Title>
      <Dialog.Description>
        プロフィール情報を更新します。
      </Dialog.Description>
    </Dialog.Header>
    <div class="grid gap-4 py-4">
      <div class="grid grid-cols-4 items-center gap-4">
        <Label for="name" class="text-right">名前</Label>
        <Input id="name" class="col-span-3" />
      </div>
      <div class="grid grid-cols-4 items-center gap-4">
        <Label for="email" class="text-right">メール</Label>
        <Input id="email" type="email" class="col-span-3" />
      </div>
    </div>
    <Dialog.Footer>
      <Button type="submit">保存</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

### Select コンポーネント

```svelte
<script>
  import * as Select from '$lib/components/ui/select';
  
  let selectedValue = $state('apple');
</script>

<Select.Root bind:value={selectedValue}>
  <Select.Trigger class="w-[180px]">
    <Select.Value placeholder="フルーツを選択" />
  </Select.Trigger>
  <Select.Content>
    <Select.Item value="apple">りんご</Select.Item>
    <Select.Item value="banana">バナナ</Select.Item>
    <Select.Item value="orange">オレンジ</Select.Item>
    <Select.Item value="grape">ぶどう</Select.Item>
  </Select.Content>
</Select.Root>

<p>選択: {selectedValue}</p>
```

## 4. テーマのカスタマイズ

### CSS変数を使ったカラーテーマ

```css
/* app.css */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    
    --radius: 0.5rem;
  }
  
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... ダークモードの色定義 ... */
  }
}
```

## 5. 実践的な組み合わせ例

### タスクリストコンポーネント

```svelte
<script>
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { Input } from '$lib/components/ui/input';
  import { Plus, Trash2 } from 'lucide-svelte';
  
  let tasks = $state([
    { id: 1, title: 'Svelteを学ぶ', status: 'completed' },
    { id: 2, title: 'アプリを作る', status: 'in-progress' },
    { id: 3, title: 'デプロイする', status: 'pending' }
  ]);
  
  let newTaskTitle = $state('');
  
  function addTask() {
    if (newTaskTitle.trim()) {
      tasks.push({
        id: Date.now(),
        title: newTaskTitle,
        status: 'pending'
      });
      newTaskTitle = '';
    }
  }
  
  function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
  }
  
  function getStatusVariant(status) {
    switch (status) {
      case 'completed': return 'default';
      case 'in-progress': return 'secondary';
      case 'pending': return 'outline';
      default: return 'outline';
    }
  }
</script>

<Card.Root class="w-full max-w-2xl">
  <Card.Header>
    <Card.Title>タスクリスト</Card.Title>
    <Card.Description>今日のタスクを管理しましょう</Card.Description>
  </Card.Header>
  <Card.Content>
    <!-- 新規タスク追加フォーム -->
    <div class="flex gap-2 mb-4">
      <Input
        bind:value={newTaskTitle}
        placeholder="新しいタスクを入力..."
        onkeydown={(e) => e.key === 'Enter' && addTask()}
      />
      <Button onclick={addTask} size="icon">
        <Plus class="h-4 w-4" />
      </Button>
    </div>
    
    <!-- タスクリスト -->
    <div class="space-y-2">
      {#each tasks as task}
        <div class="flex items-center justify-between p-3 border rounded-lg">
          <div class="flex items-center gap-3">
            <span>{task.title}</span>
            <Badge variant={getStatusVariant(task.status)}>
              {task.status}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onclick={() => deleteTask(task.id)}
          >
            <Trash2 class="h-4 w-4" />
          </Button>
        </div>
      {/each}
    </div>
  </Card.Content>
</Card.Root>
```

## まとめ

shadcn-svelteの利点：
- **完全なカスタマイズ性**: コンポーネントのソースコードを直接編集可能
- **一貫性のあるデザイン**: Tailwind CSSベースの統一されたスタイル
- **型安全**: TypeScriptサポート
- **軽量**: 必要なコンポーネントのみを追加
- **アクセシビリティ**: 標準準拠の実装

次のドキュメントでは、このアプリケーションのアーキテクチャについて詳しく解説します。