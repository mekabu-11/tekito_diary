# TekitoDiary

「今日あったこと」を適当に書くだけで、AIが深掘り質問をして濃い日記に仕上げてくれるWebアプリケーション。

---

## 主な機能

| 機能 | 説明 |
|---|---|
| **フリーテキスト入力** | 箇条書き・メモ書きなど自由な形式で入力 |
| **AI深掘り質問** | メモの抽象度に応じて0〜10個の質問を自動生成。選択肢タップ or 自由入力で回答 |
| **AI日記整形** | メモ＋回答をもとに、事実ベースで読みやすい日記を自動生成 |
| **時間帯推測** | 入力時刻から「朝」「夜」など時間帯を自然に文章に反映 |
| **ユーザープロファイル学習** | 日記の内容からユーザーの「性格」「人間関係」「よく行く場所」などを自動学習し、次回以降の日記生成に活用 |
| **同日マージ/上書き** | 同じ日に複数回書く場合、追記（マージ）か上書きを選択可能 |
| **カレンダー履歴** | カレンダー形式で過去の日記を閲覧。日記がある日はドットで表示 |
| **日記の再編集** | 履歴画面から、AIが生成した日記テキストを自由に手直し可能 |
| **AI磨き直し（Brushup）** | 指示文を入力してAIに日記を書き直してもらう機能。プレビュー確認後に適用 |
| **原文メモ編集** | 元のメモテキストをインライン編集・保存可能 |
| **バージョン履歴** | 日記の編集履歴を自動保存。過去のバージョンを閲覧・復元可能 |
| **TODOタスク自動抽出** | 日記からアクション項目を自動抽出し、TODOリストとして管理 |
| **ダッシュボード** | 今月の統計、連続記録、気分グラフ、週次サマリー、AIコメントなどをカード表示 |
| **ウィジェット並び替え** | ダッシュボードのウィジェットをドラッグ&ドロップで並び替え・表示切り替え可能 |
| **人間関係グラフ** | 日記に登場する人物をAIが分析し、Canvas上にインタラクティブなネットワーク図で可視化 |
| **デジタルツインAIチャット** | ユーザーの性格・価値観・経験を学習した「もう一人の自分」AIとリアルタイムで対話 |
| **ダークモード** | ライト/ダークモード切り替え対応 |
| **PWA対応** | アプリとしてホーム画面に追加可能 |
| **管理画面** | 登録ユーザーの一覧表示、新規作成、権限変更（User/Admin）、削除機能 |

---

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| フレームワーク | **Next.js 16** (App Router) |
| 言語 | **TypeScript 5** |
| スタイリング | **Tailwind CSS 4** |
| アイコン | **Lucide React** |
| カレンダー | **React Calendar** |
| ドラッグ&ドロップ | **@dnd-kit** |
| 認証・データベース | **Supabase** (Auth / PostgreSQL / RLS) |
| AI API | **OpenAI** (gpt-5.4-mini) |
| テスト | **Vitest** |
| ホスティング | **Vercel** |

---

## ディレクトリ構成

```
tekito_diary/web/
├── src/
│   ├── app/
│   │   ├── admin/              # 管理者ページ
│   │   ├── api/
│   │   │   ├── admin/users/    # ユーザー管理 API
│   │   │   ├── auth/profile/   # ユーザープロファイル取得
│   │   │   └── ai/
│   │   │       ├── questions/  # AI深掘り質問生成
│   │   │       ├── format/     # AI日記整形
│   │   │       ├── learn/      # プロファイル・エピソード学習
│   │   │       ├── brushup/    # AI日記磨き直し
│   │   │       ├── todos/      # TODOタスク自動抽出
│   │   │       ├── mood/       # 気分スコア分析
│   │   │       ├── comment/    # AIコメント生成
│   │   │       ├── weekly-report/ # 週次サマリー生成
│   │   │       ├── social-graph/  # 人間関係グラフ分析
│   │   │       └── twin-chat/     # デジタルツインAIチャット
│   │   ├── dashboard/          # ダッシュボード
│   │   ├── diary/
│   │   │   ├── page.tsx        # 日記入力ページ
│   │   │   └── history/        # カレンダー履歴・編集・バージョン管理
│   │   ├── social-graph/       # 人間関係グラフページ
│   │   ├── twin-chat/          # デジタルツインAIチャットページ
│   │   ├── login/              # ログインページ
│   │   ├── layout.tsx          # 共通レイアウト
│   │   └── page.tsx            # ルート（/dashboard へリダイレクト）
│   ├── components/
│   │   ├── FollowUpForm.tsx    # AI質問回答モーダル
│   │   ├── MiniCalendar.tsx    # カレンダーウィジェット
│   │   ├── MoodChart.tsx       # 気分推移グラフ
│   │   └── ThemeProvider.tsx   # ダークモード管理
│   ├── lib/
│   │   ├── models.ts           # AIモデル定義
│   │   ├── supabase.ts         # ブラウザ用 Supabase クライアント
│   │   ├── supabase-server.ts  # サーバー用 Supabase クライアント
│   │   ├── diary-versions.ts   # バージョン履歴管理
│   │   └── parse-ai-json.ts    # AIレスポンスのJSON抽出ユーティリティ
│   ├── __tests__/              # テストファイル（Vitest）
│   └── middleware.ts           # 認証・ルーティングミドルウェア
├── public/                     # PWAマニフェスト、アイコン
├── supabase-schema.sql         # データベーススキーマ・RLS定義
└── next.config.ts              # Next.js 設定
```

---

## データベース構成

| テーブル | 説明 |
|---|---|
| `diaries` | 日記エントリ（原文・整形後テキスト） |
| `diary_versions` | 日記の編集履歴スナップショット |
| `core_profiles` | ユーザーの性格・人間関係・場所などの学習データ |
| `episodes` | 一時的なエピソード情報（最大50件、古い順に自動削除） |
| `todos` | 日記から抽出したTODOタスク |
| `user_profiles` | ユーザーの表示名・ロール管理 |

RLSにより、ユーザーは自分のデータのみアクセス可能。

---

## 環境構築

### 前提条件

- **Node.js** v20以上
- **npm**
- **Supabase** プロジェクト（[作成はこちら](https://supabase.com/)）
- **OpenAI APIキー**（[OpenAI Platform](https://platform.openai.com/)）

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

**3. 環境変数の設定**

`web` ディレクトリ内に `.env.local` を作成し、以下の内容を設定します。

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=あなたのSupabaseのURL
NEXT_PUBLIC_SUPABASE_ANON_KEY=あなたのSupabaseのanonキー
SUPABASE_SERVICE_ROLE_KEY=あなたのSupabaseのservice_roleキー

# OpenAI API
OPENAI_API_KEY=あなたのOpenAI APIキー
```

**4. データベースの構築**

Supabaseのダッシュボード（SQL Editor）を開き、`supabase-schema.sql` の内容をすべて実行して、テーブル・RLS・トリガーを作成します。

**5. ローカルサーバーの起動**
```bash
npm run dev
```
ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

---

## テスト

```bash
cd web && npm test
```

テストファイルは `web/src/__tests__/` に配置しており、Vitestで実行します。

---

## デプロイ (Vercel)

1. GitHub リポジトリを Vercel に連携
2. Build Settings で `Root Directory` を `web` に設定
3. Environment Variables に `.env.local` と同じ内容を登録
4. デプロイを実行

```sql
UPDATE user_profiles SET role = 'admin' WHERE id = '対象ユーザーのUUID';
```

ユーザー作成時にメールアドレスが `gamingmokugyo@gmail.com` であれば、トリガーにより自動的に `admin` に設定されます。
