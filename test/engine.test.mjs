import test from 'node:test';
import assert from 'node:assert/strict';
import { Monitor } from '../dist/engine.mjs';
import { sample } from '../dist/scenarios.mjs';

function replay(scenario, end) {
  const monitor = new Monitor();
  for (let t = 0; t <= end; t++) {
    monitor.ingest(sample(scenario, t));
  }
  return monitor;
}

test('运动与恢复不触发人工复核', () => {
  const m = replay('exercise', 179);
  assert.equal(m.events.some(e => e.type === 'review'), false);
  assert.equal(m.latest.state, 'MONITORING');
});

test('故障氧信号被排除，触发传感器检查', () => {
  const m = replay('sensor', 70);
  assert.equal(m.latest.state, 'SENSOR CHECK');
  assert.equal(m.latest.valid.includes('spo2'), false);
  assert.equal(m.latest.features.spo2.contribution, 0);
  assert.equal(m.events.some(e => e.type === 'review'), false);
});

test('多信号异常必须经过人工确认才能升级', () => {
  const m = replay('multi', 71);
  assert.equal(m.latest.state, 'REVIEW REQUESTED');
  assert.equal(m.latest.episode.status, 'pending');

  m.review(
    m.latest.episode.id,
    'confirm',
    'Synthetic demo: corroborated signal changes'
  );

  assert.equal(m.latest.state, 'HIGH PRIORITY');
  assert.equal(m.events.at(-2).type, 'confirm');
});

test('数据断流后进入 NO DATA，置信度归零', () => {
  const m = replay('exercise', 30);

  // 最后一个样本在第 30 秒；第 34 秒已超过新鲜度限制。
  m.tick(34);

  assert.equal(m.latest.state, 'NO DATA');
  assert.equal(m.latest.confidence, 0);
  assert.equal(m.latest.stale, true);
  assert.equal(m.latest.valid.length, 0);
  assert.deepEqual(m.latest.scoreRange, [0, 100]);
});
test('复核超时保持待确认，不自动升级', () => {
  const m = replay('multi', 110);

  assert.equal(m.latest.state, 'REVIEW REQUESTED');
  assert.equal(m.latest.episode.status, 'pending');
  assert.equal(m.latest.episode.timedOut, true);
  assert.equal(
    m.events.filter(e => e.type === 'timeout').length,
    1
  );
  assert.equal(
    m.events.some(e => e.type === 'confirm'),
    false
  );
});