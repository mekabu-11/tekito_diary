# 📖 てきとー日記 (Tekito Diary)

「今日あったこと」を適当に書くだけで、AIが深掘り質問をして濃い日記に仕上げてくれるスマホアプリ。

---

## ✨ 主な機能

| 機能 | 説明 |
|---|---|
| **フリーテキスト入力** | 箇条書き・メモ書きなど自由な形式で入力 |
| **AI深掘り質問** | メモの抽象度に応じて2〜5個の質問を自動生成。選択肢タップ or 自由入力で回答 |
| **AI日記整形 (Gemini)** | メモ＋回答をもとに、事実ベースで読みやすい日記を自動生成 |
| **時間帯推測** | 入力時刻から「朝」「夜」など時間帯を自然に文章に反映 |
| **日付選択** | 今日以外の日付の日記も書ける（◀ ▶ で日付移動） |
| **同日マージ/上書き** | 同じ日に複数回書く場合、追記（マージ）か上書き（削除して新規）を選択可能 |
| **カレンダー履歴** | 日本語カレンダーで過去の日記を閲覧。日記がある日は紫のドットで表示 |
| **ローカル保存** | 整形された日記をAsyncStorageでデバイス内に永続保存 |
| **リマインド通知** | 毎日0時にローカル通知で日記の記入をリマインド（実機のみ） |

---

## 🛠️ 技術スタック

| カテゴリ | 技術 |
|---|---|
| フレームワーク | React Native (Expo SDK 54) |
| 言語 | TypeScript |
| ルーティング | Expo Router (ファイルベース) |
| AI API | Google Gemini (`@google/generative-ai`) |
| ローカル保存 | `@react-native-async-storage/async-storage` |
| カレンダー | `react-native-calendars` |
| 通知 | `expo-notifications`（ローカル通知） |
| アイコン | `lucide-react-native` |

---

## 📁 ディレクトリ構成

```
tekito_diary/
├── app/                          # 画面
│   ├── _layout.tsx               # ルートレイアウト (Stack + 通知初期化)
│   ├── index.tsx                 # ホーム (入力・日付選択・深掘り質問・AI変換)
│   └── history.tsx               # カレンダー日記閲覧
├── components/
│   ├── DiaryCard.tsx             # 日記表示カード
│   └── FollowUpForm.tsx          # AI深掘り質問フォーム（選択肢 + 自由入力）
├── services/
│   ├── gemini.ts                 # Gemini API（質問生成 + 日記整形）
│   ├── storage.ts                # AsyncStorage CRUD
│   └── notification.ts           # ローカル通知スケジュール
├── .env                          # 環境変数（APIキー）
├── app.json                      # Expo設定
├── eas.json                      # EAS Build設定
└── package.json
```

---

## 🚀 環境構築

### 前提条件

- **Node.js** v20以上
- **npm**
- **Google Gemini APIキー**（[Google AI Studio](https://aistudio.google.com/apikey) で無料取得）

### セットアップ

```bash
# 1. クローン
git clone https://github.com/your-username/tekito_diary.git
cd tekito_diary

# 2. パッケージインストール
npm install

# 3. APIキー設定
# .env ファイルを編集:
EXPO_PUBLIC_GEMINI_API_KEY=ここにあなたのAPIキーを貼り付け
```

> [!CAUTION]
> `.env` ファイルは `.gitignore` に含まれています。APIキーを絶対にGitにコミットしないでください。

---

## 📱 アプリの起動・ビルド方法

### 方法①：Expo Go（開発用 / PCが必要）

PCで開発サーバーを起動し、スマホのExpo Goアプリで接続します。

```bash
npx expo start --clear
```

QRコードをスマホでスキャン → アプリが起動します。

> **注意**: PCを切るとアプリは動作しません。

---

### 方法②：EAS Build（スタンドアロン / PC不要）

クラウドでビルドし、スマホに直接インストールします。**ビルド後はPC不要**で動作します。

#### 初回セットアップ（1回だけ）

```bash
# EAS CLI インストール
npm install -g eas-cli

# Expo アカウントにログイン
eas login

# EAS プロジェクト初期化（すでに設定済みの場合は不要）
eas build:configure --platform all
```

> Expoアカウントは [expo.dev/signup](https://expo.dev/signup) で無料作成できます。

#### Android ビルド

```bash
eas build --platform android --profile preview
```

ビルド完了後（約5〜15分）、以下の方法で `.apk` を取得してインストール：

1. ターミナルに表示されるダウンロードURLを開く
2. または [expo.dev](https://expo.dev) のダッシュボードからダウンロード
3. `.apk` ファイルをAndroid端末に転送しインストール

> [!TIP]
> Android端末の **設定 → セキュリティ → 不明なアプリのインストール** を許可する必要がある場合があります。

#### iOS ビルド

```bash
eas build --platform ios --profile preview
```

> [!WARNING]
> iOSビルドには **有料の Apple Developer Program（年額 $99）** への加入が必要です。

#### コード更新後の再ビルド

コードを変更した場合は、同じコマンドで再ビルドしてください：

```bash
eas build --platform android --profile preview
```

#### ビルドプロファイル一覧

| プロファイル | 用途 |
|---|---|
| `preview` | テスト配布用（APK直接インストール） |
| `production` | ストアリリース用（App Store / Google Play） |

---

## 🏗️ アプリの仕組み

### 日記作成フロー

```
メモ入力（例：「カレー食べた」）
  ↓
[AIで日記にする] ボタン
  ↓
AI が深掘り質問を生成（どこで？おいしかった？等）
  ↓
選択肢をタップ or 自由入力で回答
  ↓
メモ + 回答 + 現在時刻 をもとにAIが日記を生成
  ↓
AsyncStorage に保存
```

### 同日の日記がある場合

```
2回目以降の投稿時にダイアログ表示：
├─ 「追記（マージ）」→ 既存メモ + 新メモを合わせて再整形
├─ 「上書き」        → 既存を捨てて新規作成
└─ 「キャンセル」    → 何もしない
```

### データモデル

```typescript
interface Diary {
  id: string;           // ユニークID
  date: string;         // YYYY-MM-DD（カレンダー用キー）
  displayDate: string;  // 表示用日付（ja-JP）
  originalText: string; // ユーザーの元メモ
  formattedText: string;// AI整形後の日記
  timestamp: number;    // タイムスタンプ
}
```

---

## 🔧 今後の拡張案

- [ ] 日記の削除・編集機能
- [ ] ダークモード対応
- [ ] AsyncStorage → SQLite への移行（データ量増加対策）
- [ ] アプリアイコン・スプラッシュ画面のカスタマイズ
- [ ] Web対応（GitHub Pages へのデプロイ）
