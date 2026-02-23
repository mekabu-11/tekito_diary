# てきとー日記

メモをAIが日記に整形してくれる個人用日記アプリ。

## 機能

- メモを入力すると、AIが自然な文章の日記に整形する
- 日記投稿後にAIが深掘り質問を生成し、より詳しい日記にできる
- カレンダーで過去の日記を閲覧・編集できる
- 日記から自動でユーザーのプロフィール・エピソードを学習し、次回以降の質問・整形に活用する

## 技術スタック

- **フロントエンド**: Next.js 15 (App Router) / React / Tailwind CSS
- **バックエンド**: Next.js API Routes
- **データベース**: Supabase (PostgreSQL)
- **AI**: OpenAI API (gpt-5-mini, gpt-5-nano, gpt-5.1 等)
- **認証**: Supabase Auth

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local` を作成して以下を設定する。

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Supabase Service Role（管理者操作用・サーバーサイドのみ）
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=sk-...
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) をブラウザで開く。

## Supabase テーブル構成

| テーブル | 用途 |
|---------|------|
| `diaries` | 日記本文（original_text / formatted_text） |
| `user_profiles` | ユーザー表示名・ロール（admin/user） |
| `core_profiles` | AIが学習した性格・趣味・人間関係などの永続情報 |
| `episodes` | AIが学習した直近のできごと（最大50件） |

## 管理者機能

`user_profiles` テーブルで `role = 'admin'` に設定したユーザーは管理画面にアクセスでき、AIモデルの切り替えが可能。
