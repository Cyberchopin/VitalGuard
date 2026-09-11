export const SCENARIOS=[
  {id:'exercise',name:'Activity & recovery',label:'01 / CONTEXT',description:'Heart rate rises during movement, then settles. Context prevents a review.',expected:'No human review; activity explains the rise.'},
  {id:'drift',name:'Quiet deterioration',label:'02 / EARLY WARNING',description:'Oxygen drifts down while breathing and heart rate rise at rest.',expected:'Sustained corroboration requests human review.'},
  {id:'sensor',name:'Sensor disconnect',label:'03 / TRUST',description:'An oxygen reading drops to 70 with poor quality. The agent questions the sensor.',expected:'Sensor check; unreliable oxygen excluded.'},
  {id:'multi',name:'Converging signals',label:'04 / ESCALATION',description:'Three reliable signals move together. A human decides what happens next.',expected:'Review request, then confirmation enables high priority.'}
];
export function sample(id,t){
  if(!SCENARIOS.some(s=>s.id===id)||!Number.isInteger(t)||t<0)throw new Error('Invalid scenario or sample time');
  const wave=Math.sin(t*0.41), gentle=Math.sin(t*0.17);
  let hr=72+2*wave,spo2=98+0.35*gentle,rr=15+0.5*wave,activity=0.04+0.01*gentle,q=0.98;
  if(id==='exercise') {const amount=t<40?0:t<55?(t-40)/15:t<95?1:t<115?(115-t)/20:0;hr+=65*amount;rr+=12*amount;activity+=0.8*amount;}
  if(id==='drift'||id==='multi'){let a=Math.max(0,Math.min(1,(t-45)/(id==='multi'?22:55)));if(t>130)a*=Math.max(0,(165-t)/35);hr+=65*a;spo2-=10*a;rr+=20*a;}
  if(id==='sensor' && t>=45 && t<115){spo2=70+wave;q=0.12;}
  return {t,hr:{value:hr,quality:0.98},spo2:{value:spo2,quality:q},rr:{value:rr,quality:0.97},activity:{value:activity,quality:0.99}};
}
