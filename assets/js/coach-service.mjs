// Deliberately no fetch, SDK, API key, or remote adapter in this release.
export const coachCapabilities=Object.freeze({status:'development',canGenerate:false,canSendData:false,canSavePlan:false});
export class CoachUnavailableError extends Error{constructor(){super('AIコーチは開発中です。メニュー生成と外部送信はまだ利用できません。');this.name='CoachUnavailableError';this.code='COACH_IN_DEVELOPMENT';}}
export const coachService=Object.freeze({capabilities:coachCapabilities,async generate(){throw new CoachUnavailableError();}});
