import test from 'node:test';
import assert from 'node:assert/strict';
import {coachOutcomeMessage} from '../assets/js/coach-goal.mjs';
import {proposalSchema,coachInstructions} from '../supabase/functions/ai-coach/proposal-schema.mjs';
test('clarification and rest never claim a course was created',()=>{assert.match(coachOutcomeMessage({draft:{decision:'clarify',items:[]}}),/まだ作成されていません/);assert.match(coachOutcomeMessage({draft:{decision:'rest',items:[]}}),/作成していません/);assert.match(coachOutcomeMessage({draft:{decision:'train',items:[{},{}]}}),/2種目/);assert.match(coachOutcomeMessage(null),/確認できません/);});
test('Gemini schema requires goal metadata and instructions discourage unnecessary clarification',()=>{assert.ok(proposalSchema.required.includes('program'));assert.ok(proposalSchema.required.includes('questions'));assert.ok(coachInstructions.includes('継続方針と今日の実行可能なコースを同じ回答で返す'));assert.ok(coachInstructions.includes('安全上または目的との矛盾'));});
