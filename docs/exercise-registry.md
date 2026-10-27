# 種目マスターとAIの土台

画面を増やさず、種目を共通の定義から参照するように整理しました。外部AIの接続・送信・提案生成・自動保存は有効にしていません。

## 現在の整備状況

標準の選択項目55件と旧AI契約専用の「整理運動」1件、計56定義。足補助ハング2種を追加（マスターバージョン2）。動作説明がある23種目を提案候補として扱います。状態別：説明あり・提案候補 23件、動作説明の整備待ち 5件、動作の特定が必要 22件、負荷条件の確認が必要 6件。候補であることは、医学的な安全性や個人に適した負荷の認定を意味しません。

## 共通情報

- exerciseId：表示名と独立した安定ID。既存の最大測定やタイマー内のインスタンスIDとは別です。
- name：保存互換用名称。displayName：画面上の一般名。aliases：同じ動作の別名のみ。大分類と具体的動作は勝手に同一視しません。
- groupId/category：既存プルダウンと用途分類。defaultMode：初期の秒数/回数（動作未特定なら未指定）であり、手動記録の別モードを禁止しません。
- sidedness：separateSides=左右別、alternatingPair=左右交互を1組、both=左右同時、unspecified=動作未特定。
- requiredEquipment/optionalEquipment：必須/任意の器具。未特定項目はequipmentKnown=false。バンドの固定点をバンド本体と区別します。
- phases：準備/主運動/整理運動。stretchType：静的/動的。loadBasis：体重＋追加荷重、外部重量のみ、バンド、自重、負荷なし、未特定。
- guide：一言説明、数え方、3段階の手順、注意点、参考先。動作図はexercise-illustrations.mjsから同じ種目IDで参照します。
- readiness/aiDraftEligible：説明の不足や動作の曖昧さ、負荷条件の検討が必要な種目を分離。未知の自作種目の説明は推測しません。

## ファイルの責務

- assets/js/exercise-registry.mjs：名称・ID・分類・器具・左右などの正本。
- assets/js/exercise-guide-data.mjs：再利用する既存の動作説明と出典。exercise-guides.mjsはその表示。
- exercise-catalog.mjs：共通マスターから入力選択肢を作成。名称と並びは保持。
- climbing-courses.mjs：共通マスターから種目IDと器具条件を取得し、モードの不一致を検出。
- exercise-history.mjs：別名を同じIDに寄せた端末内集計。左右・回数/時間/mixedは分離。
- coach-foundation.mjs：候補抽出→v2提案構造の検証→既存の編集可能なタイマー形式への変換。通信・保存・開始はしません。

## 既存記録の互換性

過去の記録を一括書き換えません。保存名・実績・ID・身体情報・日付を保持し、既知の種目を新規保存/編集する際にcatalogExerciseId、exerciseSide、exerciseRegistryVersionを任意項目として付けます。未知の名前へ編集した場合は古い種目IDを外します。自作種目は既存の自作種目ID/名前/モードを維持します。メニューの各種目idと、安定したcatalogExerciseIdは混同しません。クラウドは既存JSONに含まれ、DBのDDLや一括移行は不要です。

## AI接続前のローカル検証

buildCoachCandidatesは説明済みの具体的種目だけを返し、必須器具の不足やフェーズ不一致を除きます。静的ストレッチは主に整理運動として分類し、動的ウォームアップと分けます。現段階では指・加重系などの負荷検討が必要なものは自動提案候補にしません。
validateCoachDraftはschemaVersion=2を検証し、未知ID、曖昧な大分類、器具不足、左右欠落/不一致、重複ID、フェーズ順序、予定時間超過、不正な数値を拒否。重量は0のみ、軽いクライミングは1回=準備一式の手動完了として扱います。回数式の予定時間は見積値で、実行時間を保証しません。
coachDraftToWorkoutPlanは検証したデータから名称をマスターで組み立て、既存タイマーの設定に変換します。自動開始や実施済み記録の作成は行いません。
旧coachSchemaVersion=1とvalidateCoachPlanは旧構造契約の互換用に維持し、新規接続には使用しません。サーバー側の再検証・送信同意・本人認証・費用制御・個別の負荷判断は未実装です。

## 種目一覧

