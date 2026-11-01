import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const inject = ['webServer', 'connection'];

const DEFAULT_CONFIG = {
  webUrl: 'http://127.0.0.1:3080',
  notifyOnTurnEnd: true,
  notifyOnApproval: true,
  notifyOnQuestion: true,
  notifyOnError: true,
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

/**
 * Resolve the directory that owns this profile's on-disk state.
 *
 * `DSH_PROFILE_DIR` is only injected into the *model shell child process*
 * (see `dsh-shell-env`: `values[DSH_PROFILE_DIR_KEY] = profile.dir`), so the
 * DSH main process usually does **not** have it. Falling straight back to
 * `process.cwd()` then writes the config into whatever directory the host
 * happened to be launched from — on the desktop client that is the DSH
 * installation directory itself (`<npm prefix>/node_modules/@deepseek-ai/dsh`),
 * so the file is wiped on every upgrade.
 *
 * Prefer the `profileContext` service, which is the authoritative source for
 * the active profile directory (`~/.dsh/profiles/<name>`).
 */
function resolveProfileDir(ctx) {
  if (process.env.DSH_PROFILE_DIR) return process.env.DSH_PROFILE_DIR;
  try {
    const dir = ctx.get?.('profileContext')?.dir;
    if (typeof dir === 'string' && dir.length > 0) return dir;
  } catch {
    // profileContext is optional; fall through to the remaining candidates.
  }
  if (process.env.DSH_HOME) return process.env.DSH_HOME;
  return process.cwd();
}

export function apply(ctx, config) {
  const profileDir = resolveProfileDir(ctx);
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
          notifyOnError: oldData.notifyOnError ?? true,
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

  // 1. 等待操作授权/批准 (Waterfall 拦截)
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

  // 3. 对话回合正常结束 (Serial)
  ctx.on('agent/turn-stopping', (payload) => {
    if (activeConfig.notifyOnTurnEnd) {
      const turnNum = payload?.turn !== undefined ? ` (第 ${payload.turn} 轮)` : '';
      const title = '✅ DSH: 对话回合结束';
      const body = `AI 已完成当前回合的思考与响应${turnNum}，等待下一轮指令。`;
      dispatchNotification({ title, body, priority: 'default', tags: ['white_check_mark', 'robot'] });
    }
  });

  // 4. 监听底层会话流（全局）：捕获权限请求 approval/asked 以及回合异常结束
  ctx.on('session/event', (_session, event) => {
    if (!event?.type) return;

    // 4.1 权限授权请求：在核心 session.append('approval/asked') 时立即推送
    if (event.type === 'approval/asked') {
      if (!activeConfig.notifyOnApproval) return;
      const toolName = event.data?.toolName || '工具';
      const reason = event.data?.reason || '需要执行操作授权';
      const title = '⚠️ DSH: 等待权限批准';
      const body = `工具 [${toolName}] 请求执行权限：\n${reason}`;
      dispatchNotification({ title, body, priority: 'high', tags: ['warning', 'lock'] });
      return;
    }

    // 4.2 回合结束处理
    if (event.type === 'turn/end') {
      if (!activeConfig.notifyOnError && !activeConfig.notifyOnTurnEnd) return;
      const reason = event.data?.reason;
      if (!reason) return;

      const turn = event.data?.turn;
      const turnText = turn !== undefined ? ` (第 ${turn} 轮)` : '';

      // 运行错误（例如：额度用尽 QUOTA、模型请求报错等）
      if (reason.kind === 'error') {
        if (!activeConfig.notifyOnError) return;
        const err = reason.error || {};
        const code = err.code || '';
        let errMsg = err.message || '';

        if (code === 'QUOTA' || code === 'ACCOUNT_QUOTA' || errMsg.includes('额度已用尽')) {
          errMsg = '当前请求的额度已用尽 (QUOTA)，任务已中止。请检查账号余额或充值。';
        }

        const title = '❌ DSH: 本轮运行失败';
        const body = `本轮对话${turnText}因异常停止：\n${errMsg}${code ? `\n[错误码: ${code}]` : ''}`;
        dispatchNotification({ title, body, priority: 'urgent', tags: ['x', 'warning', 'money_with_wings'] });
        return;
      }

      // 用户主动终止或被信号中断
      if (reason.kind === 'aborted' || reason.kind === 'interrupted') {
        if (!activeConfig.notifyOnError) return;
        let abortDesc = '任务被中断或终止';
        if (reason.reason?.kind === 'hook' && reason.reason?.reason === 'deepseek-account/signed-out') {
          abortDesc = '因账号退出登录，任务已停止。';
        } else if (reason.kind === 'interrupted') {
          abortDesc = 'DSH 进程在任务完成前退出。';
        }
        const title = '⏹️ DSH: 任务已终止';
        const body = `本轮对话${turnText}${abortDesc}`;
        dispatchNotification({ title, body, priority: 'high', tags: ['stop_button', 'warning'] });
        return;
      }

      // 达到 Token 最大上限限制截断
      if (reason.kind === 'max-tokens') {
        if (!activeConfig.notifyOnTurnEnd) return;
        const title = '⚠️ DSH: 已达到最大 Token 限制';
        const body = `本轮对话${turnText}输出达到了上下文 Token 上限，已截断停止。`;
        dispatchNotification({ title, body, priority: 'high', tags: ['warning'] });
      }
    }
  }, { global: true });

  // 5. Agent 错误兜底
  ctx.on('agent/error', (payload) => {
    if (activeConfig.notifyOnError) {
      const errorMsg = payload?.error?.message || String(payload?.error || '未知异常');
      const title = '❌ DSH: 运行异常';
      const body = `第 ${payload?.turn ?? '?'} 轮第 ${payload?.step ?? '?'} 步出错：\n${errorMsg}`;
      dispatchNotification({ title, body, priority: 'urgent', tags: ['x', 'warning'] });
    }
  });
}
