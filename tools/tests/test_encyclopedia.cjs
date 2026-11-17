const test=require('node:test');
const assert=require('node:assert/strict');
const api=require('../../encyclopedia.js');
const entry={id:'secret_id',kind:'creature',stage:'juvenile',status:'review_required',basic:{name_zh:'秘密幼獸',appearance:'基本外觀'},details:{ecology:'秘密生態'},sources:[{id:'private_source'}],assets:{model:'private_source'}};
test('unknown projection cannot leak names, details, references or media',()=>{
 const projected=api.project(entry,'unknown');assert.equal(projected.basic.name_zh,'？？？');
 for(const key of ['id','stage','details','sources','assets','status'])assert.equal(projected[key],undefined);
 assert.deepEqual(api.filter([entry],'creature','秘密','unknown'),[]);
 assert.deepEqual(api.visibleValues({secret_id:[{value:99}]},entry,'unknown'),[]);
});
test('basic projection hides detailed lore and values, complete keeps lore',()=>{
 assert.equal(api.project(entry,'basic').details,undefined);
 assert.deepEqual(api.visibleValues({secret_id:[{value:99}]},entry,'basic'),[]);
 assert.equal(api.project(entry,'complete').details.ecology,'秘密生態');
 assert.equal(api.project(entry,'complete').sources,undefined);
 assert.equal(api.project(entry,'author').sources[0].id,'private_source');
});
test('projections and values never mutate shared author data',()=>{
 const projected=api.project(entry,'author');projected.details.ecology='changed';assert.equal(entry.details.ecology,'秘密生態');
 const values={secret_id:[{value:9}]};api.visibleValues(values,entry,'complete')[0].value=1;assert.equal(values.secret_id[0].value,9);
 assert.throws(()=>api.project(entry,'invalid'));
});