| 種目ID | 保存互換名 | 初期方式 | 左右 | 必須器具 | 状態 |
|---|---|---|---|---|---|
| hangboard | ハングボード（通常） | 秒数 | both | ハングボード | 負荷条件の確認が必要 |
| weightedPullup | 加重懸垂（通常） | 回数 | both | 懸垂バー・錘 | 負荷条件の確認が必要 |
| bodyweightPullup | 自重懸垂 | 回数 | both | 懸垂バー | 説明あり・提案候補 |
| campusBoard | キャンパスボード | 回数 | both | キャンパスボード | 負荷条件の確認が必要 |
| core | 体幹トレーニング | 未指定 | unspecified | 未確定 | 動作の特定が必要 |
| antagonist | 肩・拮抗筋の補強 | 未指定 | unspecified | 未確定 | 動作の特定が必要 |
| endurance | クライミング持久力 | 未指定 | unspecified | クライミングウォール | 動作の特定が必要 |
| cardio | 有酸素トレーニング | 未指定 | unspecified | 未確定 | 動作の特定が必要 |
| mobility | 柔軟・モビリティ | 未指定 | unspecified | 未確定 | 動作の特定が必要 |
| movementPractice | ムーブ練習 | 未指定 | unspecified | クライミングウォール | 動作の特定が必要 |
| fullBodyStrength | 全身筋力トレーニング | 未指定 | unspecified | 未確定 | 動作の特定が必要 |
| singleHandLift | 片手リフト（地面から） | 回数 | separateSides | 錘・片手リフト用エッジ・持ち手 | 負荷条件の確認が必要 |
| frontPlank | プランク | 秒数 | both | なし | 説明あり・提案候補 |
| sidePlank | サイドプランク | 秒数 | separateSides | なし | 説明あり・提案候補 |
| squat | スクワット | 回数 | both | なし | 動作説明の整備待ち |
| lunge | ランジ | 回数 | separateSides | なし | 動作説明の整備待ち |
| pushup | 腕立て伏せ | 回数 | both | なし | 説明あり・提案候補 |
| gluteBridge | ヒップリフト | 回数 | both | なし | 説明あり・提案候補 |
| other | その他 | 回数 | unspecified | 未確定 | 動作の特定が必要 |
| hamstringStretch | ハムストリングのストレッチ | 秒数 | unspecified | 未確定 | 動作の特定が必要 |
| hipStretch | 股関節のストレッチ | 秒数 | unspecified | 未確定 | 動作の特定が必要 |
| adductorStretch | 内転筋のストレッチ | 秒数 | unspecified | 未確定 | 動作の特定が必要 |
| gluteStretch | 臀部のストレッチ | 秒数 | unspecified | 未確定 | 動作の特定が必要 |
| calfStretchGeneral | ふくらはぎのストレッチ | 秒数 | unspecified | 未確定 | 動作の特定が必要 |
| shoulderChestStretch | 肩・胸のストレッチ | 秒数 | unspecified | 未確定 | 動作の特定が必要 |
| latStretch | 広背筋のストレッチ | 秒数 | unspecified | 未確定 | 動作の特定が必要 |
| forearmStretch | 前腕・手首のストレッチ | 秒数 | unspecified | 未確定 | 動作の特定が必要 |
| ankleMobility | 足首のモビリティ | 秒数 | unspecified | 未確定 | 動作の特定が必要 |
| thoracicMobility | 胸椎のモビリティ | 秒数 | unspecified | 未確定 | 動作の特定が必要 |
| birdDog | バードドッグ | 回数 | alternatingPair | なし | 説明あり・提案候補 |
| hipFlexorStretch | 片膝立ちの股関節前面ストレッチ | 秒数 | separateSides | なし | 説明あり・提案候補 |
| butterflyStretch | バタフライストレッチ（合せき） | 秒数 | both | なし | 説明あり・提案候補 |
| figureFourStretch | 仰向けフィギュアフォー | 秒数 | separateSides | なし | 説明あり・提案候補 |
| calfStretch | カーフストレッチ | 秒数 | separateSides | 支えになる壁 | 説明あり・提案候補 |
| doorwayChestStretch | ドアウェイ・チェストストレッチ | 秒数 | separateSides | 戸口 | 説明あり・提案候補 |
| childPose | チャイルドポーズ | 秒数 | both | なし | 説明あり・提案候補 |
| openBook | オープンブック | 回数 | separateSides | なし | 説明あり・提案候補 |
| wristFlexorStretch | 手首の屈筋ストレッチ | 秒数 | separateSides | なし | 説明あり・提案候補 |
| wristExtensorStretch | 手首の伸筋ストレッチ | 秒数 | separateSides | なし | 説明あり・提案候補 |
| marchInPlace | その場足踏み | 秒数 | both | なし | 説明あり・提案候補 |
| armCircles | アームサークル | 秒数 | both | なし | 説明あり・提案候補 |
| legSwing | レッグスイング | 回数 | separateSides | 支えになる壁 | 説明あり・提案候補 |
| wristCircles | 手首回し | 秒数 | both | なし | 説明あり・提案候補 |
| generalWarmup | ウォームアップ（全身） | 未指定 | unspecified | 未確定 | 動作の特定が必要 |
| scapularWarmup | 肩甲骨のウォームアップ | 未指定 | unspecified | 未確定 | 動作の特定が必要 |
| fingerWristWarmup | 指・手首のウォームアップ | 未指定 | unspecified | 未確定 | 動作の特定が必要 |
| easyClimbing | 軽いクライミング | 回数 | both | クライミングウォール | 説明あり・提案候補 |
| bandPullApart | バンドプルアパート | 回数 | both | トレーニングバンド | 説明あり・提案候補 |
| bandExternalRotation | バンド外旋（肩） | 回数 | both | トレーニングバンド | 説明あり・提案候補 |
| bandInternalRotation | バンド内旋（肩） | 回数 | both | トレーニングバンド | 動作説明の整備待ち |
| bandRow | バンドロー | 回数 | both | トレーニングバンド・バンドの安定した固定点 | 説明あり・提案候補 |
| bandFacePull | バンドフェイスプル | 回数 | both | トレーニングバンド・バンドの安定した固定点 | 動作説明の整備待ち |
| bandPressdown | バンドプレスダウン | 回数 | both | トレーニングバンド・バンドの安定した固定点 | 動作説明の整備待ち |
| cooldown | 整理運動 | 未指定 | unspecified | 未確定 | 動作の特定が必要 |

## 検証

種目の一意性・名称互換・器具・左右・回数/秒・候補の除外・メニュー/バックアップ/実績保存・個人文言を含まない集計・無効な提案の拒否を単体テストで確認。既存のコース、独自種目、閲覧/編集、AI開発中画面、タイマー音、PWAをPC/スマホ幅と両テーマで確認します。単体テスト139件と上記ブラウザテストが成功しました。AI品質やiPhone実機の検証は含みません。

指トレの手動コースとガイド・図については [指トレコース](finger-courses.md) を参照。説明と図は25種、AI提案可能な説明済み種目は23種。
