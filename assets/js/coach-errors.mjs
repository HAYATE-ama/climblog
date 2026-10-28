// Fixed codes only. Never expose provider text, request bodies, tokens or stack traces.
export const coachErrors={
 GENERATION_FAILED:'前回の生成に失敗しました。旧バージョンの記録には詳細な原因が残っていません。',
 PROVIDER_BAD_REQUEST:'Googleが送信形式を受け付けませんでした（PROVIDER_BAD_REQUEST）。関数の実装を確認する必要があります。',
 PROVIDER_NOT_FOUND:'指定したGeminiモデルまたはAPIが見つかりません（PROVIDER_NOT_FOUND）。',
 PROVIDER_ERROR:'Googleへの要求がエラーになりました（PROVIDER_ERROR）。',
 PROVIDER_UNAVAILABLE:'Google側で一時的な障害が発生しました（PROVIDER_UNAVAILABLE）。自動再試行はしません。',
 PROVIDER_TIMEOUT:'Googleへの接続が時間切れになりました（PROVIDER_TIMEOUT）。',
 PROVIDER_NETWORK:'Googleとの通信に失敗しました（PROVIDER_NETWORK）。',
 INVALID_JSON:'Googleの回答をJSONとして読み取れませんでした（INVALID_JSON）。',
 DRAFT_FORMAT:'回答の項目・形式がアプリの条件を満たしませんでした（DRAFT_FORMAT）。',
 DRAFT_EXERCISE:'回答の種目・順序・セットを確認できませんでした（DRAFT_EXERCISE）。',
 DRAFT_SIDE:'回答の左右指定が不正でした（DRAFT_SIDE）。',
 DRAFT_LOAD:'回答の回数・重量・休憩が条件を超えていました（DRAFT_LOAD）。',
 DRAFT_TIME:'回答の種目時間が短すぎました（DRAFT_TIME）。',
 DRAFT_BUDGET:'回答が利用時間または指トレの準備条件を満たしませんでした（DRAFT_BUDGET）。',
 INVALID_DRAFT:'回答を安全にコースへ変換できませんでした（INVALID_DRAFT）。',
 RESULT_SAVE_FAILED:'生成結果の保存を確認できませんでした（RESULT_SAVE_FAILED）。再生成せず状態を確認してください。'
};
const known=new Set([...Object.keys(coachErrors),'PROVIDER_LIMIT','REFUSAL','INCOMPLETE','CONSENT_CHANGED','PROVIDER_AUTH','MODEL_NOT_ALLOWED']);
const draftErrors=new Map([
 ['提案の形式を確認できません。','DRAFT_FORMAT'],['提案の種目・順序・セットを確認できません。','DRAFT_EXERCISE'],['左右の指定が不正です。','DRAFT_SIDE'],['提案の運動量・重量・休憩が不正です。','DRAFT_LOAD'],['運動の予定時間が短すぎます。','DRAFT_TIME'],['利用時間または準備条件を満たしていません。','DRAFT_BUDGET'],['1日の計画に必要な準備・メイン・整理運動を確認できません。','DRAFT_BUDGET']
]);
export function knownCoachError(code){return known.has(code)?code:'GENERATION_FAILED';}
export function classifyCoachError(error,stage){if(known.has(error?.message))return error.message;if(stage==='validation')return draftErrors.get(error?.message)||'INVALID_DRAFT';return stage==='save'?'RESULT_SAVE_FAILED':'GENERATION_FAILED';}
