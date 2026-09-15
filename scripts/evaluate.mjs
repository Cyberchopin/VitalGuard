import {mkdir,writeFile} from 'node:fs/promises';
import {Monitor,CHANNELS,POLICY,explainConfidence} from '../dist/engine.mjs';
import {SCENARIOS,sample} from '../dist/scenarios.mjs';

// Development cohorts with fixed seeds; not a held-out validation set.
function random(seed){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
const groups=[
  {name:'scripted',seeds:1},
  {name:'noise_and_baseline_offsets',seeds:50},
  {name:'intermittent_loss_5pct',seeds:50},
  {name:'persistent_loss_45_to_140',seeds:20},
  {name:'incorrect_activity_context',seeds:20},
  {name:'incorrect_activity_and_oxygen',seeds:20}
];
function run(group,id,seed){
  const rng=random(seed),m=new Monitor(),positive=['multi','drift'].includes(id);
  const offset={hr:(rng()-.5)*20,spo2:(rng()-.5),rr:(rng()-.5)*4,activity:0};
  let abstained=0;
  const faultWindow={noDataFrames:0,sensorCheckFrames:0,monitoringFrames:0,watchFrames:0,zeroConfidenceFrames:0,highConfidenceFrames:0,firstNoData:null};
  function observe(s,t){
    if(t<45||t>140)return;
    if(s.observationState==='NO DATA'){faultWindow.noDataFrames++;faultWindow.firstNoData??=t;}
    if(s.observationState==='SENSOR CHECK')faultWindow.sensorCheckFrames++;
    if(s.observationState==='MONITORING')faultWindow.monitoringFrames++;
    if(s.observationState==='WATCH')faultWindow.watchFrames++;
    if(s.confidence===0)faultWindow.zeroConfidenceFrames++;
    if(s.confidence>=POLICY.reviewConfidence)faultWindow.highConfidenceFrames++;
  }
  for(let t=0;t<180;t++){
    if(group==='persistent_loss_45_to_140'&&t>=45&&t<=140 || group==='intermittent_loss_5pct'&&t>=45&&rng()<.05){observe(m.tick(t),t);abstained++;continue;}
    const f=sample(id,t);
    if(group!=='scripted')for(const k of CHANNELS){
      const amp={hr:4,spo2:.6,rr:1.2,activity:.015}[k];
      f[k].value+=offset[k]+(rng()*2-1)*amp;
      f[k].value=Math.max(POLICY.ranges[k][0],Math.min(POLICY.ranges[k][1],f[k].value));
      if(f[k].quality>=.65)f[k].quality=.9+.09*rng();
    }
    // High-quality but incorrect activity is a deliberate common-mode/context fault.
    if(group.startsWith('incorrect_activity')&&t>=45)f.activity.value=positive?.85:.04;
    if(group==='incorrect_activity_and_oxygen'&&positive&&t>=45)f.spo2.value=98+.1*Math.sin(t);
    const s=m.ingest(f);
    observe(s,t);
    if(s.confidence<POLICY.reviewConfidence)abstained++;
  }
  const reviews=m.events.filter(e=>e.type==='review');
  const target=reviews.find(e=>e.t>=45);
  return {group,scenario:id,seed,positive,detected:positive&&!!target,falsePositive:!positive&&reviews.length>0,
    earlyReview:positive&&reviews.some(e=>e.t<45),firstReview:reviews[0]?.t??null,latencyFromOnset:positive&&target?target.t-45:null,
    abstainedFrames:abstained,reviewCount:reviews.length,faultWindow};
}
const runs=groups.flatMap(g=>SCENARIOS.flatMap(s=>Array.from({length:g.seeds},(_,i)=>run(g.name,s.id,i+1))));
const summaries=groups.map(g=>{
  const rows=runs.filter(r=>r.group===g.name),pos=rows.filter(r=>r.positive),neg=rows.filter(r=>!r.positive);
  const tp=pos.filter(r=>r.detected).length,fp=neg.filter(r=>r.falsePositive).length;
  const delays=pos.map(r=>r.latencyFromOnset).filter(n=>n!==null).sort((a,b)=>a-b);
  return {group:g.name,traces:rows.length,positiveTraces:pos.length,negativeTraces:neg.length,tp,fn:pos.length-tp,fp,tn:neg.length-fp,
    syntheticMissRate:(pos.length-tp)/pos.length,syntheticFalseReviewRate:fp/neg.length,
    medianDelaySeconds:delays.length?delays[Math.floor(delays.length/2)]:null,p95DelaySeconds:delays.length?delays[Math.ceil(delays.length*.95)-1]:null,
    earlyReviews:rows.filter(r=>r.earlyReview).length,abstentionFraction:rows.reduce((n,r)=>n+r.abstainedFrames,0)/(rows.length*180)};
});
// Sweep input quality, holding physiological signals and every policy parameter fixed.
const sensitivity=[.64,.65,.69,.7,.71,.8,.9,.98,1].map(q=>{
  const m=new Monitor();for(let t=0;t<180;t++){const f=sample('multi',t);for(const k of CHANNELS)f[k].quality=q;m.ingest(f);}
  return {quality:q,evidenceSufficiency:explainConfidence(Object.fromEntries(CHANNELS.map(k=>[k,q])),true).value,
    calibrated:!!m.baseline,firstReview:m.events.find(e=>e.type==='review')?.t??null};
});
const report={policy:POLICY.version,seedRange:'1..N per cohort; same seed across scenarios',framesPerTrace:180,onsetSeconds:45,
  interpretation:'Synthetic scenario-level policy evaluation. These are not clinical sensitivity/specificity estimates. Correlated perturbations of four templates are not independent patients.',
  definitions:{positive:'drift or multi; review at or after t=45 counts as detected',negative:'exercise or sensor; any review counts as false review',latency:'first qualifying review minus synthetic onset (45), conditional on detection',abstention:'missing frame OR evidence sufficiency below review gate; not clinical uncertainty'},
  summaries,sensitivity,runs};
const out=new URL('../docs/',import.meta.url);await mkdir(out,{recursive:true});
await writeFile(new URL('evaluation.json',out),JSON.stringify(report,null,2)+'\n');
const pct=n=>(100*n).toFixed(1)+'%';
const markdown=`# Reproducible synthetic evaluation\n\nGenerated by npm run evaluate. Policy ${POLICY.version}. ${runs.length} traces × 180 seconds. No medical performance claims.\n\n| Cohort | TP / positives | FP / negatives | Miss rate | False-review rate | Median / p95 delay (s) | Abstention |\n|---|---:|---:|---:|---:|---:|---:|\n`+summaries.map(s=>`| ${s.group} | ${s.tp}/${s.positiveTraces} | ${s.fp}/${s.negativeTraces} | ${pct(s.syntheticMissRate)} | ${pct(s.syntheticFalseReviewRate)} | ${s.medianDelaySeconds??'n/a'} / ${s.p95DelaySeconds??'n/a'} | ${pct(s.abstentionFraction)} |`).join('\n')+`\n\n## Quality sensitivity (all channels varied together)\n\n| Input quality | Calibrated | Evidence index after calibration* | First review (s) |\n|---|---|---:|---:|\n`+sensitivity.map(s=>`| ${s.quality} | ${s.calibrated} | ${s.evidenceSufficiency.toFixed(3)} | ${s.firstReview??'none'} |`).join('\n')+`\n\n*The analytic index assumes calibration; the replay's calibration column reports whether calibration actually happened.\n\n## Protocol and limits\n\nThe four demo templates provide known scenario labels: drift/multi are positive; exercise/sensor are negative. Positive onset is defined at t=45 even though severity develops gradually. Latency is measured from that onset and includes smoothing and persistence; only detected positive traces enter latency summaries. A review before onset is recorded separately in evaluation.json.\n\nThe baseline/noise cohort varies resting HR by ±10, SpO₂ by ±0.5, RR by ±2, and adds independent uniform per-sample noise of ±4, ±0.6, ±1.2, ±0.015 respectively. Accepted quality varies uniformly from 0.90 to 0.99. Existing sensor faults retain their low quality. Loss cohorts additionally drop 5% of frames after onset or all frames t=45..140. The incorrect-context cohort reports activity 0.85 during positive anomalies and 0.04 during negative scenarios, while retaining nominal sensor quality.\n\nThe same seeds are reused for comparability, not independent clinical evidence. Thresholds were fixed before this evaluation. These cohorts are designed probes, not held-out physiological recordings. No real-patient ground truth, clinical calibration, or generalization estimate exists. Persistent data loss and misleading activity deliberately expose missed reviews; abstention does not make those cases safe.\n\nThe evidence-index sweep tests input-quality gate sensitivity, not predictive calibration. The discontinuities at quality 0.65 and evidence index 0.70 are intentional policy gates, not learned biological boundaries.\n`;
const corrected=markdown
  .replace('Thresholds were fixed before this evaluation.', 'Numeric thresholds are fixed; the activity-veto logic was revised after the incorrect-context development cohort exposed missed reviews. These are therefore development/regression results, not held-out estimates.')
  .replace('Persistent data loss and misleading activity deliberately expose missed reviews;', 'Persistent data loss and jointly misleading activity plus oxygen deliberately expose missed reviews;')
  .replace('while retaining nominal sensor quality.', 'while retaining nominal sensor quality. The joint-fault cohort also replaces positive-case oxygen after onset with 98 + 0.1 × sin(t), keeping quality nominal.');
const failures=['persistent_loss_45_to_140','incorrect_activity_and_oxygen'].map(group=>{
  const rows=runs.filter(r=>r.group===group&&r.positive);
  return {group,positiveTraces:rows.length,reviewRequests:rows.filter(r=>r.detected).length,
    tracesWithNoData:rows.filter(r=>r.faultWindow.noDataFrames>0).length,
    tracesWithSensorCheck:rows.filter(r=>r.faultWindow.sensorCheckFrames>0).length,
    highConfidenceFrames:rows.reduce((n,r)=>n+r.faultWindow.highConfidenceFrames,0),
    zeroConfidenceFrames:rows.reduce((n,r)=>n+r.faultWindow.zeroConfidenceFrames,0),
    monitoringFrames:rows.reduce((n,r)=>n+r.faultWindow.monitoringFrames,0),
    firstNoDataTimes:[...new Set(rows.map(r=>r.faultWindow.firstNoData))]};
});
const failureText='\n\n## Failure visibility (positive traces, t=45..140 inclusive)\n\n'+
 '| Cohort | Reviews | Traces with NO DATA | Traces with SENSOR CHECK | Zero-index frames | Index ≥ 0.70 frames | MONITORING frames | First NO DATA times |\n|---|---:|---:|---:|---:|---:|---:|---|\n'+
 failures.map(r=>`| ${r.group} | ${r.reviewRequests}/${r.positiveTraces} | ${r.tracesWithNoData}/${r.positiveTraces} | ${r.tracesWithSensorCheck}/${r.positiveTraces} | ${r.zeroConfidenceFrames} | ${r.highConfidenceFrames} | ${r.monitoringFrames} | ${JSON.stringify(r.firstNoDataTimes)} |`).join('\n')+
 '\n\nEach cohort has 40 positive traces × 96 fault-window seconds = 3,840 frames. These visibility metrics are separate from anomaly detection. They do not convert a missed anomaly into a successful detection. See [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) for exact behavior and presentation wording.\n';
await writeFile(new URL('EVALUATION.md',out),corrected+failureText);console.table(summaries);console.table(failures);
