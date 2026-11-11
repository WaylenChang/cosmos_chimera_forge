// Freeze the current Forge template and the downloaded, authoritative concept packs.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const ctx = { window: {} };
vm.createContext(ctx);
for (const file of ['catalog.js', 'designed.js', 'tasks.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx);
const task = ctx.window.COSMI_TASKS.find(x => x.id === 'creature-model-rig');
const out = path.join(root, 'Art/_incoming/starter_blender_20261111');
fs.mkdirSync(path.join(out, 'prompts'), { recursive: true });
const jobs = [];
for (const [family, seed, driveId] of [['sun','a111','1_WA6pY668B5_ROi-0OUcJ_eOgLo1g98m'],['moon','b111','13BytwA_2hxEsHLzVUt0isHsGLW9awnet'],['star','c111','1zt8vyP56OePf-t-LbLkg9nCcbxyiXib8']]) {
  const pack = `cr-20261111-${seed}-1200`;
  const source = path.join(root, 'Art/_incoming/starter_sources', pack);
  const concept = JSON.parse(fs.readFileSync(path.join(source, 'concept.json'), 'utf8'));
  for (const [index, stage] of concept.locked.stages.entries()) {
    const taskId = `mdl-20261111-${seed}-${String(1300 + index).padStart(4,'0')}`;
    const actions = ctx.window.COSMI_CATALOG.ACTIONS.creature.filter(a => stage.stage === 'juvenile' || a.id !== 'hatch');
    const header = `[COSMIMERA-TASK spec=1 tool=2.5.0 catalog=${ctx.window.COSMI_CATALOG.version} template=${task.id}@${task.version} task_id=${taskId} seed=${seed}]`;
    const prompt = task.build({ task, taskId, subjectId: concept.line_id, concept, header, platform:'gemini', platformName:'Codex / Blender 5.2.2 LTS', opts:{ scope:'single', source_pack:pack, stage:stage.stage, actions_creature: actions.map(a=>a.id) }, notes:'依序執行日／月／星四型態。直接以本次立繪建立全新三維幾何；以 Blender Python 建模、綁骨與製作動畫。精確記錄視覺差異及未通過的驗收項目。此來源包包含四型態，四型態皆驗證交付後才移至 image_backup。' });
    fs.writeFileSync(path.join(out,'prompts',`${taskId}.prompt.md`), prompt);
    const sizes = {S:[5000,8000,1024],M:[8000,15000,1024],L:[15000,25000,2048],XL:[25000,35000,2048]};
    jobs.push({family,index,stage:stage.stage,stage_data:stage,subject_id:concept.line_id,source_pack:pack,source_dir:source,source_drive_id:driveId,task_id:taskId,header,actions,size:sizes[stage.size_class],dimension_m:parseFloat(stage.height_length),output:path.join(out,taskId),prompt:path.join(out,'prompts',`${taskId}.prompt.md`)});
  }
}
fs.writeFileSync(path.join(out,'jobs.json'),JSON.stringify(jobs,null,2));
console.log(`${jobs.length} stage prompts and jobs: ${out}`);
