# 📖 てきとー日記 (Tekito Diary)

「今日あったこと」を適当に書くだけで、AIが深掘り質問をして濃い日記に仕上げてくれるWebアプリケーション。

---

## ✨ 主な機能

| 機能 | 説明 |
|---|---|
| **フリーテキスト入力** | 箇条書き・メモ書きなど自由な形式で入力 |
| **AI深掘り質問** | メモの抽象度に応じて2〜5個の質問を自動生成。選択肢タップ or 自由入力で回答 |
| **AI日記整形 (Gemini)** | メモ＋回答をもとに、事実ベースで読みやすい日記を自動生成 |
| **時間帯推測** | 入力時刻から「朝」「夜」など時間帯を自然に文章に反映 |
| **ユーザープロファイル学習** | 日記の内容からユーザーの「性格」「人間関係」「よく行く場所」などを自動学習し、次回以降の日記生成に活用 |
| **同日マージ/上書き** | 同じ日に複数回書く場合、追記（マージ）か上書き（削除して新規）を選択可能 |
| **カレンダー履歴** | カレンダー形式で過去の日記を閲覧。日記がある日はドットで表示 |
| **日記の再編集** | 履歴画面から、AIが生成した日記テキストを自由に手直し可能 |
| **PWA & プッシュ通知** | アプリとしてホーム画面に追加可能。毎日指定した時刻に「日記を書こう」とPush通知が届く |
| **管理画面** | 登録ユーザーの一覧表示、新規作成、権限変更（User/Admin）、削除機能 |

---

## 🛠️ 技術スタック

| カテゴリ | 技術 |
|---|---|
| フレームワーク | **Next.js** (App Router) |
| 言語 | **TypeScript** |
| スタイリング | **Tailwind CSS** |
| アイコン | `lucide-react` |
| 認証・データベース | **Supabase** (Auth / PostgreSQL / RLS) |
| AI API | **Google Gemini** (`@google/generative-ai`) |
| プッシュ通知 | **Web Push** (`web-push`) + Vercel Cron |
| ホスティング | **Vercel** |

---

## 📁 ディレクトリ構成

```
tekito_diary/web/
├── src/
│   ├── app/
│   │   ├── admin/           # 管理者ページ
│   │   ├── api/             # API Router (Auth, Admin, Cron, Gemini, Notifications)
│   │   ├── diary/           # 日記入力・カレンダー履歴
│   │   ├── login/           # ログインページ
│   │   ├── layout.tsx       # 共通レイアウト
│   │   └── page.tsx         # ルート（ログインへリダイレクト）
│   ├── components/          # 共通UIコンポーネント (NotificationSettings, FollowUpForm)
│   └── lib/                 # Supabase クライアント設定
├── public/                  # PWAマニフェスト、サービスワーカー (sw.js)、アイコン
├── supabase-schema.sql      # Supabase用 データベースマイグレーション
└── next.config.ts           # Next.js の設定
```

---

## 🚀 環境構築

### 前提条件

- **Node.js** v20以上
- **npm**
- **Supabase** プロジェクト（[作成はこちら](https://supabase.com/)）
- **Google Gemini APIキー**（[Google AI Studio](https://aistudio.google.com/apikey)）

### セットアップ手順

**1. リポジトリのクローン**
```bash
git clone https://github.com/mekabu-11/tekito_diary.git
cd tekito_diary/web
```

**2. パッケージのインストール**
```bash
npm install
```

**3. VAPIDキーの生成（プッシュ通知用）**
```bash
npx web-push generate-vapid-keys
# 出力された Public Key と Private Key を控える
```

**4. 環境変数の設定**
webディレクトリ内に `.env.local` を作成し、以下の内容を設定します。

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=あなたのSupabaseのURL
NEXT_PUBLIC_SUPABASE_ANON_KEY=あなたのSupabaseのanonキー
SUPABASE_SERVICE_ROLE_KEY=あなたのSupabaseのservice_roleキー

# OpenAI API
OPENAI_API_KEY=あなたのOpenAI APIキー

# Web Push Notifications
VAPID_EMAIL=mailto:あなたのメールアドレス
NEXT_PUBLIC_VAPID_PUBLIC_KEY=生成したVAPID Public Key
VAPID_PRIVATE_KEY=生成したVAPID Private Key

# Vercel Cron Secret (Cronジョブの不正アクセス防止)
CRON_SECRET=ランダムな文字列を設定
```

**5. データベースの構築**
Supabaseのダッシュボード（SQL Editor）を開き、`supabase-schema.sql` の内容をすべて実行して、テーブル・RLS・トリガーを作成します。

**6. ローカルサーバーの起動**
```bash
npm run dev
```
ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

---

## ☁️ デプロイ (Vercel)

このプロジェクトは Vercel に最適化されています。

1. GitHub リポジトリを Vercel に連携
2. Build Settings で `Root Directory` を `web` に設定
3. Environment Variables（環境変数）に `.env.local` と同じ内容を登録
4. Vercel のデプロイを実行

`vercel.json` により、`/api/cron/notify` が1時間ごとにスケジュール実行され、設定した時刻になったユーザーへプッシュ通知が送信されます。

---

## 🔒 管理者への昇格

Supabase SQL Editor で以下のクエリを実行し、特定のアカウントのロールを `admin` に変更します。

```sql
UPDATE user_profiles SET role = 'admin' WHERE id = '対象ユーザーのUUID';
```

または、ユーザー作成時にメールアドレスが `gamingmokugyo@gmail.com` であれば、トリガーにより自動的に `admin` に設定されます。
