/** Deterministic research prototype. All thresholds are demo parameters, not clinical guidance. */
export const CHANNELS = ['hr', 'spo2', 'rr', 'activity'];
export const POLICY = Object.freeze({version:'vg-demo-1.0', samplePeriod:1, staleSeconds:3, qualityMin:0.65, baselineSamples:20, windowSeconds:5, watchScore:25, reviewScore:55, reviewConfidence:0.7, persistenceSeconds:8, recoveryScore:20, recoverySeconds:10, timeoutSeconds:30, weights:{hr:25,spo2:45,rr:30}, ranges:{hr:[25,240],spo2:[50,100],rr:[4,65],activity:[0,1]}});
const clamp = (n,a=0,b=1) => Math.max(a,Math.min(b,n));
const median = a => {const s=[...a].sort((x,y)=>x-y);return s.length ? (s[Math.floor((s.length-1)/2)]+s[Math.floor(s.length/2)])/2 : 0;};
const floors = {hr:4,spo2:0.8,rr:1.5};
export class Monitor {
  constructor(){this.history=[];this.events=[];this.baselineRows=[];this.baseline=null;this.lastT=null;this.lastNow=null;this.riskSince=null;this.recoverySince=null;this.episode=null;this.lastState=null;this.latest=null;this.sequence=0;}
  event(type,t,title,detail,extra={}) {const e={id:`E${String(++this.sequence).padStart(3,'0')}`,type,t,title,detail,policy:POLICY.version,...extra};this.events.push(e);return e;}
  ingest(frame,now=frame?.t){
    if(!frame || !Number.isFinite(frame.t) || !Number.isFinite(now) || (this.lastNow!==null && now<this.lastNow) || frame.t>now+1 || (this.lastT!==null && frame.t<=this.lastT)) {
      this.event('rejected',Number.isFinite(now)?now:(this.lastNow??0),'Frame rejected','Invalid, future, duplicate, or out-of-order timestamp.');
      return this.tick(Number.isFinite(now)?Math.max(now,this.lastNow??now):(this.lastNow??0));
    }
    const gap=this.lastT!==null && frame.t-this.lastT>POLICY.staleSeconds;
    if(gap){this.riskSince=null;this.recoverySince=null;this.event('quality',now,'Stream gap','Persistence window restarted; missing time is not evidence.');}
    const row={t:frame.t, values:{},quality:{},issues:[]};
    for(const k of CHANNELS){
      const s=frame[k], range=POLICY.ranges[k];
      let reason='';
      if(!s || typeof s.value!=='number' || !Number.isFinite(s.value)) reason='missing or non-finite';
      else if(s.value<range[0] || s.value>range[1]) reason='outside input range';
      else if(typeof s.quality!=='number' || !Number.isFinite(s.quality) || s.quality<0 || s.quality>1) reason='invalid quality';
      else if(s.quality<POLICY.qualityMin) reason='low signal quality';
      else if(now-frame.t>POLICY.staleSeconds) reason='stale sample';
      // A frozen numeric channel is distinct from a quiet activity channel.
      const prior=this.history.filter(r=>r.t>=frame.t-20);
      if(!reason && k!=='activity' && prior.length>=20 && prior.every(r=>r.values[k]===s.value)) reason='flatline suspected';
      row.values[k]=s && typeof s.value==='number' && Number.isFinite(s.value)?s.value:null;
      row.quality[k]=reason?0:s.quality;
      if(reason)row.issues.push(`${k}: ${reason}`);
    }
    this.lastT=frame.t;this.lastNow=now;this.history.push(row);this.history=this.history.filter(r=>r.t>=frame.t-120);
    if(!this.baseline && CHANNELS.every(k=>row.quality[k]>=POLICY.qualityMin) && row.values.activity<0.2 && now-frame.t<=POLICY.staleSeconds){
      if(gap)this.baselineRows=[];
      this.baselineRows.push(row);
      if(this.baselineRows.length>=POLICY.baselineSamples){
        this.baseline=Object.fromEntries(['hr','spo2','rr'].map(k=>{const vs=this.baselineRows.map(r=>r.values[k]),center=median(vs);return[k,{center,scale:Math.max(floors[k],median(vs.map(v=>Math.abs(v-center)))*1.4826)}];}));
        this.event('baseline',now,'Baseline calibrated','20 accepted resting samples. Robust median and MAD model frozen for this session.',{baseline:this.baseline});
      }
    } else if(!this.baseline) this.baselineRows=[];
    return this.evaluate(now);
  }
  tick(now){if(!Number.isFinite(now))throw new Error('Invalid clock');now=Math.max(now,this.lastNow??now);this.lastNow=now;return this.evaluate(now);}
  evaluate(now){
    const row=this.history.at(-1),stale=!row || now-row.t>POLICY.staleSeconds;
    const quality=Object.fromEntries(CHANNELS.map(k=>[k,stale?0:(row?.quality[k]??0)]));
    const valid=CHANNELS.filter(k=>quality[k]>=POLICY.qualityMin);
    const issues=stale?['stream: no fresh data']:[...row.issues];
    const active=valid.includes('activity') && row.values.activity>=0.35;
    const features={};let score=0,missingWeight=0;
    for(const k of ['hr','spo2','rr']){
      if(!valid.includes(k)){missingWeight+=POLICY.weights[k];features[k]={value:null,contribution:0,reason:'Excluded: unreliable signal',z:null,trend:null};continue;}
      const window=this.history.filter(r=>r.t>=row.t-POLICY.windowSeconds+1 && r.quality[k]>=POLICY.qualityMin);
      const value=median(window.map(r=>r.values[k]));
      const trend=window.length>1?(window.at(-1).values[k]-window[0].values[k])/(window.at(-1).t-window[0].t)*60:0;
      const b=this.baseline?.[k];const z=b ? (k==='spo2'?b.center-value:value-b.center)/b.scale : 0;
      const rule=k==='hr'?clamp((value-100)/50):k==='spo2'?clamp((96-value)/8):clamp((value-22)/12);
      const novelty=b?0.6*clamp((z-3)/5):0;
      const context=(active && k!=='spo2')?0.15:1;
      const severity=Math.max(rule,novelty)*context;
      const contribution=severity*POLICY.weights[k];score+=contribution;
      features[k]={value,trend,z,severity,contribution,reason:active&&k!=='spo2'?'Activity context discounts this channel':severity>0?`${k==='spo2'?'Downward':'Upward'} deviation from demo envelope or learned baseline`:'Within demo envelope'};
    }
    score=Math.round(score);
    const confidence=stale?0:Math.min(valid.includes('activity')?1:0.5,CHANNELS.reduce((s,k)=>s+quality[k],0)/4)*(this.baseline?1:0.5);
    const supports=Object.values(features).filter(f=>f.severity>=0.25).length;
    const qualifies=this.baseline && score>=POLICY.reviewScore && confidence>=POLICY.reviewConfidence && supports>=2;
    if(qualifies){if(this.riskSince===null)this.riskSince=now;}else this.riskSince=null;
    const persistence=this.riskSince===null?0:now-this.riskSince;
    if(!stale && valid.length===4 && score<POLICY.recoveryScore){if(this.recoverySince===null)this.recoverySince=now;}else this.recoverySince=null;
    if(this.episode && this.episode.status!=='pending' && this.recoverySince!==null && now-this.recoverySince>=POLICY.recoverySeconds){this.event('recovery',now,'Episode re-armed','10 seconds below recovery threshold with all channels reliable.');this.episode=null;}
    if(qualifies && persistence>=POLICY.persistenceSeconds && !this.episode){
      this.episode=this.event('review',now,'Human review requested',`${supports} channels support a sustained anomaly. Confirm an observed concern or dismiss with a reason.`,{status:'pending',score,confidence,evidence:JSON.parse(JSON.stringify(features))});
    }
    if(this.episode?.status==='pending' && now-this.episode.t>=POLICY.timeoutSeconds && !this.episode.timedOut){this.episode.timedOut=true;this.event('timeout',now,'Review overdue','No response after 30 simulated seconds. Review remains unresolved; no autonomous action taken.',{episodeId:this.episode.id});}
    let state=stale?'NO DATA':!this.baseline?'CALIBRATING':valid.length<4?'SENSOR CHECK':score>=POLICY.watchScore?'WATCH':'MONITORING';
    if(this.episode?.status==='pending')state='REVIEW REQUESTED';
    if(this.episode?.status==='confirmed')state='HIGH PRIORITY';
    if(state!==this.lastState){this.event('state',now,state,issues.length?issues.join('; '):`Observed score ${score}/100; ${Math.round(confidence*100)}% evidence confidence.`);this.lastState=state;}
    this.latest={t:now,frameT:row?.t??null,state,score,scoreRange:[score,Math.min(100,Math.ceil(score+missingWeight))],confidence,valid,quality,issues,features,active,stale,persistence,baseline:this.baseline,baselineProgress:this.baselineRows.length,episode:this.episode,values:row?.values??{},policy:POLICY.version};
    return this.latest;
  }
  review(id,action,note,now=this.lastNow){
    if(!['confirm','dismiss'].includes(action))throw new Error('Unknown review action');
    if(!this.episode || this.episode.id!==id || this.episode.status!=='pending')throw new Error('This review is no longer pending');
    if(typeof note!=='string' || note.trim().length<3 || note.length>500)throw new Error('Add a note between 3 and 500 characters');
    if(!Number.isFinite(now)||now<this.lastNow)throw new Error('Invalid review time');
    this.episode.status=action==='confirm'?'confirmed':'dismissed';
    this.event(action,now,action==='confirm'?'Concern confirmed · high priority':'Review dismissed',note.trim(),{episodeId:id,actor:'Demo operator'});
    return this.tick(now);
  }
  report(){return structuredClone({schemaVersion:1,synthetic:true,policy:POLICY,baseline:this.baseline,latest:this.latest,events:this.events});}
}
