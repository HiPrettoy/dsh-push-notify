import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const inject = ['webServer', 'connection'];

const DEFAULT_CONFIG = {
  webUrl: 'http://127.0.0.1:3080',
  notifyOnTurnEnd: true,
  notifyOnApproval: true,
  notifyOnQuestion: true,
  notifyOnError: false,
  bark: {
    enabled: true,
    serverUrl: 'https://api.day.app',
    deviceKey: '',
    sound: 'bell',
    group: 'DeepSeek Harness',
  },
  ntfy: {
    enabled: false,
    serverUrl: 'https://ntfy.sh',
    topic: '',
    token: '',
    priority: 'default',
  },
};

function sendJson(res, status, payload) {
  if (res.headersSent) return;
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(payload));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 64) {
        reject(new Error('payload-too-large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function apply(ctx, config) {
  const profileDir = process.env.DSH_PROFILE_DIR || process.cwd();
  const configPath = join(profileDir, 'push-notify-config.json');
  const legacyBarkPath = join(profileDir, 'bark-config.json');

  const loadConfig = () => {
    try {
      if (existsSync(configPath)) {
        const fileData = JSON.parse(readFileSync(configPath, 'utf8'));
        return {
          ...DEFAULT_CONFIG,
          ...config,
          ...fileData,
          bark: { ...DEFAULT_CONFIG.bark, ...(config?.bark || {}), ...(fileData?.bark || {}) },
          ntfy: { ...DEFAULT_CONFIG.ntfy, ...(config?.ntfy || {}), ...(fileData?.ntfy || {}) },
        };
      } else if (existsSync(legacyBarkPath)) {
        // 平滑迁移旧版 bark-config.json
        const oldData = JSON.parse(readFileSync(legacyBarkPath, 'utf8'));
        return {
          ...DEFAULT_CONFIG,
          ...config,
          webUrl: oldData.webUrl || DEFAULT_CONFIG.webUrl,
          notifyOnTurnEnd: oldData.notifyOnTurnEnd ?? true,
          notifyOnApproval: oldData.notifyOnApproval ?? true,
          notifyOnQuestion: oldData.notifyOnQuestion ?? true,
          notifyOnError: oldData.notifyOnError ?? false,
          bark: {
            ...DEFAULT_CONFIG.bark,
            enabled: !!oldData.deviceKey,
            serverUrl: oldData.serverUrl || DEFAULT_CONFIG.bark.serverUrl,
            deviceKey: oldData.deviceKey || '',
            sound: oldData.sound || 'bell',
            group: oldData.group || 'DeepSeek Harness',
          },
        };
      }
    } catch (e) {
      ctx.logger?.warn?.('[push-notify] 读取配置文件失败:', e?.message);
    }
    return { ...DEFAULT_CONFIG, ...config };
  };

  let activeConfig = loadConfig();

  const saveConfig = (newCfg) => {
    activeConfig = {
      ...activeConfig,
      ...newCfg,
      bark: { ...(activeConfig.bark || DEFAULT_CONFIG.bark), ...(newCfg.bark || {}) },
      ntfy: { ...(activeConfig.ntfy || DEFAULT_CONFIG.ntfy), ...(newCfg.ntfy || {}) },
    };
    try {
      writeFileSync(configPath, JSON.stringify(activeConfig, null, 2), 'utf8');
      return true;
    } catch (e) {
      ctx.logger?.error?.('[push-notify] 保存配置文件失败:', e?.message);
      return false;
    }
  };

  // Bark 推送执行器
  const sendBark = async (title, body, extraUrl) => {
    const cfg = activeConfig.bark || {};
    const deviceKey = cfg.deviceKey?.trim();
    if (!deviceKey) {
      return { ok: false, message: 'Bark 未配置 Device Key' };
    }

    const serverUrl = (cfg.serverUrl || 'https://api.day.app').trim().replace(/\/+$/, '');
    const pushEndpoint = `${serverUrl}/push`;
    const targetUrl = extraUrl || activeConfig.webUrl || undefined;

    const payload = {
      device_key: deviceKey,
      title: title || 'DeepSeek Harness',
      body: body || '',
      group: cfg.group || 'DeepSeek Harness',
      ...(cfg.sound ? { sound: cfg.sound } : {}),
      ...(targetUrl ? { url: targetUrl } : {}),
    };

    try {
      const response = await fetch(pushEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return { ok: false, message: `Bark HTTP ${response.status}: ${errorText}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, message: `Bark 异常: ${err?.message || err}` };
    }
  };

  // ntfy 推送执行器
  const sendNtfy = async (title, body, extraUrl, priority, tags) => {
    const cfg = activeConfig.ntfy || {};
    const topic = cfg.topic?.trim();
    if (!topic) {
      return { ok: false, message: 'ntfy 未配置 Topic' };
    }

    const serverUrl = (cfg.serverUrl || 'https://ntfy.sh').trim().replace(/\/+$/, '');
    const endpoint = `${serverUrl}/${encodeURIComponent(topic)}`;
    const targetUrl = extraUrl || activeConfig.webUrl || undefined;

    const headers = {
      'Content-Type': 'text/plain; charset=utf-8',
      'Title': Buffer.from(title || 'DeepSeek Harness', 'utf-8').toString('latin1'),
      'Priority': priority || cfg.priority || 'default',
    };

    if (tags && tags.length > 0) {
      headers['Tags'] = tags.join(',');
    }

    if (targetUrl) {
      headers['Click'] = targetUrl;
    }

    if (cfg.token?.trim()) {
      headers['Authorization'] = `Bearer ${cfg.token.trim()}`;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: body || '',
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return { ok: false, message: `ntfy HTTP ${response.status}: ${errorText}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, message: `ntfy 异常: ${err?.message || err}` };
    }
  };

  // 统一分发消息到已启用的渠道
  const dispatchNotification = (notification) => {
    // 异步触发推送，不阻塞主流程
    Promise.resolve().then(async () => {
      try {
        const { title, body, extraUrl, priority = 'default', tags = ['bell'] } = notification;
        if (activeConfig.bark?.enabled) {
          await sendBark(title, body, extraUrl);
        }
        if (activeConfig.ntfy?.enabled) {
          await sendNtfy(title, body, extraUrl, priority, tags);
        }
      } catch (e) {
        ctx.logger?.warn?.('[push-notify] dispatch error:', e?.message || e);
      }
    });
  };

  // 注册精确 HTTP API 供前端访问
  ctx.effect(() => {
    const disposers = [
      ctx.webServer.register({
        kind: 'exact',
        path: '/dsh-push-notify/config',
        handler: async (req, res) => {
          if (req.method === 'GET') {
            sendJson(res, 200, { ok: true, config: activeConfig });
            return;
          }
          if (req.method === 'POST') {
            try {
              const body = await parseJsonBody(req);
              const ok = saveConfig(body);
              sendJson(res, 200, { ok, config: activeConfig });
            } catch (err) {
              sendJson(res, 400, { ok: false, error: err?.message || 'invalid payload' });
            }
            return;
          }
          res.writeHead(405, { allow: 'GET, POST' });
          res.end();
        },
      }),

      ctx.webServer.register({
        kind: 'exact',
        path: '/dsh-push-notify/test',
        handler: async (req, res) => {
          if (req.method !== 'POST') {
            res.writeHead(405, { allow: 'POST' });
            res.end();
            return;
          }
          try {
            const body = await parseJsonBody(req);
            const target = body.channel || 'all'; // 'bark' | 'ntfy' | 'all'
            if (body.config) {
              saveConfig(body.config);
            }

            const testTitle = '🔔 DeepSeek Harness 推送测试';
            const testBody = '这是一条来自 DSH 的测试通知，通道配置成功！';

            const feedback = {};
            if (target === 'bark' || target === 'all') {
              feedback.bark = await sendBark(testTitle, testBody);
            }
            if (target === 'ntfy' || target === 'all') {
              feedback.ntfy = await sendNtfy(testTitle, testBody, null, 'default', ['tada', 'bell']);
            }

            sendJson(res, 200, { ok: true, feedback });
          } catch (err) {
            sendJson(res, 500, { ok: false, error: err?.message || 'test failed' });
          }
        },
      }),
    ];

    return () => {
      for (const d of disposers) d();
    };
  }, 'dsh-push-notify: HTTP API routes');

  // 1. 等待操作授权/批准 (Waterfall)
  ctx.on('approval/request', (req, next) => {
    if (activeConfig.notifyOnApproval) {
      const toolName = req.toolName || '工具';
      const reason = req.reason || (req.displayReason && (req.displayReason.zh || req.displayReason.en)) || '需要您授权确认';
      const title = '⚠️ DSH: 等待权限批准';
      const body = `工具 [${toolName}] 请求执行：\n${reason}`;
      dispatchNotification({ title, body, priority: 'high', tags: ['warning', 'lock'] });
    }
    return next();
  });

  // 2. 工具执行拦截：当触发 ask_user_question 时立即发送通知
  // ask_user_question 无论 timed 还是 legacy 模式，都会经过 tools/execute
  ctx.on('tools/execute', (exec, next) => {
    if (activeConfig.notifyOnQuestion && exec?.name === 'ask_user_question') {
      try {
        const questions = exec.arguments?.questions || [];
        const questionTexts = questions.map((q) => {
          const header = q.header ? `【${q.header}】` : '';
          const options = q.options ? `\n选项: ${q.options.map(o => o.label).join(' / ')}` : '';
          return `${header}${q.question}${options}`;
        }).join('\n\n');

        const title = '❓ DSH: 等待用户输入/选择';
        const body = questionTexts || 'Agent 正在等待您的确认或选择方案';
        dispatchNotification({ title, body, priority: 'high', tags: ['question', 'speech_balloon'] });
      } catch (err) {
        ctx.logger?.warn?.('[push-notify] ask_user_question notify error:', err?.message || err);
      }
    }
    return next();
  });

  // 备用兜底：针对直接触发 ctx.userQuestions.ask 的 Waterfall 监听
  ctx.on('user-questions/request', (req, next) => {
    if (activeConfig.notifyOnQuestion) {
      const questions = req.questions || [];
      const questionTexts = questions.map((q) => {
        const header = q.header ? `【${q.header}】` : '';
        return `${header}${q.question}`;
      }).join('\n');

      const title = '❓ DSH: 等待用户输入/确认';
      const body = questionTexts || 'Agent 正在等待您的确认或输入选项';
      dispatchNotification({ title, body, priority: 'high', tags: ['question', 'speech_balloon'] });
    }
    return next();
  });

  // 3. 对话回合结束 (Serial)
  ctx.on('agent/turn-stopping', (payload) => {
    if (activeConfig.notifyOnTurnEnd) {
      const turnNum = payload?.turn !== undefined ? ` (第 ${payload.turn} 轮)` : '';
      const title = '✅ DSH: 对话回合结束';
      const body = `AI 已完成当前回合的思考与响应${turnNum}，等待下一轮指令。`;
      dispatchNotification({ title, body, priority: 'default', tags: ['white_check_mark', 'robot'] });
    }
  });

  // 4. 运行错误 (Emit)
  ctx.on('agent/error', (payload) => {
    if (activeConfig.notifyOnError) {
      const errorMsg = payload?.error?.message || String(payload?.error || '未知异常');
      const title = '❌ DSH: 运行异常';
      const body = `第 ${payload?.turn ?? '?'} 轮第 ${payload?.step ?? '?'} 步出错：\n${errorMsg}`;
      dispatchNotification({ title, body, priority: 'urgent', tags: ['x', 'warning'] });
    }
  });
}
