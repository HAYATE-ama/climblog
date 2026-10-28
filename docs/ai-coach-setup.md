# AIコーチの接続準備と運用

AIキーなしでも通常の記録・メニュー・タイマーを使用できます。AIコーチは初期状態でオフです。未接続時の条件保存は端末内だけです。架空のAI提案を本番に表示する機能はありません。

## 初回に必要な作業

GitHub Pagesだけでは秘密キーを保管してAIを呼び出せません。Supabase Edge Functionを呼び出す構成です。初回は下記1〜4を行い、その後はサーバーのキー登録と画面での有効化で利用できます。今回の開発では本番DB・関数・Secretsは操作していません。

1. SupabaseのSQL Editorで `supabase/migrations/202610280001_ai_coach.sql` の内容を実行します。既存の `user_app_state` は変更しません。ai_coach_settings / ai_coach_requests / ai_coach_adoptions の3テーブルと専用関数・RLSを追加します。初回用SQLです。再実行時は既存ポリシーの重複に注意してください。
2. Supabase Authentication → Usersで自分のユーザーUIDを確認します。メールアドレスではなくUUIDです。
3. SupabaseのEdge Functions → Secretsで以下を登録します。**秘密キーをconfig.js、ブラウザー、GitHub、チャットへ入れないでください。**

| 設定名 | 値 |
|---|---|
| OPENAI_API_KEY | 自分で取得したAPIキー。キーがない間は未登録 |
| AI_ALLOWED_USER_IDS | 利用を許す自分のユーザーUID。複数ならカンマ区切り |
| OPENAI_MODEL | 任意。省略時 gpt-5.4-mini。Responses/Structured Outputs/low reasoning対応モデルを指定 |
| AI_DAILY_LIMIT | 任意。1ユーザー1日2回、最大5回 |
| AI_MONTHLY_LIMIT | 任意。1ユーザー月30回、最大100回 |
| AI_GLOBAL_MONTHLY_LIMIT | 任意。サーバー全体月30回、最大1000回 |
| AI_ALLOWED_ORIGINS | 開発時のみ任意。localhostの完全なoriginをカンマ区切り。本番originはコードで許可 |

SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEYはEdge Function側の組み込み環境変数を使用します。service_roleはブラウザーへ渡しません。キーの値をエージェント専用ファイルから読み出す必要はありません。本人がDashboardへ入力してください。

4. Supabase CLIを使い、**リポジトリ直下から**以下を実行します。PROJECT_REFは自分のSupabaseプロジェクトIDに置き換えます。共有する種目定義も一緒に束ねるため、index.tsだけをDashboardへ貼り付ける方法は使いません。

```powershell
npx supabase login
npx supabase functions deploy ai-coach --project-ref PROJECT_REF
```

`supabase/config.toml`でJWT検証を有効にしています。関数内でもAuthサーバーにBearerを検証し、許可UIDに限定します。認証エラー時はプロジェクトのJWT設定とCLIの配置結果を確認してください。検証を無条件に外して対処しないでください。GitHub Pagesの再配置は関数を配置しません。

5. アプリでログインし、AIコーチ → 状態を確認 → 今日の条件・AI設定を開きます。時間、器具、痛み・疲労、送信範囲を確認し、同意とAI利用をオンにして保存します。「今日のコースを生成」で初回確認します。以後、有効な状態でその日の画面を初めて開くと生成します。
6. 提案 → このコースを確認・開始 → 必要に応じて種目・セットを編集 → 開始 → 完了後カレンダーへ保存、の順です。生成や開始だけでは実施記録は増えません。いつものメニューとして保存する既存操作も利用できます。

## 費用とデータの扱い

- サーバーが日付（日本時間）と本人のクラウド記録から入力を作ります。端末から送られたuserId、モデル指定、過去データは採用しません。未同期の記録は次回生成まで反映されません。
- 同日分は別端末からも再利用。再生成だけ追加料金を使います。失敗・中断も回数上限に含め、自動で再試行しません。処理中は「状態を確認」で確認してください。2分以上中断した試行は次回生成要求時に失敗扱いになります。
- 初期の共有範囲はすべてオフ。目的・時間・場所・器具・候補種目は常に送信し、履歴の数値集計、身体情報、目標、選択した状態は個別の同意がある場合だけ送ります。記録メモやメールは送りません。目標欄に個人情報を書いた場合は目標共有をオフにしてください。
- 体調不明なら軽い候補に限定。痛み・強い疲労ならAI通信せず休養表示。最大出力・高負荷指トレ・自動増量は提案しません。運動の適否を診断するものではありません。
- AIの自由な種目名は受け付けず、登録済みの安定ID、器具、左右、回数、秒数、休憩、時間内の総量を検証。不正な提案は表示せず失敗にします。
- 1要求の出力は最大4000トークン。回数上限はSQL内の予約処理で並行要求にも適用します。これはドル単位の完全な請求上限ではありません。OpenAI側でも支払い・利用通知を管理してください。
- 元の提案、入力のハッシュ、設定、モデル、取得できたトークン使用量をサーバーへ保存。入力本文のコピーは保存しません。取得できない使用量は不明（NULL）で、ゼロと推測しません。OpenAIリクエストはstore:falseです。
- コース開始時の編集済みプランを採用履歴へ保存します。通信失敗時はアカウント別の端末キューから再送します。実施記録にも提案IDと編集有無を保持します。端末データ消去前には同期を確認してください。
- AIをオフにすると新規生成を停止します。保存済みの提案・採用履歴の削除機能は今回含めません。本人の記録としてRLSで保護されます。

## 配置後の確認（自分のテストアカウントで）

未ログイン拒否／許可UID以外拒否／AIオフ時に生成なし／初回生成／再読み込みで同じ提案／再生成の確認／日・月上限／オフへの変更／痛みで休養／編集・開始・実施保存／二重保存なし、を確認します。少量の実API料金がかかります。

開発時は実キーなしで220件以上の単体テストとPC・スマホ幅のChrome画面テストを実施します。実API、実DBのSQL実行、Denoでの配置・バンドル、iPhone実機はこのローカル検証で確認できません。初回配置時に確認が必要です。

参照：[Responses Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)、[モデル](https://developers.openai.com/api/docs/models/gpt-5.4-mini)、[Supabase関数の配置](https://supabase.com/docs/guides/functions/deploy)、[Secrets](https://supabase.com/docs/guides/functions/secrets)、[本人認証](https://supabase.com/docs/guides/functions/auth)。
