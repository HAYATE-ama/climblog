# GitHubと本番公開の対象

GitHubにはアプリのソース、画像、テスト、ドキュメント、RLSを含むSQL定義を登録します。本番サイトにはindex.html、config.js、manifest.webmanifest、service-worker.js、assetsのみを配信します。GitHub Actionsで単体テストが成功した場合だけ公開します。

## 公開してよいもの

- HTML/CSS/JavaScriptとアプリ用アイコン
- 秘密を含まないテスト、設計資料、SQL定義
- Supabase Project URLとPublishable key。ブラウザーで使用する公開値であり、認証とデータベース側のRLSでデータへの権限を制限します。設定ファイルを隠すことはアクセス制御の代わりになりません。

## 公開してはいけないもの

- LOCAL_TEST_ACCOUNT.txtなどのメールアドレス・パスワード・リカバリーコードのメモ
- .env、Supabase Secret/service_role key、データベース接続パスワード、AI API key、GitHub token、秘密鍵
- 実際の記録・身体情報を含むJSONバックアップ、DBダンプ、認証トークン、ブラウザープロファイル
- 個人情報が映るスクリーンショット、ログ、テスト実行結果

ローカル専用ファイルはprivate/またはlocal-only/へ置いてください。バックアップはbackups/へ保存します。これらと既存のLOCAL_TEST_ACCOUNT.txtは.gitignoreで除外します。除外設定はすでに追跡済みのファイルには効きません。新規のデータファイルは追加前に内容を確認してください。公開漏えい時は削除だけでは足りず、秘密の失効・再発行と履歴への対応が必要です。

## 変更時の運用

1. 作業ブランチで変更し、単体テストと必要な画面テストを実施。
2. git status、git diff、ステージ済み差分を確認し、公開可能なファイルのみを明示してgit add。
3. コミット・push後、mainへマージして公開ワークフローの成功と本番画面を確認。
4. 本番データの操作は開発アカウントと分ける。Gitのブランチを分けるだけでは接続先DBは分離されません。

2026-10-25の公開前検査では、公開候補の既知の秘密パターンの検出はなく、config.jsのキー種別はPublishable keyでした。自動検査はあらゆる秘密・個人情報の検出を保証するものではありません。
