// 端到端验证：用假 ctx 拉起真实 apply()，直接打 /dsh-push-notify/config 的 handler。
// 目的：证明 ① GET 不再下发密钥 ② POST 的空值/掩码回显不会抹掉已存密钥 ③ null 才能清除。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pn-mask-'));
const KEY = 'TESTONLY_device_key_ABCD';
const TOKEN = 'tk_abcdefgh12345678';
fs.writeFileSync(path.join(tmp, 'push-notify-config.json'), JSON.stringify({
  webUrl: 'http://127.0.0.1:3080',
  notifyOnTurnEnd: true, notifyOnApproval: true, notifyOnQuestion: true, notifyOnError: false,
  bark: { enabled: true, serverUrl: 'https://api.day.app', deviceKey: KEY, sound: 'chime', group: 'dsh-push' },
  ntfy: { enabled: false, serverUrl: 'https://ntfy.sh', topic: '', token: TOKEN, priority: 'default' },
}, null, 2), 'utf8');

process.env.DSH_PROFILE_DIR = tmp;

const routes = new Map();
const fakeRes = () => {
  const out = { status: 0, body: '' };
  return {
    headersSent: false,
    writeHead(status) { out.status = status; this.headersSent = true; },
    end(chunk) { if (chunk) out.body += chunk; },
    _out: out,
  };
};
const call = async (method, payload, routePath = '/dsh-push-notify/config') => {
  const route = routes.get(routePath);
  const res = fakeRes();
  let emitted = false;
  const req = {
    method,
    on(ev, cb) {
      if (ev === 'data' && !emitted) { emitted = true; cb(Buffer.from(JSON.stringify(payload ?? {}))); }
      if (ev === 'end') cb();
      return req;
    },
  };
  await route.handler(req, res);
  return { status: res._out.status, json: JSON.parse(res._out.body || '{}') };
};
const onDisk = () => JSON.parse(fs.readFileSync(path.join(tmp, 'push-notify-config.json'), 'utf8'));

const ctx = {
  logger: { warn() {}, error() {}, info() {}, debug() {} },
  on() {},
  effect(fn) { if (typeof fn === 'function') fn(); },
  set() {},
  get() { return undefined; },
  webServer: { register(r) { routes.set(r.path, r); } },
};

const { apply } = await import('../index.js');
apply(ctx, {});

const results = [];
const check = (name, pass, detail) => results.push(`${pass ? 'PASS' : 'FAIL'} | ${name}${detail ? ' → ' + detail : ''}`);

// ① GET 不得出现明文
const g1 = await call('GET');
const raw = JSON.stringify(g1.json);
check('① GET 不含明文 key', !raw.includes(KEY), raw.includes(KEY) ? '泄露!' : 'ok');
check('② GET 不含明文 token', !raw.includes(TOKEN), raw.includes(TOKEN) ? '泄露!' : 'ok');
check('③ GET 给出已配置标记', g1.json.config?.bark?.deviceKeyConfigured === true,
  JSON.stringify(g1.json.config?.bark?.deviceKeyMasked));
check('④ GET 掩码形态', g1.json.config?.bark?.deviceKeyMasked === '••••••••ABCD', g1.json.config?.bark?.deviceKeyMasked);
check('⑤ GET 的 deviceKey 字段为空串', g1.json.config?.bark?.deviceKey === '');

// ② 只改 sound（不带 deviceKey）→ 密钥必须保留
await call('POST', { bark: { sound: 'glass' } });
check('⑥ 省略密钥字段时保留', onDisk().bark.deviceKey === KEY, onDisk().bark.deviceKey === KEY ? 'ok' : '被抹掉!');

// ③ 传空串（前端掩码后就是这个形态）→ 保留
await call('POST', { bark: { deviceKey: '', sound: 'bell' } });
check('⑦ 空串不抹掉密钥', onDisk().bark.deviceKey === KEY, onDisk().bark.deviceKey === KEY ? 'ok' : '被抹掉!');

// ④ 掩码回显（前端把 placeholder 值当 value 提交的极端情况）→ 保留
await call('POST', { bark: { deviceKey: '••••••••6iM' } });
check('⑧ 掩码回显不覆盖密钥', onDisk().bark.deviceKey === KEY, onDisk().bark.deviceKey === KEY ? 'ok' : '被覆盖!');

// ⑤ 传新值 → 覆盖
await call('POST', { bark: { deviceKey: 'NEWKEY9999' } });
check('⑨ 新值正常写入', onDisk().bark.deviceKey === 'NEWKEY9999', onDisk().bark.deviceKey);

// ⑥ 只有 null 才清除
await call('POST', { bark: { deviceKey: null } });
check('⑩ null 才清除', onDisk().bark.deviceKey === '', JSON.stringify(onDisk().bark.deviceKey));

// ⑦ POST 响应同样不得含明文（用新 key 再验一次）
await call('POST', { bark: { deviceKey: 'SECRET_TAIL_4321' } });
const g2 = await call('POST', { bark: { sound: 'chime' } });
check('⑪ POST 响应不含明文', !JSON.stringify(g2.json).includes('SECRET_TAIL_4321'),
  JSON.stringify(g2.json).includes('SECRET_TAIL_4321') ? '泄露!' : 'ok');
check('⑫ POST 响应仍带掩码', g2.json.config?.bark?.deviceKeyMasked === '••••••••4321',
  g2.json.config?.bark?.deviceKeyMasked);

// ⑧ ntfy token 同样处理
check('⑬ ntfy token 已掩码', g2.json.config?.ntfy?.token === ''
  && g2.json.config?.ntfy?.tokenConfigured === true, g2.json.config?.ntfy?.tokenMasked);

// ⑧.5 前端回显整个 form 时，派生字段不得被持久化
await call('POST', {
  bark: { deviceKey: '', deviceKeyConfigured: true, deviceKeyMasked: '••••••••4321' },
  ntfy: { token: '', tokenConfigured: true, tokenMasked: '••••••••5678' },
});
const persisted = onDisk();
check('⑬.5 派生字段不落盘',
  persisted.bark.deviceKeyConfigured === undefined && persisted.bark.deviceKeyMasked === undefined
  && persisted.ntfy.tokenMasked === undefined,
  JSON.stringify(Object.keys(persisted.bark)));
check('⑬.6 回显整表后密钥仍保留', persisted.bark.deviceKey === 'SECRET_TAIL_4321', persisted.bark.deviceKey || '(空)');

// ⑨ 已配置状态下测试推送仍应读到密钥（不能被判成「未配置」）
// 这里用的是假 key，Bark 会回 4xx，我们只关心它没有停在「未配置 Device Key」。
const t = await call('POST', { channel: 'bark', config: { bark: { deviceKey: '' } } }, '/dsh-push-notify/test');
const barkMsg = t.json?.feedback?.bark?.message || '';
check('⑭ 测试推送能读到已存密钥', !barkMsg.includes('未配置'), barkMsg || '(无 message)');
check('⑮ 测试推送未抹掉密钥', onDisk().bark.deviceKey === 'SECRET_TAIL_4321', onDisk().bark.deviceKey === 'SECRET_TAIL_4321' ? 'ok' : '被抹掉!');

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL'));
console.log(failed.length ? `\nRESULT=FAIL (${failed.length})` : '\nRESULT=ALL PASS');
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failed.length ? 1 : 0);
