import test from 'node:test';
import assert from 'node:assert/strict';
import {Monitor,POLICY,explainConfidence} from '../dist/engine.mjs';
import {sample} from '../dist/scenarios.mjs';
import {sealReport,verifyReport} from '../dist/audit.mjs';
function replay(id='multi',end=71){const m=new Monitor();for(let t=0;t<=end;t++)m.ingest(sample(id,t));return m;}
function feed(m,id,start,end){for(let t=start;t<=end;t++)m.ingest(sample(id,t));}

test('Pending review survives stream loss, with NO DATA independently visible',()=>{
  const m=replay(),id=m.latest.episode.id;m.tick(110);
  assert.equal(m.latest.state,'NO DATA');assert.equal(m.latest.observationState,'NO DATA');
  assert.equal(m.latest.reviewState,'REVIEW REQUESTED');assert.equal(m.latest.episode.id,id);
  assert.equal(m.latest.episode.timedOut,true);assert.equal(m.latest.confidence,0);
  assert.equal(m.events.filter(e=>e.type==='timeout').length,1);m.tick(120);
  assert.equal(m.events.filter(e=>e.type==='timeout').length,1);
});
test('Confirmed concern survives stream loss without suggesting current signal knowledge',()=>{
  const m=replay();m.review(m.latest.episode.id,'confirm','Observed in simulation');m.tick(80);
  assert.equal(m.latest.state,'NO DATA');assert.equal(m.latest.reviewState,'HIGH PRIORITY');
  assert.deepEqual(m.latest.scoreRange,[0,100]);
});
test('Resolved episode re-arms only after ten fresh seconds of reliable recovery',()=>{
  const m=replay();m.review(m.latest.episode.id,'confirm','Observed in simulation');
  feed(m,'exercise',72,79);assert.equal(m.latest.episode.status,'confirmed');
  feed(m,'exercise',80,145);assert.equal(m.latest.episode,null);
  assert.equal(m.events.filter(e=>e.type==='recovery').length,1);
});
test('A decision on recovered data is not immediately cleared by prior recovery',()=>{
  const m=replay('multi',179);assert.equal(m.latest.episode.status,'pending');
  m.review(m.latest.episode.id,'confirm','Review old evidence');assert.equal(m.latest.reviewState,'HIGH PRIORITY');
  feed(m,'exercise',180,189);assert.equal(m.latest.episode.status,'confirmed');
  m.ingest(sample('exercise',190));assert.equal(m.latest.episode,null);
});
test('Duplicate human actions and invalid notes do not alter any state or event',()=>{
  const m=replay(),id=m.latest.episode.id,before=m.report();
  for(const [action,note] of [['invalid','valid note'],['confirm',''],['dismiss','x'.repeat(501)]])assert.throws(()=>m.review(id,action,note));
  assert.deepEqual(m.report(),before);
  m.review(id,'dismiss','Sensor inspection requested');const resolved=m.report();
  assert.throws(()=>m.review(id,'confirm','Duplicate decision'));assert.deepEqual(m.report(),resolved);
});
test('Dismissal latches the episode: continued anomaly cannot generate duplicate reviews',()=>{
  const m=replay();m.review(m.latest.episode.id,'dismiss','Synthetic artifact');feed(m,'multi',72,125);
  assert.equal(m.events.filter(e=>e.type==='review').length,1);assert.equal(m.latest.reviewState,'DISMISSED');
});
test('A new episode can request review after recovery',()=>{
  const m=replay(),first=m.latest.episode.id;m.review(first,'dismiss','Synthetic artifact');feed(m,'multi',72,179);
  for(let t=180;t<220;t++){const f=sample('multi',90+t-180);f.t=t;m.ingest(f);}
  assert.notEqual(m.latest.episode.id,first);assert.equal(m.latest.episode.status,'pending');
  assert.equal(m.events.filter(e=>e.type==='review').length,2);
});
test('Previously emitted events and snapshots remain unchanged after timeout and review',()=>{
  const m=replay(),events=m.events,encoded=JSON.stringify(events),snapshot=m.latest;
  m.tick(110);m.review(m.latest.episode.id,'confirm','Delayed review');
  assert.equal(JSON.stringify(events),encoded);assert.equal(snapshot.episode.status,'pending');
  assert.equal(m.events.find(e=>e.type==='review').status,'pending');
  assert.equal(snapshot.episode.timedOut,undefined);
});
test('Nested event evidence, baseline, snapshots and event list resist caller mutation',()=>{
  const m=replay(),e=m.events.find(e=>e.type==='review');
  assert.throws(()=>{e.evidence.hr.contribution=999;},TypeError);
  assert.throws(()=>{m.latest.episode.status='confirmed';},TypeError);
  assert.throws(()=>{m.events.length=0;},TypeError);
  assert.throws(()=>{m.baseline.hr.center=999;},TypeError);
  assert.throws(()=>{POLICY.weights.hr=100;},TypeError);
  const report=m.report();report.events.length=0;assert.ok(m.events.length>0);
});
test('Duplicate, out-of-order and malformed frames cannot replace accepted evidence',()=>{
  const m=replay('exercise',30),values=m.latest.values;
  for(const f of [sample('multi',30),sample('multi',29),{t:NaN},null,{t:1000}])m.ingest(f,30);
  assert.equal(m.lastT,30);assert.deepEqual(m.latest.values,values);
  assert.equal(m.events.filter(e=>e.type==='rejected').length,5);
  assert.ok(m.events.every((e,i)=>i===0||e.t>=m.events[i-1].t));
});
test('Clock ticks and rejected frames cannot complete the persistence gate',()=>{
  const m=replay('multi',65);const count=m.events.filter(e=>e.type==='review').length;
  for(let t=65;t<69;t+=0.1)m.tick(t);
  assert.equal(m.events.filter(e=>e.type==='review').length,count);
});
test('Sample gaps reset the sustained-evidence timer',()=>{
  const m=replay('multi',63);m.ingest(sample('multi',65));assert.equal(m.latest.persistence,0);
  feed(m,'multi',66,72);assert.equal(m.latest.episode,null);
  m.ingest(sample('multi',73));assert.equal(m.latest.episode.status,'pending');
});
test('Bad inputs abstain without NaN scores',()=>{
  const m=replay('exercise',30),f=sample('exercise',31);f.hr.value=NaN;f.spo2.value=200;f.rr.quality=Infinity;delete f.activity;
  m.ingest(f);assert.equal(m.latest.valid.length,0);assert.equal(m.latest.confidence,0);
  assert.deepEqual(m.latest.scoreRange,[0,100]);assert.equal(m.latest.state,'SENSOR CHECK');
});
test('Confidence formula is transparent, monotonic within the acceptance region and context bounded',()=>{
  const q={hr:.98,spo2:.98,rr:.97,activity:.99};assert.equal(explainConfidence(q,true).value,.98);
  const missing=explainConfidence({...q,spo2:0},true);assert.equal(missing.value,.735);
  assert.equal(explainConfidence(q,false).value,.49);assert.equal(explainConfidence(q,true,true).value,0);
  assert.ok(explainConfidence({...q,activity:0},true).value<=.5);
  let previous=0;for(let v=.65;v<=1;v+=.01){const next=explainConfidence({...q,hr:v},true).value;assert.ok(next>=previous);previous=next;}
});
test('SHA-256 seal detects changes, deletions, reordering and wrong external digest',async()=>{
  const seal=await sealReport(replay().report());assert.equal(await verifyReport(seal),true);
  for(const edit of [r=>{r.payload.events[0].detail='modified';},r=>{r.payload.events.pop();},r=>{r.payload.events.reverse();},r=>{r.payload.latest.score=0;}]){
    const copy=structuredClone(seal);edit(copy);assert.equal(await verifyReport(copy),false);
  }
  assert.equal(await verifyReport(seal,'0'.repeat(64)),false);
});
test('Reliable oxygen corroboration vetoes misleading activity discount',()=>{
  const m=new Monitor();for(let t=0;t<=100;t++){const f=sample('multi',t);if(t>=45)f.activity.value=.85;m.ingest(f);}
  assert.equal(m.latest.episode.status,'pending');assert.equal(m.latest.features.hr.context,1);
  assert.match(m.latest.features.hr.reason,/vetoes/);
});
test('Frozen-signal test measures elapsed seconds, not only frame count',()=>{
  const m=new Monitor();for(let i=0;i<25;i++){const f=sample('exercise',0);f.t=i/10;m.ingest(f);}
  assert.ok(m.latest.valid.includes('hr'));
  const n=new Monitor();for(let t=0;t<=20;t++){const f=sample('exercise',0);f.t=t;n.ingest(f);}
  assert.equal(n.latest.valid.includes('hr'),false);assert.ok(n.latest.issues.some(s=>s.includes('flatline')));
});
