/* Slop AI — ui/chat: AI.ChatPanel, a message list + composer bound to one conversation. Used by Chat and Build.
 * Streaming, stop, regenerate, attachments (disk or Slop Drive), token/s stats and the agent tool loop. */
'use strict';
(function (AI) {
  const K = AI.K, E = AI.E, el = AI.el;
  const MAX_ATT = 24000;
  const TEXTY = /^(text\/|application\/(json|xml|javascript|x-sh|x-yaml|toml|sql))|image\/svg/;
  const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|js|mjs|ts|tsx|jsx|py|rb|go|rs|java|c|h|cpp|cs|php|html?|css|scss|xml|svg|ya?ml|toml|ini|sql|sh|log|srt|vtt)$/i;

  class ChatPanel {
    /** root: element to build into. opts: { kind, placeholder, onDone(conv, msg), toolsFor(conv) → tools } */
    constructor(root, opts = {}) {
      this.opts = opts; this.conv = null; this.busy = false; this.ctl = null; this.atts = [];
      this.list = el('div', { class: 'msg-list', role: 'log', 'aria-live': 'polite' });
      this.scroller = el('div', { class: 'msgs' }, this.list);
      this.input = el('textarea', { class: 'input', rows: 1, placeholder: opts.placeholder || 'Message Slop AI', 'aria-label': 'Message' });
      this.attBox = el('div', { class: 'atts pending' });
      this.btnSend = el('button', { type: 'button', class: 'send', title: 'Send (Enter)', 'aria-label': 'Send' }, AI.icon('send'));
      this.btnAttach = el('button', { type: 'button', class: 'tb', title: 'Attach a text file', 'aria-label': 'Attach a text file' }, AI.icon('clip'));
      this.stats = el('span', { class: 'live-stats faint' });
      this.composer = el('div', { class: 'composer' }, this.attBox, el('div', { class: 'comp-row' }, this.btnAttach, this.input, this.btnSend), el('div', { class: 'comp-foot' }, this.stats, el('span', { class: 'faint privacy' }, 'Runs on your device. Nothing leaves it.')));
      root.append(this.scroller, this.composer);
      this.btnSend.onclick = () => (this.busy ? this.stop() : this.send());
      this.btnAttach.onclick = (e) => this.attachMenu(e);
      this.input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!this.busy) this.send(); } });
      this.input.addEventListener('input', () => this.grow());
      // a drop on the messages is the intake's (ui/intake.js), for this panel
      if (AI.intake) AI.intake.dropOn(this.scroller, this);
      this.scroller.addEventListener('dragenter', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) this.scroller.classList.add('drop'); });
      this.scroller.addEventListener('dragleave', () => this.scroller.classList.remove('drop'));
      this.scroller.addEventListener('drop', () => this.scroller.classList.remove('drop')); // intake-ok: only the highlight; the files are the intake's
      AI.wireMessageActions(this.list, () => this.conv, { onRegen: () => this.regenerate() });
      AI.on('engine', () => this.syncButtons());
    }
    grow() { this.input.style.height = 'auto'; this.input.style.height = Math.min(220, this.input.scrollHeight) + 'px'; }
    setConv(c) { if (this.busy) this.stop(); this.conv = c; this.render(); this.syncButtons(); }
    render() {
      AI.renderMessages(this.list, this.conv, { onRegen: () => this.regenerate() });
      if (!this.conv || !this.conv.messages.length) this.list.append(this.opts.empty ? this.opts.empty() : el('div'));
      this.scrollEnd(true);
    }
    scrollEnd(force) { const s = this.scroller; if (force || s.scrollHeight - s.scrollTop - s.clientHeight < 120) s.scrollTop = s.scrollHeight; }
    syncButtons() {
      this.btnSend.replaceChildren(AI.icon(this.busy ? 'stop' : 'send'));
      this.btnSend.title = this.busy ? 'Stop' : 'Send (Enter)';
      this.btnSend.classList.toggle('stop', this.busy);
      this.composer.classList.toggle('no-model', !E.ready());
    }

    /* ---------- attachments ---------- */
    attachMenu(e) {
      const r = this.btnAttach.getBoundingClientRect();
      window.SlopUI.menu([
        { label: 'From this computer…', act: () => AI.intake.attachFromComputer(this) },
        { label: 'From Slop Drive…', disabled: !window.SlopHub, act: () => AI.intake.attachFromDrive(this) },
      ], r.left, r.top - 80);
    }
    async addFiles(files) {
      for (const f of [].concat(files || [])) {
        if (!f) continue;
        if (!TEXTY.test(f.type || '') && !TEXT_EXT.test(f.name)) { AI.toast(`${f.name}: only text files can be attached for now`); continue; }
        let text = await f.text();
        const cut = text.length > MAX_ATT;
        if (cut) text = text.slice(0, MAX_ATT);
        this.atts.push({ name: f.name, size: f.size, text, cut });
      }
      this.renderAtts();
    }
    renderAtts() {
      this.attBox.replaceChildren(...this.atts.map((a, i) => el('span', { class: 'att' }, AI.icon('clip'), a.name, a.cut ? el('small', null, 'first 24k chars') : el('small', null, AI.fmtBytes(a.size)),
        el('button', { type: 'button', class: 'x', 'aria-label': 'Remove ' + a.name, onclick: () => { this.atts.splice(i, 1); this.renderAtts(); } }, '×'))));
    }

    /* ---------- generation ---------- */
    async ensureConv() { if (!this.conv) { this.conv = AI.db.blank(this.opts.kind || 'chat'); if (this.opts.onCreate) this.opts.onCreate(this.conv); } return this.conv; }
    async send(text) {
      text = text != null ? text : this.input.value.trim();
      if (!text && !this.atts.length) return;
      if (!E.ready()) { AI.toast('Load a model first'); AI.setTab('models'); return; }
      const c = await this.ensureConv();
      const atts = this.atts.splice(0);
      const content = [text, ...atts.map((a) => `Attached file: ${a.name}${a.cut ? ' (first part)' : ''}\n\`\`\`\n${a.text}\n\`\`\``)].join('\n\n');
      c.messages.push({ role: 'user', content, display: text, attachments: atts.map((a) => ({ name: a.name, size: a.size })), time: Date.now() });
      if (/^New (chat|mini-app)$/.test(c.title) && text) c.title = text.replace(/\s+/g, ' ').slice(0, 48);
      this.input.value = ''; this.grow(); this.renderAtts();
      this.render();
      await AI.db.put(c);
      return this.generate();
    }
    stop() { if (this.ctl) this.ctl.abort(); }
    async regenerate() {
      if (this.busy || !this.conv) return;
      const ms = this.conv.messages;
      while (ms.length && ms[ms.length - 1].role !== 'user') ms.pop();
      if (!ms.length) return;
      this.render();
      return this.generate();
    }
    async generate() {
      const c = this.conv, eng = E.active();
      if (!eng) { AI.toast('Load a model first'); return; }
      this.busy = true; this.ctl = new AbortController(); this.syncButtons();
      const tools = this.opts.toolsFor ? this.opts.toolsFor(c) : [];
      const msgs = [{ role: 'system', content: AI.systemFor(c) }, ...c.messages.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content, name: m.name }))];
      const lives = [];
      const live = (step) => (lives[step] = lives[step] || AI.liveMsg(this.list));
      const t0 = performance.now();
      let n = 0;
      if (window.SlopGuard) SlopGuard.setUnsaved('slop-ai-gen', true);
      try {
        const res = await K.tools.run(eng, msgs, {
          tools, maxSteps: tools.length ? 4 : 1, temperature: c.temperature, max_tokens: c.maxTokens, signal: this.ctl.signal,
          // the site's AI permissions (shared/ai/permissions.js): "Allow everything" asks nothing, rules are per app
          env: { confirm: (title, msg) => window.SlopUI.confirm(title, msg, 'Allow'), permit: window.SlopAIPermissions ? (req) => window.SlopAIPermissions.ask(Object.assign({ app: 'ai', appName: 'Slop AI' }, req)) : undefined },
          onDelta: (t, step) => { live(step).add(t); n++; this.stats.textContent = `${n} tokens · ${(n / ((performance.now() - t0) / 1000)).toFixed(1)} tok/s`; this.scrollEnd(); },
          onTool: ({ phase, call, res: r }) => { if (phase === 'end') { lives.forEach((l) => l && l.end()); this.list.append(AI.msgEl({ role: 'tool', name: call.name, content: r.ok ? r.result : r.error, ok: r.ok }, -1)); } },
        });
        for (const m of res.messages) c.messages.push(Object.assign(m, { time: Date.now(), model: eng.info().id }));
        const lastBot = res.messages.filter((m) => m.role === 'assistant').pop();
        this.stats.textContent = lastBot ? AI.statsText(lastBot.usage) : '';
        if (this.ctl.signal.aborted && lastBot) lastBot.stopped = true;
        if (this.opts.onDone) this.opts.onDone(c, lastBot);
      } catch (e) {
        c.messages.push({ role: 'assistant', content: '', display: '⚠️ ' + ((e && e.message) || e), error: true, time: Date.now() });
      }
      lives.forEach((l) => l && l.end());
      c.model = (E.label() || '');
      try { await AI.db.put(c); } catch (e) { AI.toast('Could not save the chat: ' + e.message); }
      if (this.conv === c) this.render();
      this.busy = false; this.ctl = null; this.syncButtons(); // only now: the list shows the saved messages
      if (window.SlopGuard) SlopGuard.setUnsaved('slop-ai-gen', false);
      return c;
    }
  }
  AI.ChatPanel = ChatPanel;
})(window.AI);
