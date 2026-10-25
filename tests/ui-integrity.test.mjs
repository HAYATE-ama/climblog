import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../assets/js/app.js", import.meta.url), "utf8");

test("main navigation has no workspace label and settings contain gym management", () => {
  assert.doesNotMatch(html, /個人用ワークスペース/);
  assert.match(html, /id="settingsTab"[^>]*>⚙/);
  assert.match(html, /id="openGymSettings"/);
  assert.match(html, /id="gymSettingsView"/);
  assert.match(html, /id="exportData"/);
  assert.match(html, /id="signOut"/);
});

test("all static app selectors resolve to unique HTML IDs", () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, "HTML IDs should be unique");
  const missing = [...new Set([...app.matchAll(/querySelector\(["']#([\w-]+)["']\)/g)].map(match => match[1]))].filter(id => !ids.includes(id));
  assert.deepEqual(missing, []);
});

test("routine exercise options are specific and duplicate-free", () => {
  const section = html.match(/<select id="exerciseName">([\s\S]*?)<\/select>/)?.[1] || "";
  const choices = [...section.matchAll(/<option>([^<]+)<\/option>/g)].map(match => match[1]);
  assert.ok(choices.length >= 10);
  assert.equal(new Set(choices).size, choices.length);
  assert.ok(choices.includes("肩・拮抗筋の補強"));
  assert.ok(choices.includes("ムーブ練習"));
});

test("max training form includes the ground lift and left/right hand choices", () => {
  assert.match(html, /value="singleHandLift">片手リフト（地面から）/);
  assert.match(html, /id="liftHand"[\s\S]*value="right"[\s\S]*value="left"/);
  assert.match(app, /maxType==='singleHandLift'\?'片手リフト（地面から）'/);
});


test("mobile main navigation is explicit, delegated, and returns to the top", () => {
  assert.match(html, /id="mainNavigation"/);
  for (const view of ["home", "calendar", "stats"]) assert.match(html, new RegExp('data-view="' + view + '"'));
  assert.match(app, /#mainNavigation[\s\S]*window\.scrollTo\(0,0\)/);
  assert.match(html, /\[hidden\]\{display:none!important\}/);
});

test("past records use the detail viewer for edit and confirmed deletion", () => {
 const viewer=fs.readFileSync(new URL('../assets/js/record-viewer.mjs',import.meta.url),'utf8');
 assert.match(app,/class="session compactRecord"/);assert.match(viewer,/data-viewer-action="edit"/);assert.match(viewer,/data-viewer-action="delete"/);assert.match(app,/ゴミ箱/);assert.match(app,/applyAccountPatch\(moveToTrash/);
});

test("retired task management has no visible navigation, fields or save handlers", () => {
  assert.doesNotMatch(html, /projectsTab|projectsView|gymProjectId|outdoorProjectId|value="project"/);
  assert.doesNotMatch(app, /fillProjectOptions|renderProjects|showProjectsView|saveProject/);
});
