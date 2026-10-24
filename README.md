# ClimbLog production starter

これまでの画面（カレンダー・記録編集・ジムごとのグレード設定・統計）を引き継いだ個人用Webアプリです。Supabase Authでログインし、記録をアカウント専用のPostgres行に保存します。iPhone/PC対応です。

## Supabaseの準備
1. SupabaseでFree projectを作成します。
2. SQL Editorで `supabase/schema.sql` を実行し、保存テーブルとRLSアクセス制御を作成します。
3. Authentication > URL Configurationに公開後のGitHub Pages URLを登録します。
4. `config.example.js` を `config.js` にコピーし、Project URLとPublishable keyを設定します。Secret/service_role keyはブラウザー側に置かないでください。

## GitHub Pagesへ公開
1. GitHubリポジトリにフォルダー内のファイルを登録してmainへpushします。
2. Settings > PagesでGitHub Actionsを選択します。同梱workflowが公開します。
3. Pages URLをSupabaseのURL Configurationにも許可URLとして追加します。
4. アプリでアカウントを作成し、確認メールから戻ってログインします。同じアカウントでスマホとPCから使えます。

PrivateリポジトリでもPagesのサイトURLは公開扱いです。記録データはログインとRLSで本人のアカウントに制限されます。

## バックアップと無料枠
ヘッダーの「書き出し」からJSONを定期保存してください。Supabase Freeのデータベースは500MBで、超過すると読み取り専用になることがあります。利用の少ないFree projectは一時停止される場合があります。写真・動画は保存せず、記録はテキスト中心です。

この初期版はアカウントごとにJSONBデータを1行で保存します。長期間の大量記録では同期データが大きくなるため、必要になった時点で記録を1件ずつの行に分割する移行が必要です。

既存プロトタイプのローカル記録は自動移行しません。ログイン後のデータ混在を防ぐため、新しいアカウントは空の状態から開始します。

## フォルダー構成
- index.html: 画面のHTMLとスタイル
- assets/js/: 画面操作とクラウド同期
- supabase/schema.sql: Supabaseのテーブルとアクセス制御
- docs/data-model.json: 記録データの構造
- .github/workflows/: GitHub Pagesの公開設定
- config.js: Supabase接続設定（Publishable keyのみ）

## 開発中の機能
- 最大出力測定：ハングボード保持、地面からの片手リフト（左右別）、加重懸垂を記録し、握り方・持ち手厚などの条件ごとに推移と自己ベストを表示します。通常トレーニングは重複を整理した種目リストから選びます。
- プロジェクト：外岩・ジム課題を管理し、通常の記録を紐付けて進捗を確認できます。
- 記録検索：活動種別とキーワードで検索します。
- 目標：月間ジム日数・月間トレーニング日数・年間外岩日数を設定します。
- 設定：ライト／ダーク／端末テーマ、週の開始曜日、ジム設定、JSONバックアップ、ログアウトを管理します。設定はクラウドに同期します。

## ローカルテスト
Node.jsを使い、追加した集計ロジックを次のコマンドで確認できます。

```powershell
node --test tests/*.test.mjs
```

開発ブランチの画面で実際に保存動作を確認するときは、本番アカウントではなく開発用Supabase Authユーザーでログインしてください。
