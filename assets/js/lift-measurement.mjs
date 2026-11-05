// Unlabelled historical tests stay unspecified; no automatic conversion to an instantaneous test.
export function liftMeasurementKind(record){
 if(record.liftMeasurement==='instant')return 'instant';
 if(record.liftMeasurement==='hold')return 'hold';
 return Number(record.holdSeconds)>0?'hold':'unspecified';
}
export function liftMeasurementLabel(record){const kind=liftMeasurementKind(record);return kind==='instant'?'瞬間挙上':kind==='hold'?(Number(record.holdSeconds)>0?record.holdSeconds+'秒保持':'保持時間未設定'):'旧記録・測定条件未設定';}
export function liftMeasurementKey(record){const kind=liftMeasurementKind(record);return kind==='hold'?'hold:'+(Number(record.holdSeconds)>0?record.holdSeconds:'unknown'):kind;}
