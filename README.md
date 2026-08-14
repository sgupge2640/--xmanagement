
# シフト管理アプリ

グループ単位でシフト作成・応募・交代申請・メンバー管理・給料確認を行う Web アプリです。

## 主な機能

- 認証（ログイン / サインアップ）
- マイページ（所属グループ一覧）
- グループ作成 / 参加
- シフト作成・閲覧・詳細表示
- 交代申請の管理
- メンバー管理
- 給与表示

## 技術スタック

- Vite 6
- React 18
- TypeScript
- Supabase
- Tailwind CSS

## 前提環境

- Node.js 20 以上
- npm または pnpm

## セットアップ

1. 依存関係をインストール

```bash
npm install
```

2. 環境変数ファイルを作成

```bash
cp .env.example .env
```

PowerShell の場合:

```powershell
Copy-Item .env.example .env
```

3. `.env` を編集

```env
VITE_SUPABASE_PROJECT_ID=your-supabase-project-id
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

4. 開発サーバーを起動

```bash
npm run dev
```

## ビルドと起動

```bash
npm run build
```

ローカルでビルド成果物を確認したい場合:

```bash
npx vite preview
```

## 再読み込み時に Not Found になる問題について

このアプリは SPA（History API）でルーティングしています。
そのため、`/groups/1/dashboard` のような URL を直接開いたり再読み込みすると、
ホスティング側で `index.html` にフォールバックしない限り 404/Not Found になります。

本リポジトリでは、以下を設定済みです。

- Render: [render.yaml](render.yaml) の `routes.rewrite`
- Vercel: ルートの [vercel.json](vercel.json) の `rewrites`
- Netlify 互換: [public/_redirects](public/_redirects)

これで主要な静的ホスティング環境で「再読み込みで Not Found」を回避できます。

### Render 利用時の重要ポイント

Render で **Dashboard から単体作成した Static Site** は、`render.yaml` を自動適用しない場合があります。
その場合は Render の対象サービス画面で次を手動設定してください。

1. `Redirects/Rewrites` を開く
2. ルールを追加
3. `Source: /*`
4. `Destination: /index.html`
5. `Action: Rewrite`
6. 保存後に再デプロイ

これが入っていないと、`/mypage` 直アクセスや再読み込みで 404 になります。

## デプロイ時のチェックリスト

- Build Command が `npm run build` になっている
- Publish Directory が `dist` になっている
- 環境変数 `VITE_SUPABASE_PROJECT_ID` / `VITE_SUPABASE_ANON_KEY` を設定済み
- SPA リライト（`/* -> /index.html`）が有効

## ディレクトリ構成（主要部分）

```text
src/
  app/
    App.tsx
    components/
    lib/
    utils/
  styles/
index.html
vite.config.ts
render.yaml
vercel.json
```

## よくあるトラブル

### 1. 再読み込みで 404 になる

- 原因: SPA リライト未設定
- 対応: ホスティング設定で `/*` を `/index.html` へリライト

### 2. Supabase 接続エラー

- 原因: 環境変数の未設定・入力ミス
- 対応: `.env` の値とデプロイ先の環境変数を再確認

### 3. ビルドに失敗する

- 原因: Node.js バージョン不一致
- 対応: Node.js 20 以上を使用

## 参考

- Figma 元デザイン:
  https://www.figma.com/design/4EbeoHzCTTByCVFoEO0ejV/%E3%82%A2%E3%83%97%E3%83%AA%E3%82%B3%E3%83%B3%E3%83%86%E3%82%B9%E3%83%88
  