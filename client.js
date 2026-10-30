window.__ModuleLoader__.load({
  id: 'dsh-push-notify',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;
    const useState = React.useState;
    const useEffect = React.useEffect;
    const useRef = React.useRef;

    const SETTINGS_NAV_MARKER = 'data-dsh-push-notify-nav';

    const SOUND_OPTIONS = [
      { id: 'bell', label: '清脆铃声 (Bell · 经典首选)' },
      { id: 'chime', label: '清幽和弦 (Chime · 优雅轻快)' },
      { id: 'glass', label: '清脆玻璃 (Glass · 灵动微响)' },
      { id: 'electronic', label: '电子提示 (Electronic · 经典蜂鸣)' },
      { id: 'horn', label: '短促号角 (Horn · 提示清晰)' },
      { id: 'anticipate', label: '期待提示 (Anticipate · 舒缓柔和)' },
      { id: 'bloom', label: '花开轻响 (Bloom · 悦耳短促)' },
      { id: 'calypso', label: '加勒比旋律 (Calypso · 欢快节奏)' },
      { id: 'paymentsuccess', label: '成功到账音 (Payment Success)' },
      { id: 'minuet', label: '小步舞曲 (Minuet · 偏长古典)' },
      { id: 'silence', label: '完全静音 (Silence · 仅振动亮屏)' },
    ];

    const NTFY_PRIORITIES = [
      { id: 'min', label: '极低 (Min · 不振动不响铃)' },
      { id: 'low', label: '低 (Low · 无声通知)' },
      { id: 'default', label: '默认 (Default · 标准通知响铃)' },
      { id: 'high', label: '高 (High · 响铃弹窗)' },
      { id: 'urgent', label: '紧急 (Urgent · 突破免打扰)' },
    ];

    function api(path) {
      const relative = path.replace(/^\/+/, '');
      if (typeof document === 'undefined') return `/${relative}`;
      return new URL(relative, document.baseURI).pathname;
    }

    const CSS = `
      .push-settings-wrap {
        padding: 24px 32px 32px 32px;
        max-width: 720px;
        display: flex;
        flex-direction: column;
        gap: 24px;
        color: var(--dsw-alias-label-primary, #1a1a1a);
        font-family: inherit;
        box-sizing: border-box;
      }
      .push-title-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .push-title-icon {
        width: 28px;
        height: 28px;
        flex-shrink: 0;
      }
      .push-title-text {
        font-size: 18px;
        font-weight: 600;
        line-height: 26px;
      }
      .push-desc-text {
        font-size: 13px;
        color: var(--dsw-alias-label-secondary, #666);
        line-height: 20px;
        margin-top: 2px;
      }
      .push-card {
        background: var(--dsw-alias-bg-layer-3, rgba(0, 0, 0, 0.02));
        border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08));
        border-radius: var(--dsw-radius-lg, 12px);
        padding: 18px 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .push-card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 8px;
        border-bottom: 0.5px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.06));
      }
      .push-card-head-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .push-card-badge {
        font-size: 11px;
        font-weight: 600;
        padding: 2px 7px;
        border-radius: 4px;
        text-transform: uppercase;
      }
      .badge-bark {
        background: rgba(255, 59, 48, 0.12);
        color: #d70015;
      }
      .badge-ntfy {
        background: rgba(0, 122, 255, 0.12);
        color: #007aff;
      }
      .push-card-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--dsw-alias-label-primary, #1a1a1a);
      }
      .push-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .push-label {
        font-size: 13px;
        font-weight: 500;
        color: var(--dsw-alias-label-primary, #1a1a1a);
      }
      .push-hint {
        font-size: 12px;
        color: var(--dsw-alias-label-tertiary, #999);
      }
      .push-input, .push-select {
        box-sizing: border-box;
        width: 100%;
        height: 36px;
        padding: 0 12px;
        border-radius: var(--dsw-radius-md, 8px);
        border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.15));
        background: var(--dsw-alias-bg-layer-1, #fff);
        color: var(--dsw-alias-label-primary, #1a1a1a);
        font-size: 13px;
        outline: none;
        transition: border-color 0.15s ease;
      }
      .push-input:focus, .push-select:focus {
        border-color: var(--dsw-alias-brand-primary-new-colorprimary-new-color, #247bbf);
      }
      .push-toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 0;
        border-bottom: 0.5px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.06));
      }
      .push-toggle-row:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }
      .push-toggle-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .push-toggle-label {
        font-size: 13px;
        font-weight: 500;
        color: var(--dsw-alias-label-primary, #1a1a1a);
      }
      .push-toggle-desc {
        font-size: 12px;
        color: var(--dsw-alias-label-secondary, #666);
      }
      /* Custom switch */
      .push-switch {
        position: relative;
        display: inline-block;
        width: 40px;
        height: 22px;
        flex-shrink: 0;
      }
      .push-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .push-slider {
        position: absolute;
        cursor: pointer;
        top: 0; left: 0; right: 0; bottom: 0;
        background-color: var(--dsw-alias-border-l1, #ccc);
        border-radius: 22px;
        transition: .2s;
      }
      .push-slider:before {
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        border-radius: 50%;
        transition: .2s;
      }
      .push-switch input:checked + .push-slider {
        background-color: var(--dsw-alias-brand-primary-new-colorprimary-new-color, #247bbf);
      }
      .push-switch input:checked + .push-slider:before {
        transform: translateX(18px);
      }
      .push-actions {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 4px;
      }
      .push-btn {
        height: 36px;
        padding: 0 16px;
        border-radius: var(--dsw-radius-md, 8px);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid transparent;
        transition: all 0.15s ease;
      }
      .push-btn-primary {
        background: var(--dsw-alias-brand-primary-new-colorprimary-new-color, #247bbf);
        color: #fff;
      }
      .push-btn-primary:hover {
        opacity: 0.9;
      }
      .push-btn-secondary {
        background: var(--dsw-alias-bg-layer-2, #f5f5f5);
        border-color: var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.15));
        color: var(--dsw-alias-label-primary, #1a1a1a);
      }
      .push-btn-secondary:hover {
        background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05));
      }
      .push-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      /* Message Toast Banner */
      .push-msg {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
        font-weight: 500;
        padding: 12px 18px;
        border-radius: var(--dsw-radius-md, 8px);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
        animation: pushFadeIn 0.25s ease-out;
      }
      .push-msg-text {
        flex: 1;
        line-height: 1.5;
      }
      .push-msg-close {
        cursor: pointer;
        opacity: 0.6;
        font-size: 16px;
        font-weight: 600;
        padding: 0 4px;
        transition: opacity 0.15s ease;
      }
      .push-msg-close:hover {
        opacity: 1;
      }
      @keyframes pushFadeIn {
        from { opacity: 0; transform: translateY(-6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .push-msg-success {
        background: rgba(52, 199, 89, 0.12);
        color: #248a3d;
        border: 1px solid rgba(52, 199, 89, 0.3);
      }
      .push-msg-error {
        background: rgba(255, 59, 48, 0.12);
        color: #d70015;
        border: 1px solid rgba(255, 59, 48, 0.3);
      }
      /* Left Nav Icon */
      [data-dsh-push-notify-nav] svg {
        display: none !important;
      }
      [data-dsh-push-notify-nav]::before {
        content: "";
        display: inline-block;
        width: 16px;
        height: 16px;
        margin-right: 8px;
        flex-shrink: 0;
        background-repeat: no-repeat;
        background-position: center;
        background-size: contain;
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23247bbf"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>');
      }
    `;

    function PushSection() {
      const [form, setForm] = useState({
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
      });
      const [saving, setSaving] = useState(false);
      const [testingChannel, setTestingChannel] = useState(null); // 'bark' | 'ntfy' | 'all' | null
      const [message, setMessage] = useState(null);
      const timerRef = useRef(null);

      const showMessage = (msg) => {
        setMessage(msg);
        if (timerRef.current) clearTimeout(timerRef.current);
        if (msg) {
          timerRef.current = setTimeout(() => {
            setMessage(null);
          }, 6000);
        }
      };

      useEffect(() => {
        fetch(api('/dsh-push-notify/config'), { cache: 'no-store' })
          .then((r) => r.json())
          .then((data) => {
            if (data && data.ok && data.config) {
              setForm((prev) => ({
                ...prev,
                ...data.config,
                bark: { ...prev.bark, ...(data.config.bark || {}) },
                ntfy: { ...prev.ntfy, ...(data.config.ntfy || {}) },
              }));
            }
          })
          .catch((e) => {
            console.error('[push-notify] load config error:', e);
          });
      }, []);

      const updateRoot = (key, val) => {
        setForm((prev) => ({ ...prev, [key]: val }));
      };

      const updateBark = (key, val) => {
        setForm((prev) => ({ ...prev, bark: { ...prev.bark, [key]: val } }));
      };

      const updateNtfy = (key, val) => {
        setForm((prev) => ({ ...prev, ntfy: { ...prev.ntfy, [key]: val } }));
      };

      const handleSave = async () => {
        setSaving(true);
        showMessage(null);
        try {
          const res = await fetch(api('/dsh-push-notify/config'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
          });
          const data = await res.json();
          if (data && data.ok) {
            showMessage({ type: 'success', text: '✅ 通知配置已成功保存并即时生效！' });
          } else {
            showMessage({ type: 'error', text: '❌ 保存失败: ' + (data?.error || '未知错误') });
          }
        } catch (e) {
          showMessage({ type: 'error', text: '❌ 保存异常: ' + (e.message || String(e)) });
        } finally {
          setSaving(false);
        }
      };

      const handleTest = async (channel) => {
        setTestingChannel(channel);
        showMessage(null);
        try {
          const res = await fetch(api('/dsh-push-notify/test'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel, config: form }),
          });
          const data = await res.json();
          if (data && data.ok && data.feedback) {
            const fb = data.feedback;
            const errors = [];
            const successes = [];
            if (fb.bark) {
              if (fb.bark.ok) successes.push('Bark');
              else errors.push(`Bark 失败: ${fb.bark.message}`);
            }
            if (fb.ntfy) {
              if (fb.ntfy.ok) successes.push('ntfy');
              else errors.push(`ntfy 失败: ${fb.ntfy.message}`);
            }

            if (errors.length === 0 && successes.length > 0) {
              showMessage({ type: 'success', text: `🎉 [${successes.join(' & ')}] 测试通知已成功发出，请在客户端查收！` });
            } else if (errors.length > 0 && successes.length > 0) {
              showMessage({ type: 'error', text: `⚠️ [${successes.join(', ')}] 发送成功，但 ${errors.join('；')}` });
            } else {
              showMessage({ type: 'error', text: `❌ 发送失败: ${errors.join('；') || '请检查配置'}` });
            }
          } else {
            showMessage({ type: 'error', text: '❌ 测试失败: ' + (data?.error || '未知响应') });
          }
        } catch (e) {
          showMessage({ type: 'error', text: '❌ 测试请求异常: ' + (e.message || String(e)) });
        } finally {
          setTestingChannel(null);
        }
      };

      const renderMessageBox = () => {
        if (!message) return null;
        return h('div', {
          className: `push-msg ${message.type === 'success' ? 'push-msg-success' : 'push-msg-error'}`
        },
          h('span', { className: 'push-msg-text' }, message.text),
          h('span', {
            className: 'push-msg-close',
            onClick: () => setMessage(null),
            title: '关闭提示'
          }, '✕')
        );
      };

      return h(
        'div',
        { className: 'push-settings-wrap' },
        // Header
        h('div', { className: 'push-title-row' },
          h('svg', {
            className: 'push-title-icon',
            viewBox: '0 0 24 24',
            fill: '#247bbf'
          }, h('path', {
            d: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z'
          })),
          h('div', null,
            h('div', { className: 'push-title-text' }, '推送通知设置 (Push Notifications)'),
            h('div', { className: 'push-desc-text' }, '当 AI 回合结束、等待操作批准或等待输入时，向 Bark 或 ntfy 实时推送通知。')
          )
        ),

        // Top Message Toast (保持顶部也可见)
        renderMessageBox(),

        // Card 1: Bark (iOS)
        h('div', { className: 'push-card' },
          h('div', { className: 'push-card-head' },
            h('div', { className: 'push-card-head-left' },
              h('span', { className: 'push-card-badge badge-bark' }, 'Bark'),
              h('div', { className: 'push-card-title' }, 'Bark 推送通道 (iOS)')
            ),
            h('label', { className: 'push-switch' },
              h('input', {
                type: 'checkbox',
                checked: !!form.bark.enabled,
                onChange: (e) => updateBark('enabled', e.target.checked),
              }),
              h('span', { className: 'push-slider' })
            )
          ),

          form.bark.enabled && h(React.Fragment, null,
            h('div', { className: 'push-field' },
              h('label', { className: 'push-label' }, 'Bark 服务器 URL'),
              h('input', {
                className: 'push-input',
                type: 'text',
                value: form.bark.serverUrl,
                placeholder: 'https://api.day.app 或 自建服务器地址',
                onChange: (e) => updateBark('serverUrl', e.target.value),
              }),
              h('span', { className: 'push-hint' }, '官方服务填写 https://api.day.app，自建服务填完整 HTTP/HTTPS 地址')
            ),

            h('div', { className: 'push-field' },
              h('label', { className: 'push-label' }, 'Bark Device Key'),
              h('input', {
                className: 'push-input',
                type: 'text',
                value: form.bark.deviceKey,
                placeholder: '手机 Bark App 首页获取的设备 Key',
                onChange: (e) => updateBark('deviceKey', e.target.value),
              })
            ),

            h('div', { className: 'push-field' },
              h('label', { className: 'push-label' }, 'Bark 提示音 (Sound)'),
              h('select', {
                className: 'push-select',
                value: form.bark.sound || 'bell',
                onChange: (e) => updateBark('sound', e.target.value),
              }, SOUND_OPTIONS.map((opt) => h('option', { key: opt.id, value: opt.id }, opt.label)))
            )
          )
        ),

        // Card 2: ntfy (Multi-platform)
        h('div', { className: 'push-card' },
          h('div', { className: 'push-card-head' },
            h('div', { className: 'push-card-head-left' },
              h('span', { className: 'push-card-badge badge-ntfy' }, 'ntfy'),
              h('div', { className: 'push-card-title' }, 'ntfy 推送通道 (Android / iOS / Web / Desktop)')
            ),
            h('label', { className: 'push-switch' },
              h('input', {
                type: 'checkbox',
                checked: !!form.ntfy.enabled,
                onChange: (e) => updateNtfy('enabled', e.target.checked),
              }),
              h('span', { className: 'push-slider' })
            )
          ),

          form.ntfy.enabled && h(React.Fragment, null,
            h('div', { className: 'push-field' },
              h('label', { className: 'push-label' }, 'ntfy 服务器 URL'),
              h('input', {
                className: 'push-input',
                type: 'text',
                value: form.ntfy.serverUrl,
                placeholder: 'https://ntfy.sh 或 自建 ntfy 服务器',
                onChange: (e) => updateNtfy('serverUrl', e.target.value),
              }),
              h('span', { className: 'push-hint' }, '官方服务填写 https://ntfy.sh，自建填对应地址')
            ),

            h('div', { className: 'push-field' },
              h('label', { className: 'push-label' }, 'Topic (主题名)'),
              h('input', {
                className: 'push-input',
                type: 'text',
                value: form.ntfy.topic,
                placeholder: '订阅的 Topic 名称，例如 my-dsh-topic-8982',
                onChange: (e) => updateNtfy('topic', e.target.value),
              }),
              h('span', { className: 'push-hint' }, '在手机/浏览器端订阅同名 Topic 即可接收通知')
            ),

            h('div', { className: 'push-field' },
              h('label', { className: 'push-label' }, '默认优先级 (Priority)'),
              h('select', {
                className: 'push-select',
                value: form.ntfy.priority || 'default',
                onChange: (e) => updateNtfy('priority', e.target.value),
              }, NTFY_PRIORITIES.map((opt) => h('option', { key: opt.id, value: opt.id }, opt.label)))
            ),

            h('div', { className: 'push-field' },
              h('label', { className: 'push-label' }, 'Access Token (可选)'),
              h('input', {
                className: 'push-input',
                type: 'password',
                value: form.ntfy.token,
                placeholder: '若 Topic 设有写入鉴权权限，请填入 Token',
                onChange: (e) => updateNtfy('token', e.target.value),
              }),
              h('span', { className: 'push-hint' }, '公开公共 Topic 留空即可')
            )
          )
        ),

        // Card 3: Common Settings (Web URL & Triggers)
        h('div', { className: 'push-card' },
          h('div', { className: 'push-card-title' }, '通用配置 & 触发时机'),

          h('div', { className: 'push-field' },
            h('label', { className: 'push-label' }, '点击通知跳转地址 (Web UI URL)'),
            h('input', {
              className: 'push-input',
              type: 'text',
              value: form.webUrl,
              placeholder: 'http://127.0.0.1:3080 或局域网/公网访问地址',
              onChange: (e) => updateRoot('webUrl', e.target.value),
            }),
            h('span', { className: 'push-hint' }, '手机收到通知点击后可直接唤起该页面进行审批或对话')
          ),

          h('div', { className: 'push-toggle-row' },
            h('div', { className: 'push-toggle-info' },
              h('div', { className: 'push-toggle-label' }, '等待操作批准 (Approval)'),
              h('div', { className: 'push-toggle-desc' }, 'Agent 需要执行高权限操作或修改系统文件等待您确认时')
            ),
            h('label', { className: 'push-switch' },
              h('input', {
                type: 'checkbox',
                checked: !!form.notifyOnApproval,
                onChange: (e) => updateRoot('notifyOnApproval', e.target.checked),
              }),
              h('span', { className: 'push-slider' })
            )
          ),

          h('div', { className: 'push-toggle-row' },
            h('div', { className: 'push-toggle-info' },
              h('div', { className: 'push-toggle-label' }, '等待回答/确认 (User Questions)'),
              h('div', { className: 'push-toggle-desc' }, 'Agent 提出单选/多选题或计划审核等待您输入时')
            ),
            h('label', { className: 'push-switch' },
              h('input', {
                type: 'checkbox',
                checked: !!form.notifyOnQuestion,
                onChange: (e) => updateRoot('notifyOnQuestion', e.target.checked),
              }),
              h('span', { className: 'push-slider' })
            )
          ),

          h('div', { className: 'push-toggle-row' },
            h('div', { className: 'push-toggle-info' },
              h('div', { className: 'push-toggle-label' }, '对话回合结束 (Turn End)'),
              h('div', { className: 'push-toggle-desc' }, 'AI 思考和多步工具调用执行完成，等待您下一步指令时')
            ),
            h('label', { className: 'push-switch' },
              h('input', {
                type: 'checkbox',
                checked: !!form.notifyOnTurnEnd,
                onChange: (e) => updateRoot('notifyOnTurnEnd', e.target.checked),
              }),
              h('span', { className: 'push-slider' })
            )
          ),

          h('div', { className: 'push-toggle-row' },
            h('div', { className: 'push-toggle-info' },
              h('div', { className: 'push-toggle-label' }, '运行异常提醒 (Agent Error)'),
              h('div', { className: 'push-toggle-desc' }, 'Agent 执行发生未捕获的错误时')
            ),
            h('label', { className: 'push-switch' },
              h('input', {
                type: 'checkbox',
                checked: !!form.notifyOnError,
                onChange: (e) => updateRoot('notifyOnError', e.target.checked),
              }),
              h('span', { className: 'push-slider' })
            )
          )
        ),

        // Actions & Bottom Feedback Area
        h('div', { className: 'push-actions' },
          h('button', {
            className: 'push-btn push-btn-primary',
            onClick: handleSave,
            disabled: saving || testingChannel !== null,
          }, saving ? '保存中...' : '保存配置'),

          form.bark.enabled && h('button', {
            className: 'push-btn push-btn-secondary',
            onClick: () => handleTest('bark'),
            disabled: saving || testingChannel !== null || !form.bark.deviceKey,
          }, testingChannel === 'bark' ? '正在测试 Bark...' : '测试 Bark 推送'),

          form.ntfy.enabled && h('button', {
            className: 'push-btn push-btn-secondary',
            onClick: () => handleTest('ntfy'),
            disabled: saving || testingChannel !== null || !form.ntfy.topic,
          }, testingChannel === 'ntfy' ? '正在测试 ntfy...' : '测试 ntfy 推送'),

          form.bark.enabled && form.ntfy.enabled && h('button', {
            className: 'push-btn push-btn-secondary',
            onClick: () => handleTest('all'),
            disabled: saving || testingChannel !== null,
          }, testingChannel === 'all' ? '正在全部测试...' : '测试全部通道')
        ),

        // Bottom Message Toast (在保存/测试按钮正下方直接显示，无需往上滑动！)
        renderMessageBox()
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        // 1. 注入 CSS 样式
        if (typeof document !== 'undefined' && !document.getElementById('dsh-push-notify-css')) {
          const style = document.createElement('style');
          style.id = 'dsh-push-notify-css';
          style.textContent = CSS;
          document.head.appendChild(style);
        }

        // 2. 注册左侧导航图标同步
        let disposed = false;
        let frame = null;
        const targetNavName = '通知推送';
        const syncNav = () => {
          if (disposed) return;
          const buttons = document.querySelectorAll('[role="dialog"] nav button');
          for (const button of buttons) {
            if (button.textContent?.trim() === targetNavName) {
              button.setAttribute(SETTINGS_NAV_MARKER, '');
            }
          }
        };
        const schedule = () => {
          if (disposed || frame !== null) return;
          frame = requestAnimationFrame(() => {
            frame = null;
            syncNav();
          });
        };
        syncNav();
        const observer = new MutationObserver(schedule);
        observer.observe(document.body, { childList: true, subtree: true });

        ctx.effect(() => () => {
          disposed = true;
          observer.disconnect();
          if (frame !== null) cancelAnimationFrame(frame);
          document.querySelectorAll(`[${SETTINGS_NAV_MARKER}]`).forEach((el) => {
            el.removeAttribute(SETTINGS_NAV_MARKER);
          });
        });

        // 3. 注册到 settings.section
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'push-notify',
          order: 25,
          label: () => targetNavName,
        }, PushSection));
      },
    };
  },
});
