import {resolveExercise} from './exercise-registry.mjs';
import {isRecordedLoad} from './training-conditions.mjs';
import {liftMeasurementKind} from './lift-measurement.mjs';

export const pyramidLabels = Object.freeze({
  start: 'ウォームアップ重量', rise: '上り・中間重量', peak: '頂点', fall: '下り・中間重量', finish: 'ウォームアップ重量に戻す'
});

export function pyramidAnchor(rows, stage) {
  const row = rows.find(e => e.step.pyramidStage === stage);
  const set = row?.sets[0];
  return set && isRecordedLoad(set, row.loadMethod) ? set.loadKg : null;
}

// Plan weights only. Actual load and duration are confirmed separately after a set.
export function setPyramidAnchor(plan, side, stage, value) {
  const rows = plan.exercises.filter(e => e.step?.pyramidStage && e.exerciseSide === side);
  if (!['start', 'peak'].includes(stage) || !rows.some(e => e.step.pyramidStage === stage)) {
    throw new Error('設定する手と段階を確認してください。');
  }
  const kg = value === '' ? null : Number(value);
  if (kg !== null && (!Number.isFinite(kg) || kg < 0 || kg > 1000)) throw new Error('重量は0〜1000kgで入力してください。');
  const start = stage === 'start' ? kg : pyramidAnchor(rows, 'start');
  const peak = stage === 'peak' ? kg : pyramidAnchor(rows, 'peak');
  if (start !== null && peak !== null && peak <= start) throw new Error('頂点にはウォームアップより重い重量を入力してください。');
  const mid = start === null || peak === null ? null : Math.min(peak, Math.max(start, Math.round((start + peak) * 5) / 10));
  const weights = {start, rise: mid, peak, fall: mid, finish: start};
  for (const row of rows) {
    const weight = weights[row.step.pyramidStage];
    row.sets = row.sets.map(set => ({...set, loadKg: weight ?? 0, loadRecorded: weight !== null}));
  }
}

export function bestFingerHold(records, exercise, date) {
  const conditions = exercise?.fingerConditions;
  const seconds = exercise?.sets[0]?.target;
  if (!conditions?.edgeDepthMm || !conditions.gripType || exercise.mode !== 'time' || exercise.loadMethod !== 'liftFromGround') return null;
  const side = exercise.exerciseSide;
  let best = null;
  function include(value) {
    if (value === '' || value == null) return;
    const kg = Number(value);
    if (Number.isFinite(kg) && kg >= 0 && kg <= 1000 && (best === null || kg > best)) best = kg;
  }
  for (const record of records) {
    if (record.kind !== 'training' || !record.date || record.date > date) continue;
    const grip = record.fingerConditions?.gripType ?? record.gripType;
    const edge = record.fingerConditions?.edgeDepthMm ?? record.edgeDepthMm;
    if (grip !== conditions.gripType || Number(edge) !== conditions.edgeDepthMm) continue;
    if (record.trainingMode === 'maxTest') {
      if (record.maxType === 'singleHandLift' && (!record.loadMethod || record.loadMethod === 'liftFromGround') && record.liftHand === (side === '左' ? 'left' : 'right') &&
          liftMeasurementKind(record) === 'hold' && Number(record.holdSeconds) === seconds && record.loadRecorded !== false) include(record.addedWeightKg);
      continue;
    }
    if (record.trainingMode !== 'routine' || record.loadMethod !== 'liftFromGround') continue;
    const identity = resolveExercise(record.exerciseName);
    if ((record.catalogExerciseId || identity?.definition.exerciseId) !== exercise.catalogExerciseId ||
        (record.exerciseSide || identity?.side) !== side) continue;
    if (record.sessionSetResults?.length) {
      for (const set of record.sessionSetResults) {
        if (set.status === 'completed' && set.mode === 'time' && Number(set.actual) === seconds &&
            set.confirmed !== false && (!record.course || set.confirmed === true) && set.observation?.outcome !== 'failed' &&
            isRecordedLoad(set, record.loadMethod)) include(set.loadKg);
      }
    } else if (record.recordSource !== 'timer' && !record.course) {
      for (const set of record.setDetails || []) {
        if (Number(set.holdSeconds) === seconds && isRecordedLoad(set, record.loadMethod)) include(set.loadKg);
      }
    }
  }
  return best;
}
