/* global React, ReactDOM, WeeklyDB */
const { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } = React;

// ---------- Date helpers ----------
const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_LONG  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS    = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function fromKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d, n) {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}
function startOfWeekSat(d) {
  // Week starts on Saturday (per original spec Sat-Fri).
  const x = new Date(d);
  const dow = x.getDay(); // 0=Sun..6=Sat
  const diff = (dow - 6 + 7) % 7; // distance back to Saturday
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtDate(d) {
  return `${DOW_LONG[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
function fmtMonthYear(d) { return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }

const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
const TODAY_KEY = toKey(TODAY);
const THEME_KEY = 'weekly-todo-theme';

// ---------- Tag parsing ----------
const TAG_RE = /(^|\s)(#[\w-]+)/g;
function extractTags(s) {
  const out = new Set();
  if (!s) return [];
  let m; const re = new RegExp(TAG_RE);
  while ((m = re.exec(s)) !== null) out.add(m[2].toLowerCase());
  return [...out];
}
function renderWithTags(text, onTag) {
  if (!text) return null;
  const parts = [];
  let last = 0;
  const re = /(#[\w-]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tag = m[1];
    parts.push(
      <button
        key={m.index}
        className="tag-chip"
        onClick={(e) => { e.stopPropagation(); onTag && onTag(tag); }}
      >{tag}</button>
    );
    last = m.index + tag.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// ---------- Theme ----------
function useTheme() {
  const [pref, setPref] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || 'system'; } catch { return 'system'; }
  });
  const [systemDark, setSystemDark] = useState(() =>
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
    return () => { mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange); };
  }, []);
  const isDark = pref === 'dark' || (pref === 'system' && systemDark);
  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    try { localStorage.setItem(THEME_KEY, pref); } catch {}
  }, [isDark, pref]);
  return { pref, setPref, isDark };
}

// ---------- Icons ----------
const Icon = {
  Sun: (p) => (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>),
  Moon:(p) => (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>),
  Plus:(p) => (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14"/></svg>),
  Trash:(p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/><path d="M10 11v6M14 11v6"/></svg>),
  Check:(p) => (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12.5l4.5 4.5L19 7"/></svg>),
  Chevron:(p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 6l6 6-6 6"/></svg>),
  Calendar:(p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>),
  Search:(p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>),
  Pen:(p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>),
  Highlighter:(p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 11l-4 4v4h4l4-4"/><path d="M9 11l6-6 4 4-6 6"/></svg>),
  Eraser:(p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M16 3l5 5-9 9H7l-3-3 9-9z"/><path d="M8 21h13"/></svg>),
  Undo:(p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H9"/></svg>),
  Tag:(p) => (<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 12.5L12.5 20a2 2 0 0 1-2.83 0L3 13.34V3h10.34L20 9.66a2 2 0 0 1 0 2.83z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>),
  X:(p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M6 6l12 12M18 6l-12 12"/></svg>),
};

// ---------- App ----------
function App() {
  const { pref, setPref, isDark } = useTheme();

  const [dateKey, setDateKey] = useState(TODAY_KEY);
  const [weekStart, setWeekStart] = useState(() => startOfWeekSat(TODAY));
  const [groups, setGroups] = useState([]);
  const [todos, setTodos] = useState([]);
  const [strokes, setStrokes] = useState([]);
  const [direction, setDirection] = useState(0);
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [drawOpen, setDrawOpen] = useState(false);
  const lastIdxRef = useRef(0);

  // Load
  useEffect(() => {
    (async () => {
      // One-time cleanup: previous builds shipped seeded sample tasks. Wipe them
      // for any existing install, exactly once. New installs no-op.
      try {
        if (!localStorage.getItem('weekly-todo-seed-wiped-v1')) {
          await WeeklyDB.clearAll();
          localStorage.setItem('weekly-todo-seed-wiped-v1', '1');
        }
      } catch (_) {}
      const [g, t, s] = await Promise.all([
        WeeklyDB.getAllGroups(), WeeklyDB.getAllTodos(), WeeklyDB.getAllStrokes(),
      ]);
      setGroups(g); setTodos(t); setStrokes(s);
    })();
  }, []);

  const goToDate = (newKey) => {
    const oldD = fromKey(dateKey); const newD = fromKey(newKey);
    setDirection(newD > oldD ? 1 : newD < oldD ? -1 : 0);
    setDateKey(newKey);
    // If new date is outside current week, shift the rail.
    const ws = startOfWeekSat(newD);
    if (ws.getTime() !== weekStart.getTime()) setWeekStart(ws);
  };

  const shiftWeek = (n) => {
    const ws = addDays(weekStart, n * 7);
    setWeekStart(ws);
  };

  // Mutations
  const addGroup = async () => {
    const order = groups.filter((g) => g.dateKey === dateKey).length;
    const g = { id: WeeklyDB.uid('g'), dateKey, title: 'New list', order, collapsed: false };
    setGroups((p) => [...p, g]);
    await WeeklyDB.putGroup(g);
  };
  const updateGroup = async (id, patch) => {
    let next;
    setGroups((p) => { next = p.map((g) => g.id === id ? { ...g, ...patch } : g); return next; });
    const g = next.find((x) => x.id === id);
    if (g) await WeeklyDB.putGroup(g);
  };
  const removeGroup = async (id) => {
    setGroups((p) => p.filter((g) => g.id !== id));
    setTodos((p) => p.filter((t) => t.groupId !== id));
    await WeeklyDB.deleteGroup(id);
  };
  const addTodo = async (groupId) => {
    const order = todos.filter((t) => t.groupId === groupId).length;
    const t = { id: WeeklyDB.uid('t'), groupId, title: '', done: false, order, createdAt: Date.now(), _justAdded: true };
    setTodos((p) => [...p, t]);
    const persist = { ...t }; delete persist._justAdded;
    await WeeklyDB.putTodo(persist);
  };
  const updateTodo = async (id, patch) => {
    let next;
    setTodos((p) => { next = p.map((t) => t.id === id ? { ...t, ...patch } : t); return next; });
    const t = next.find((x) => x.id === id);
    if (t) { const persist = { ...t }; delete persist._justAdded; await WeeklyDB.putTodo(persist); }
  };
  const removeTodo = async (id) => {
    setTodos((p) => p.filter((t) => t.id !== id));
    await WeeklyDB.deleteTodo(id);
  };
  const addStroke = async (stroke) => {
    setStrokes((p) => [...p, stroke]);
    await WeeklyDB.putStroke(stroke);
  };
  const removeStroke = async (id) => {
    setStrokes((p) => p.filter((s) => s.id !== id));
    await WeeklyDB.deleteStroke(id);
  };
  const clearStrokes = async () => {
    setStrokes((p) => p.filter((s) => s.dateKey !== dateKey));
    await WeeklyDB.clearStrokesFor(dateKey);
  };
  const bulkClearDays = async (dateKeys, opts) => {
    const o = opts || { tasks: true, sketches: false };
    const keySet = new Set(dateKeys);
    if (keySet.size === 0) return;
    if (o.tasks) {
      const removedGroupIds = new Set(groups.filter((g) => keySet.has(g.dateKey)).map((g) => g.id));
      setGroups((p) => p.filter((g) => !keySet.has(g.dateKey)));
      setTodos((p) => p.filter((t) => !removedGroupIds.has(t.groupId)));
    }
    if (o.sketches) {
      setStrokes((p) => p.filter((s) => !keySet.has(s.dateKey)));
    }
    await WeeklyDB.clearDays(Array.from(keySet), o);
  };

  // Derived: groups for active day, with todos
  const dayGroups = useMemo(() => {
    return groups
      .filter((g) => g.dateKey === dateKey)
      .sort((a, b) => a.order - b.order)
      .map((g) => ({ ...g, todos: todos.filter((t) => t.groupId === g.id).sort((a, b) => a.order - b.order) }));
  }, [groups, todos, dateKey]);

  // Per-day totals (across loaded data)
  const totalsByKey = useMemo(() => {
    const map = {};
    const ensure = (k) => (map[k] ||= { done: 0, total: 0, lists: 0, strokes: 0 });
    for (const g of groups) ensure(g.dateKey).lists += 1;
    for (const t of todos) {
      const g = groups.find((x) => x.id === t.groupId);
      if (!g) continue;
      const m = ensure(g.dateKey);
      m.total += 1; if (t.done) m.done += 1;
    }
    for (const s of strokes) ensure(s.dateKey).strokes += 1;
    return map;
  }, [groups, todos, strokes]);

  // Tag index
  const allTags = useMemo(() => {
    const counts = new Map();
    for (const t of todos) for (const tag of extractTags(t.title)) counts.set(tag, (counts.get(tag) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [todos]);

  // Search results (across ALL days when search is active)
  const isSearching = search.trim().length > 0;
  const searchResults = useMemo(() => {
    if (!isSearching) return null;
    const q = search.trim().toLowerCase();
    const isTag = q.startsWith('#');
    const matches = todos.filter((t) => {
      const text = (t.title || '').toLowerCase();
      if (isTag) return extractTags(t.title).includes(q);
      return text.includes(q);
    });
    // Group by date via group lookup
    const byDate = new Map();
    for (const t of matches) {
      const g = groups.find((x) => x.id === t.groupId);
      if (!g) continue;
      const arr = byDate.get(g.dateKey) || [];
      arr.push({ todo: t, group: g });
      byDate.set(g.dateKey, arr);
    }
    return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [search, todos, groups, isSearching]);

  const currentDate = fromKey(dateKey);
  const dayStrokes = strokes.filter((s) => s.dateKey === dateKey);

  // Export / Import
  const [importMsg, setImportMsg] = useState(null);
  const exportData = async () => {
    const payload = await WeeklyDB.exportAll();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0,10);
    a.href = url; a.download = `weekly-todo-${stamp}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setImportMsg({ kind: 'ok', text: 'Exported.' });
    setTimeout(() => setImportMsg(null), 2500);
  };
  const importData = (mode) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = async (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      try {
        const text = await f.text();
        const data = JSON.parse(text);
        await WeeklyDB.importAll(data, mode);
        const [g, t, s] = await Promise.all([
          WeeklyDB.getAllGroups(), WeeklyDB.getAllTodos(), WeeklyDB.getAllStrokes(),
        ]);
        setGroups(g); setTodos(t); setStrokes(s);
        setImportMsg({ kind: 'ok', text: `Imported ${(data.groups||[]).length} lists, ${(data.todos||[]).length} tasks.` });
      } catch (err) {
        setImportMsg({ kind: 'err', text: 'Import failed: ' + err.message });
      }
      setTimeout(() => setImportMsg(null), 3500);
    };
    inp.click();
  };

  // ---------- PDF export ----------
  // Renders a print-friendly HTML doc into a hidden iframe, then triggers print().
  // On Android WebView, print() routes to PrintManager → "Save as PDF" sheet.
  const exportPdf = (scope) => {
    // scope: 'day' | 'week'
    const days = scope === 'week'
      ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
      : [fromKey(dateKey)];

    // Snapshot strokes for each printed day to inline <img> data URIs.
    const dayBlocks = days.map((d) => {
      const k = toKey(d);
      const dGroups = groups
        .filter((g) => g.dateKey === k)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const blocks = dGroups.map((g) => {
        const items = todos
          .filter((t) => t.groupId === g.id)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const done = items.filter((i) => i.done).length;
        return { group: g, items, done, total: items.length };
      });
      const dStrokes = strokes.filter((s) => s.dateKey === k);
      const sketchPng = dStrokes.length ? renderStrokesToPng(dStrokes) : null;
      const total = blocks.reduce((s, b) => s + b.total, 0);
      const doneSum = blocks.reduce((s, b) => s + b.done, 0);
      return { date: d, key: k, blocks, sketchPng, total, doneSum };
    });

    const title = scope === 'week'
      ? `Week of ${MONTHS[days[0].getMonth()].slice(0,3)} ${days[0].getDate()} – ${MONTHS[days[6].getMonth()].slice(0,3)} ${days[6].getDate()}, ${days[6].getFullYear()}`
      : `${DOW_LONG[days[0].getDay()]}, ${MONTHS[days[0].getMonth()]} ${days[0].getDate()}, ${days[0].getFullYear()}`;

    const html = buildPrintHtml({ title, scope, days: dayBlocks, isDark });
    openPrintFrame(html, title);
  };

  // Render strokes to a PNG data URI sized for print (1600×900-ish keeps file small).
  function renderStrokesToPng(dStrokes) {
    const W = 1400, H = 800;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    for (const s of dStrokes) {
      const pts = s.points;
      if (!pts || pts.length === 0) continue;
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (s.tool === 'highlighter') { ctx.globalAlpha = 0.32; ctx.globalCompositeOperation = 'multiply'; }
      else { ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      if (pts.length === 1) {
        const p = pts[0];
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, (s.width * (p.p || 0.5)) / 2 + 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i];
          const w = s.width * ((a.p + b.p) / 2 || 0.6);
          ctx.lineWidth = Math.max(0.5, w);
          ctx.beginPath();
          ctx.moveTo(a.x * W, a.y * H);
          ctx.lineTo(b.x * W, b.y * H);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    return c.toDataURL('image/png');
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[m]);
  }

  function buildPrintHtml({ title, scope, days, isDark }) {
    const css = `
      @page { size: A4; margin: 14mm; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #ffffff; color: #15161b; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 11pt; line-height: 1.45;
      }
      .doc-head {
        display: flex; align-items: baseline; justify-content: space-between;
        border-bottom: 2px solid #15161b; padding-bottom: 10pt; margin-bottom: 18pt;
      }
      .doc-title { font-size: 22pt; font-weight: 700; letter-spacing: -0.01em; margin: 0; }
      .doc-sub { font-size: 9pt; color: #5b5d68; }
      .day { page-break-inside: avoid; margin-bottom: 18pt; }
      .day + .day { border-top: 1px solid #d6d6d8; padding-top: 12pt; }
      .day-week { page-break-after: always; }
      .day-week:last-child { page-break-after: auto; }
      .day-head {
        display: flex; align-items: baseline; gap: 12pt; margin-bottom: 10pt;
      }
      .day-h { font-size: 16pt; font-weight: 700; margin: 0; letter-spacing: -0.005em; }
      .day-date { color: #5b5d68; font-size: 10pt; }
      .day-totals { margin-left: auto; font-size: 10pt; color: #15161b;
        background: #f1f1f3; padding: 2pt 8pt; border-radius: 999pt; }
      .group { margin: 10pt 0 14pt; page-break-inside: avoid; }
      .group-h {
        display: flex; align-items: baseline; gap: 10pt;
        font-size: 12pt; font-weight: 600; margin: 0 0 4pt;
      }
      .group-count { color: #5b5d68; font-size: 9pt; font-variant-numeric: tabular-nums; }
      .group-bar { flex: 0 0 90pt; height: 4pt; background: #ececef; border-radius: 2pt; overflow: hidden; }
      .group-bar > i { display: block; height: 100%; background: #2c2e36; border-radius: 2pt; }
      ul.todos { list-style: none; padding: 0; margin: 4pt 0 0; }
      ul.todos li {
        display: flex; align-items: flex-start; gap: 8pt; padding: 3pt 0;
        page-break-inside: avoid;
      }
      ul.todos .box {
        flex: 0 0 auto; width: 11pt; height: 11pt; border: 1.2pt solid #15161b;
        border-radius: 2pt; margin-top: 2pt; position: relative; background: #fff;
      }
      ul.todos .box.done { background: #15161b; }
      ul.todos .box.done::after {
        content: ""; position: absolute; left: 2pt; top: 0pt;
        width: 4pt; height: 7pt; border-right: 1.5pt solid #fff; border-bottom: 1.5pt solid #fff;
        transform: rotate(45deg);
      }
      ul.todos .text { flex: 1; }
      ul.todos li.done .text { color: #888a93; text-decoration: line-through; }
      .empty { color: #888a93; font-style: italic; padding: 4pt 0; }
      .sketch { margin-top: 10pt; page-break-inside: avoid; }
      .sketch img { width: 100%; max-height: 110mm; object-fit: contain;
        border: 1px solid #d6d6d8; border-radius: 4pt; background: #fff; }
      .sketch-cap { font-size: 8.5pt; color: #5b5d68; margin-top: 2pt; text-align: right; }
      .doc-foot { margin-top: 14pt; padding-top: 8pt; border-top: 1px solid #ececef;
        font-size: 8pt; color: #888a93; display: flex; justify-content: space-between; }
    `;

    const dayHtml = days.map((d) => {
      const blocksHtml = d.blocks.length === 0
        ? `<div class="empty">— no lists —</div>`
        : d.blocks.map((b) => {
            const pct = b.total === 0 ? 0 : Math.round((b.done / b.total) * 100);
            const items = b.items.length === 0
              ? `<li><span class="text empty">— empty —</span></li>`
              : b.items.map((t) => `
                  <li class="${t.done ? 'done' : ''}">
                    <span class="box ${t.done ? 'done' : ''}"></span>
                    <span class="text">${escapeHtml(t.title)}</span>
                  </li>`).join('');
            return `
              <section class="group">
                <h3 class="group-h">
                  <span>${escapeHtml(b.group.title || 'Untitled')}</span>
                  <span class="group-count">${b.done}/${b.total}</span>
                  <span class="group-bar"><i style="width:${pct}%"></i></span>
                </h3>
                <ul class="todos">${items}</ul>
              </section>`;
          }).join('');
      const sketchHtml = d.sketchPng
        ? `<div class="sketch"><img src="${d.sketchPng}" alt="Sketch"/><div class="sketch-cap">Sketch · ${DOW_LONG[d.date.getDay()]}</div></div>`
        : '';
      return `
        <article class="day ${scope === 'week' ? 'day-week' : ''}">
          <header class="day-head">
            <h2 class="day-h">${DOW_LONG[d.date.getDay()]}</h2>
            <span class="day-date">${MONTHS[d.date.getMonth()]} ${d.date.getDate()}, ${d.date.getFullYear()}</span>
            <span class="day-totals">${d.doneSum} / ${d.total} done</span>
          </header>
          ${blocksHtml}
          ${sketchHtml}
        </article>`;
    }).join('');

    const subtitle = scope === 'week' ? 'Weekly export' : 'Daily export';
    const stamp = new Date().toLocaleString();
    return `<!doctype html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>${css}</style></head><body>
  <header class="doc-head">
    <div>
      <h1 class="doc-title">${escapeHtml(title)}</h1>
      <div class="doc-sub">${subtitle} · Weekly Todo</div>
    </div>
    <div class="doc-sub">${escapeHtml(stamp)}</div>
  </header>
  ${dayHtml}
  <footer class="doc-foot">
    <span>Weekly Todo</span>
    <span>Generated ${escapeHtml(stamp)}</span>
  </footer>
</body></html>`;
  }

  function openPrintFrame(html, title) {
    // Remove any previous frame
    const old = document.getElementById('__print_frame');
    if (old) old.remove();
    const iframe = document.createElement('iframe');
    iframe.id = '__print_frame';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    doc.open(); doc.write(html); doc.close();
    // Set a sensible filename hint for the system print dialog
    try { iframe.contentWindow.document.title = title; } catch (_) {}
    const triggerPrint = () => {
      try { iframe.contentWindow.focus(); } catch (_) {}
      try { iframe.contentWindow.print(); } catch (_) {}
      // Cleanup after the system print sheet is dismissed.
      // We can't reliably hook the dismissal, so remove after a generous delay.
      setTimeout(() => { try { iframe.remove(); } catch (_) {} }, 60000);
    };
    // Wait for any data: URIs (sketch images) to decode before printing.
    const imgs = doc.images ? Array.from(doc.images) : [];
    if (imgs.length === 0) {
      setTimeout(triggerPrint, 120);
    } else {
      let pending = imgs.length;
      const done = () => { if (--pending <= 0) setTimeout(triggerPrint, 120); };
      imgs.forEach((img) => {
        if (img.complete) done();
        else { img.onload = done; img.onerror = done; }
      });
      // Hard timeout in case something hangs.
      setTimeout(triggerPrint, 1500);
    }
  }

  return (
    <div className="app">
      <Sidebar
        weekStart={weekStart}
        dateKey={dateKey}
        onPickDate={goToDate}
        onShiftWeek={shiftWeek}
        onJumpToday={() => goToDate(TODAY_KEY)}
        onOpenPicker={() => setPickerOpen(true)}
        totalsByKey={totalsByKey}
        themePref={pref}
        setThemePref={setPref}
        isDark={isDark}
        allTags={allTags}
        onTag={(tag) => setSearch(tag)}
        onExport={exportData}
        onImport={importData}
        onExportPdf={exportPdf}
        onBulkClear={bulkClearDays}
        importMsg={importMsg}
      />
      <main className="main">
        <Header
          date={currentDate}
          totals={totalsByKey[dateKey] || { done: 0, total: 0 }}
          search={search}
          setSearch={setSearch}
          onAddGroup={addGroup}
          onOpenPicker={() => setPickerOpen(true)}
          onOpenDraw={() => setDrawOpen(true)}
          drawCount={dayStrokes.length}
        />

        <div className="board-viewport">
          {isSearching ? (
            <SearchResults
              results={searchResults}
              query={search}
              onClear={() => setSearch('')}
              onJump={(k) => { setSearch(''); goToDate(k); }}
              onTag={(tag) => setSearch(tag)}
              onToggle={(id, done) => updateTodo(id, { done })}
            />
          ) : (
            <DayBoard
              key={dateKey}
              direction={direction}
              date={currentDate}
              groups={dayGroups}
              onAddGroup={addGroup}
              onUpdateGroup={updateGroup}
              onRemoveGroup={removeGroup}
              onAddTodo={addTodo}
              onUpdateTodo={updateTodo}
              onRemoveTodo={removeTodo}
              onTag={(tag) => setSearch(tag)}
            />
          )}
        </div>
      </main>

      {pickerOpen && (
        <DatePicker
          initialDate={currentDate}
          totalsByKey={totalsByKey}
          onClose={() => setPickerOpen(false)}
          onPick={(d) => { setPickerOpen(false); goToDate(toKey(d)); }}
        />
      )}

      {drawOpen && (
        <DrawSheet
          date={currentDate}
          dateKey={dateKey}
          strokes={dayStrokes}
          onAdd={addStroke}
          onRemoveStroke={removeStroke}
          onClear={clearStrokes}
          onClose={() => setDrawOpen(false)}
          isDark={isDark}
        />
      )}
    </div>
  );
}

// ---------- Sidebar ----------
function Sidebar({ weekStart, dateKey, onPickDate, onShiftWeek, onJumpToday, onOpenPicker, totalsByKey, themePref, setThemePref, isDark, allTags, onTag, onExport, onImport, onExportPdf, onBulkClear, importMsg }) {
  const cycleTheme = () => {
    const next = themePref === 'light' ? 'dark' : themePref === 'dark' ? 'system' : 'light';
    setThemePref(next);
  };
  const themeLabel = themePref === 'system' ? `System (${isDark ? 'dark' : 'light'})` : themePref[0].toUpperCase() + themePref.slice(1);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthLabel = (() => {
    const last = days[6];
    if (weekStart.getMonth() === last.getMonth()) return fmtMonthYear(weekStart);
    return `${MONTHS[weekStart.getMonth()].slice(0,3)} – ${MONTHS[last.getMonth()].slice(0,3)} ${last.getFullYear()}`;
  })();

  // ---------- Selection mode ----------
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [confirm, setConfirm] = useState(null); // { action: 'tasks'|'sketches'|'both', keys: [], counts: {...} }
  const longPressRef = useRef({ id: null, x: 0, y: 0, fired: false });

  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };
  const toggleKey = (k) => {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  };
  const enterSelectWith = (k) => {
    setSelectMode(true);
    setSelected(new Set([k]));
  };

  const onDayPointerDown = (k, e) => {
    if (selectMode) return;
    const id = e.pointerId;
    longPressRef.current = { id, x: e.clientX, y: e.clientY, fired: false };
    const el = e.currentTarget;
    const timer = setTimeout(() => {
      longPressRef.current.fired = true;
      try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) {}
      enterSelectWith(k);
    }, 480);
    const cancel = () => { clearTimeout(timer); el.removeEventListener('pointerup', cancel); el.removeEventListener('pointercancel', cancel); el.removeEventListener('pointermove', onMove); };
    const onMove = (ev) => {
      const dx = ev.clientX - longPressRef.current.x;
      const dy = ev.clientY - longPressRef.current.y;
      if (dx * dx + dy * dy > 64) cancel();
    };
    el.addEventListener('pointerup', cancel, { once: true });
    el.addEventListener('pointercancel', cancel, { once: true });
    el.addEventListener('pointermove', onMove);
  };

  const onDayClick = (k) => {
    if (longPressRef.current.fired) { longPressRef.current.fired = false; return; }
    if (selectMode) toggleKey(k);
    else onPickDate(k);
  };

  const selectAllInWeek = () => {
    const next = new Set(selected);
    days.forEach((d) => next.add(toKey(d)));
    setSelected(next);
  };

  const computeCounts = (keys) => {
    let tasks = 0, lists = 0, sketches = 0;
    keys.forEach((k) => {
      const t = totalsByKey[k];
      if (t) { tasks += t.total; lists += t.lists || 0; sketches += t.strokes || 0; }
    });
    return { tasks, lists, sketches };
  };

  const askConfirm = (action) => {
    const keys = Array.from(selected);
    if (keys.length === 0) return;
    setConfirm({ action, keys, counts: computeCounts(keys) });
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const { action, keys } = confirm;
    const opts = action === 'both'
      ? { tasks: true, sketches: true }
      : action === 'sketches'
        ? { tasks: false, sketches: true }
        : { tasks: true, sketches: false };
    await onBulkClear(keys, opts);
    setConfirm(null);
    exitSelect();
  };

  return (
    <aside className={`sidebar ${selectMode ? 'is-selecting' : ''}`}>
      {selectMode ? (
        <div className="select-head">
          <button className="icon-btn" onClick={exitSelect} aria-label="Exit selection"><Icon.X/></button>
          <div className="select-head-text">
            <div className="select-count">{selected.size} day{selected.size === 1 ? '' : 's'} selected</div>
            <button className="select-all-btn" onClick={selectAllInWeek}>Select whole week</button>
          </div>
        </div>
      ) : (
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            <span className="brand-dot" /><span className="brand-dot" /><span className="brand-dot" />
          </div>
          <div className="brand-text">
            <div className="brand-name">Weekly</div>
            <div className="brand-sub">Plan · sketch · search</div>
          </div>
        </div>
      )}

      <div className="week-head">
        <button className="week-nav" onClick={() => onShiftWeek(-1)} aria-label="Previous week"><span style={{transform:'rotate(180deg)', display:'grid'}}><Icon.Chevron/></span></button>
        <button className="week-month" onClick={onOpenPicker}>{monthLabel}</button>
        <button className="week-nav" onClick={() => onShiftWeek(1)} aria-label="Next week"><Icon.Chevron/></button>
      </div>

      <nav className="day-nav" aria-label="Days of the week">
        {days.map((d) => {
          const k = toKey(d);
          const t = totalsByKey[k] || { done: 0, total: 0 };
          const pct = t.total === 0 ? 0 : Math.round((t.done / t.total) * 100);
          const active = !selectMode && k === dateKey;
          const today = k === TODAY_KEY;
          const checked = selected.has(k);
          return (
            <button
              key={k}
              className={`day-btn ${active ? 'is-active' : ''} ${today ? 'is-today' : ''} ${selectMode ? 'is-select' : ''} ${checked ? 'is-checked' : ''}`}
              onPointerDown={(e) => onDayPointerDown(k, e)}
              onClick={() => onDayClick(k)}
              aria-current={active ? 'page' : undefined}
              aria-pressed={selectMode ? checked : undefined}
            >
              <div className="day-btn-row">
                {selectMode && (
                  <span className={`day-check ${checked ? 'is-checked' : ''}`} aria-hidden>
                    {checked && <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.2 3 6.8-7"/></svg>}
                  </span>
                )}
                <span className="day-num">{d.getDate()}</span>
                <span className="day-label-wrap">
                  <span className="day-short">{DOW_SHORT[d.getDay()]}</span>
                  {today && <span className="today-pill">Today</span>}
                </span>
                <span className="day-count">{t.total === 0 ? '—' : `${t.done}/${t.total}`}</span>
              </div>
              <div className="day-progress" aria-hidden>
                <div className="day-progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </nav>

      {selectMode ? (
        <div className="select-actions">
          <button
            className="select-action danger"
            onClick={() => askConfirm('tasks')}
            disabled={selected.size === 0}
          >
            <Icon.Trash/> <span>Clear tasks</span>
          </button>
          <button
            className="select-action"
            onClick={() => askConfirm('sketches')}
            disabled={selected.size === 0}
          >
            <Icon.Eraser/> <span>Clear sketches</span>
          </button>
          <button
            className="select-action danger-strong"
            onClick={() => askConfirm('both')}
            disabled={selected.size === 0}
          >
            <Icon.Trash/> <span>Clear everything</span>
          </button>
          <button className="select-action ghost" onClick={exitSelect}>Cancel</button>
        </div>
      ) : (
        <div className="sidebar-tools">
          <button className="tool-row" onClick={onOpenPicker}>
            <span className="tool-icon"><Icon.Calendar/></span>
            <span className="tool-text">Jump to date</span>
          </button>
          <button className="tool-row" onClick={onJumpToday}>
            <span className="tool-icon today-mini" aria-hidden>{TODAY.getDate()}</span>
            <span className="tool-text">Go to today</span>
          </button>
          <button className="tool-row" onClick={() => { setSelectMode(true); setSelected(new Set()); }}>
            <span className="tool-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 12l3 3 7-7"/></svg></span>
            <span className="tool-text">Select days</span>
          </button>
          <button className="tool-row" onClick={() => onExportPdf('day')}>
            <span className="tool-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg></span>
            <span className="tool-text">Print day (PDF)</span>
          </button>
          <button className="tool-row" onClick={() => onExportPdf('week')}>
            <span className="tool-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg></span>
            <span className="tool-text">Print week (PDF)</span>
          </button>
          <button className="tool-row" onClick={onExport}>
            <span className="tool-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 8l5-5 5 5M5 21h14"/></svg></span>
            <span className="tool-text">Export backup</span>
          </button>
          <button className="tool-row" onClick={() => onImport('merge')}>
            <span className="tool-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21V9M7 16l5 5 5-5M5 3h14"/></svg></span>
            <span className="tool-text">Import (merge)</span>
          </button>
          <button className="tool-row" onClick={() => onImport('replace')}>
            <span className="tool-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg></span>
            <span className="tool-text">Import (replace)</span>
          </button>
          {importMsg && (
            <div className={`import-msg ${importMsg.kind}`}>{importMsg.text}</div>
          )}
        </div>
      )}

      {!selectMode && allTags.length > 0 && (
        <div className="tag-rail">
          <div className="tag-rail-head"><Icon.Tag/> <span>Tags</span></div>
          <div className="tag-rail-list">
            {allTags.slice(0, 12).map(([t, n]) => (
              <button key={t} className="tag-chip tag-chip-rail" onClick={() => onTag(t)}>
                {t} <span className="tag-count">{n}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sidebar-footer">
        <button className="theme-toggle" onClick={cycleTheme} aria-label={`Theme: ${themeLabel}`}>
          <span className="theme-icon">{isDark ? <Icon.Moon/> : <Icon.Sun/>}</span>
          <span className="theme-label">
            <span className="theme-label-title">Appearance</span>
            <span className="theme-label-sub">{themeLabel}</span>
          </span>
        </button>
        <div className="offline-badge"><span className="offline-dot"/> Offline ready</div>
      </div>

      {confirm && (
        <ConfirmClear
          payload={confirm}
          onCancel={() => setConfirm(null)}
          onConfirm={runConfirm}
        />
      )}
    </aside>
  );
}

// ---------- Confirm clear modal ----------
function ConfirmClear({ payload, onCancel, onConfirm }) {
  const { action, keys, counts } = payload;
  const dayLabel = (k) => {
    const d = fromKey(k);
    return `${DOW_SHORT[d.getDay()]} ${d.getDate()}`;
  };
  const summary = (() => {
    if (action === 'tasks')
      return { title: 'Clear tasks?', body: `Delete all lists and tasks for these days. Sketches will stay.`, primary: 'Clear tasks' };
    if (action === 'sketches')
      return { title: 'Clear sketches?', body: `Erase all sketch ink for these days. Tasks will stay.`, primary: 'Clear sketches' };
    return { title: 'Clear everything?', body: `Delete all lists, tasks, and sketches for these days.`, primary: 'Clear everything' };
  })();
  return (
    <div className="modal-shell" onClick={onCancel}>
      <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3 className="modal-title">{summary.title}</h3>
          <button className="modal-close" onClick={onCancel} aria-label="Close"><Icon.X/></button>
        </div>
        <div className="confirm-body">
          <p className="confirm-prose">{summary.body}</p>
          <div className="confirm-chips">
            {keys.slice(0, 14).map((k) => <span key={k} className="confirm-chip">{dayLabel(k)}</span>)}
            {keys.length > 14 && <span className="confirm-chip more">+{keys.length - 14}</span>}
          </div>
          <div className="confirm-counts">
            {action !== 'sketches' && (
              <div><b>{counts.tasks}</b> task{counts.tasks === 1 ? '' : 's'} across <b>{counts.lists}</b> list{counts.lists === 1 ? '' : 's'}</div>
            )}
            {action !== 'tasks' && (
              <div><b>{counts.sketches}</b> sketch stroke{counts.sketches === 1 ? '' : 's'}</div>
            )}
          </div>
          <p className="confirm-warn">This can't be undone. Tip: export a backup first.</p>
        </div>
        <div className="modal-foot confirm-foot">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>{summary.primary}</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Header ----------
function Header({ date, totals, search, setSearch, onAddGroup, onOpenPicker, onOpenDraw, drawCount }) {
  const pct = totals.total === 0 ? 0 : Math.round((totals.done / totals.total) * 100);
  const isToday = isSameDay(date, TODAY);
  return (
    <header className="header">
      <div className="header-left">
        <div className="eyebrow">{isToday ? 'Today' : 'Selected day'}</div>
        <h1 className="day-title">{DOW_LONG[date.getDay()]}</h1>
        <div className="day-meta">
          <button className="meta-pill" onClick={onOpenPicker}>
            <Icon.Calendar/>
            <span>{MONTHS[date.getMonth()]} {date.getDate()}, {date.getFullYear()}</span>
          </button>
          <span className="dot-sep">·</span>
          <span>{totals.done} of {totals.total} done · {pct}%</span>
        </div>
      </div>
      <div className="header-right">
        <div className="search">
          <span className="search-icon"><Icon.Search/></span>
          <input
            type="text"
            placeholder="Search or #tag"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            spellCheck={false}
          />
          {search && <button className="search-clear" onClick={() => setSearch('')} aria-label="Clear search"><Icon.X/></button>}
        </div>
        <button className="btn btn-ghost" onClick={onOpenDraw}>
          <Icon.Pen/>
          <span>Draw{drawCount ? ` · ${drawCount}` : ''}</span>
        </button>
        <button className="btn btn-primary" onClick={onAddGroup}>
          <Icon.Plus/> <span>New list</span>
        </button>
      </div>
    </header>
  );
}

// ---------- DayBoard ----------
function DayBoard({ direction, date, groups, onAddGroup, onUpdateGroup, onRemoveGroup, onAddTodo, onUpdateTodo, onRemoveTodo, onTag }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    el.style.transition = 'none';
    el.style.opacity = '0';
    el.style.transform = `translateX(${direction === 0 ? 0 : direction * 36}px)`;
    void el.offsetWidth;
    el.style.transition = 'transform 360ms cubic-bezier(.2,.7,.1,1), opacity 240ms ease';
    el.style.opacity = '1';
    el.style.transform = 'translateX(0)';
  }, [direction, date]);

  return (
    <section ref={ref} className="board" aria-label={`Todos for ${fmtDate(date)}`}>
      {groups.length === 0 ? (
        <EmptyState onAddGroup={onAddGroup} />
      ) : (
        <div className="board-grid">
          {groups.map((g, i) => (
            <Group
              key={g.id}
              group={g}
              indexInDay={i}
              onUpdate={onUpdateGroup}
              onRemove={onRemoveGroup}
              onAddTodo={onAddTodo}
              onUpdateTodo={onUpdateTodo}
              onRemoveTodo={onRemoveTodo}
              onTag={onTag}
            />
          ))}
          <button className="add-group-card" onClick={onAddGroup}>
            <Icon.Plus/>
            <span>Add list</span>
          </button>
        </div>
      )}
    </section>
  );
}

function EmptyState({ onAddGroup }) {
  return (
    <div className="empty">
      <div className="empty-art" aria-hidden>
        <div className="empty-line" style={{ width: 180 }} />
        <div className="empty-line" style={{ width: 120 }} />
        <div className="empty-line" style={{ width: 200 }} />
      </div>
      <div className="empty-title">Nothing planned yet</div>
      <div className="empty-sub">Create your first list to start filling out the day. Use <code>#tags</code> in tasks to find them later.</div>
      <button className="btn btn-primary" onClick={onAddGroup}><Icon.Plus/><span>New list</span></button>
    </div>
  );
}

// ---------- Group ----------
function Group({ group, indexInDay, onUpdate, onRemove, onAddTodo, onUpdateTodo, onRemoveTodo, onTag }) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(group.title);
  const titleRef = useRef(null);
  const collapsed = !!group.collapsed;
  useEffect(() => { setTitleDraft(group.title); }, [group.title]);
  useEffect(() => { if (editingTitle && titleRef.current) { titleRef.current.focus(); titleRef.current.select(); } }, [editingTitle]);
  const commitTitle = () => {
    setEditingTitle(false);
    const trimmed = titleDraft.trim() || 'Untitled list';
    if (trimmed !== group.title) onUpdate(group.id, { title: trimmed });
    setTitleDraft(trimmed);
  };
  const done = group.todos.filter((t) => t.done).length;
  const total = group.todos.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <article className={`group ${collapsed ? 'is-collapsed' : ''}`} style={{ animationDelay: `${indexInDay * 40}ms` }}>
      <header className="group-head">
        <button className={`group-collapse ${collapsed ? 'is-collapsed' : ''}`} onClick={() => onUpdate(group.id, { collapsed: !collapsed })} aria-label={collapsed ? 'Expand list' : 'Collapse list'}>
          <Icon.Chevron/>
        </button>
        <div className="group-title-wrap">
          {editingTitle ? (
            <input ref={titleRef} className="group-title-input" value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onBlur={commitTitle} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitTitle(); } if (e.key === 'Escape') { setTitleDraft(group.title); setEditingTitle(false); } }} />
          ) : (
            <h2 className="group-title" onClick={() => setEditingTitle(true)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setEditingTitle(true); }}>{group.title}</h2>
          )}
          <div className="group-meta">
            <span className="group-count">{done}/{total}</span>
            <div className="group-bar"><div className="group-bar-fill" style={{ width: `${pct}%` }} /></div>
          </div>
        </div>
        <button className="icon-btn danger" onClick={() => onRemove(group.id)} aria-label="Delete list"><Icon.Trash/></button>
      </header>
      <div className="group-body">
        <ul className="todo-list">
          {group.todos.map((t) => (
            <TodoItem
              key={t.id}
              todo={t}
              onToggle={() => onUpdateTodo(t.id, { done: !t.done })}
              onChangeTitle={(title) => onUpdateTodo(t.id, { title })}
              onRemove={() => onRemoveTodo(t.id)}
              onTag={onTag}
            />
          ))}
        </ul>
        <button className="add-todo" onClick={() => onAddTodo(group.id)}>
          <span className="add-todo-plus"><Icon.Plus/></span>
          <span>Add task</span>
        </button>
      </div>
    </article>
  );
}

// ---------- Todo ----------
function TodoItem({ todo, onToggle, onChangeTitle, onRemove, onTag }) {
  const [draft, setDraft] = useState(todo.title);
  const [editing, setEditing] = useState(!!todo._justAdded);
  const inputRef = useRef(null);
  useEffect(() => { setDraft(todo.title); }, [todo.title]);
  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);
  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === '' && todo.title === '') { onRemove(); return; }
    if (trimmed !== todo.title) onChangeTitle(trimmed || 'Untitled task');
    setDraft(trimmed || 'Untitled task');
  };
  return (
    <li className={`todo ${todo.done ? 'is-done' : ''}`}>
      <button className={`checkbox ${todo.done ? 'is-checked' : ''}`} onClick={onToggle} aria-pressed={todo.done} aria-label={todo.done ? 'Mark as not done' : 'Mark as done'}>
        <span className="checkbox-fill" />
        <span className="checkbox-check"><Icon.Check/></span>
      </button>
      {editing ? (
        <input ref={inputRef} className="todo-input" value={draft} placeholder="What needs doing? Use #tags…" onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') { setDraft(todo.title); setEditing(false); } }} />
      ) : (
        <button className="todo-title" onClick={() => setEditing(true)} onKeyDown={(e) => { if (e.key === 'Enter') setEditing(true); }}>
          <span className="todo-title-text">
            {todo.title ? renderWithTags(todo.title, onTag) : <span className="todo-empty">Untitled task</span>}
          </span>
        </button>
      )}
      <button className="icon-btn ghost" onClick={onRemove} aria-label="Delete task"><Icon.Trash/></button>
    </li>
  );
}

// ---------- Search Results ----------
function SearchResults({ results, query, onClear, onJump, onTag, onToggle }) {
  const total = results ? results.reduce((n, [, arr]) => n + arr.length, 0) : 0;
  return (
    <section className="search-results">
      <div className="search-results-head">
        <div>
          <div className="eyebrow">Search</div>
          <h2 className="search-title">
            {total} match{total === 1 ? '' : 'es'} for <span className="search-query">{query}</span>
          </h2>
        </div>
        <button className="btn btn-ghost" onClick={onClear}><Icon.X/><span>Close search</span></button>
      </div>
      {total === 0 ? (
        <div className="empty">
          <div className="empty-title">No matches</div>
          <div className="empty-sub">Try a different word, or pick a tag from the sidebar.</div>
        </div>
      ) : (
        <div className="search-groups">
          {results.map(([dateKey, items]) => {
            const d = fromKey(dateKey);
            return (
              <div key={dateKey} className="search-day">
                <button className="search-day-head" onClick={() => onJump(dateKey)}>
                  <span className="search-day-num">{d.getDate()}</span>
                  <span className="search-day-name">{DOW_LONG[d.getDay()]}</span>
                  <span className="search-day-sub">{MONTHS[d.getMonth()]} {d.getFullYear()}</span>
                  <span className="search-day-count">{items.length}</span>
                </button>
                <ul className="todo-list flat">
                  {items.map(({ todo, group }) => (
                    <li key={todo.id} className={`todo ${todo.done ? 'is-done' : ''}`}>
                      <button className={`checkbox ${todo.done ? 'is-checked' : ''}`} onClick={() => onToggle(todo.id, !todo.done)} aria-pressed={todo.done}>
                        <span className="checkbox-fill" />
                        <span className="checkbox-check"><Icon.Check/></span>
                      </button>
                      <div className="todo-title" style={{ cursor: 'default' }}>
                        <span className="todo-title-text">{renderWithTags(todo.title, onTag)}</span>
                        <span className="search-context">in {group.title}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------- DatePicker (calendar grid) ----------
function DatePicker({ initialDate, totalsByKey, onClose, onPick }) {
  const [view, setView] = useState(() => {
    const d = new Date(initialDate); d.setDate(1); return d;
  });
  const monthStart = new Date(view); monthStart.setDate(1);
  const startWeekday = monthStart.getDay(); // 0 Sun..6 Sat
  // Grid starts on Saturday
  const offsetFromSat = (startWeekday - 6 + 7) % 7;
  const gridStart = addDays(monthStart, -offsetFromSat);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const shiftMonth = (n) => { const d = new Date(view); d.setMonth(d.getMonth() + n); setView(d); };

  return (
    <div className="modal-shell" onClick={onClose}>
      <div className="modal date-picker" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month"><span style={{transform:'rotate(180deg)', display:'grid'}}><Icon.Chevron/></span></button>
          <h3 className="modal-title">{fmtMonthYear(view)}</h3>
          <button className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month"><Icon.Chevron/></button>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon.X/></button>
        </div>
        <div className="cal-grid cal-head">
          {['S','S','M','T','W','T','F'].map((c, i) => <div key={i} className="cal-dow">{c}</div>)}
        </div>
        <div className="cal-grid">
          {cells.map((d) => {
            const k = toKey(d);
            const inMonth = d.getMonth() === view.getMonth();
            const t = totalsByKey[k] || { done: 0, total: 0 };
            const today = k === TODAY_KEY;
            return (
              <button key={k} className={`cal-cell ${inMonth ? '' : 'is-other'} ${today ? 'is-today' : ''}`} onClick={() => onPick(d)}>
                <span className="cal-num">{d.getDate()}</span>
                {t.total > 0 && (
                  <span className="cal-dots" aria-hidden>
                    {Array.from({ length: Math.min(t.total, 4) }).map((_, i) => (
                      <span key={i} className={`cal-dot ${i < t.done ? 'done' : ''}`} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={() => onPick(TODAY)}>Today</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Draw Sheet (S Pen) ----------
const PEN_COLORS = [
  '#1f2330', // ink
  '#3f4ea8', // accent
  '#c0392b', // red
  '#1e8a4f', // green
  '#e0a800', // amber
];
const HIGHLIGHT_COLORS = [
  '#ffe066',
  '#a0e7a0',
  '#a0d8ff',
  '#ffb3c7',
];

function DrawSheet({ date, dateKey, strokes, onAdd, onRemoveStroke, onClear, onClose, isDark }) {
  const [tool, setTool] = useState('pen'); // pen | highlighter | eraser
  const [color, setColor] = useState(isDark ? '#ffffff' : '#1f2330');
  const [width, setWidth] = useState(3);
  const [penOnly, setPenOnly] = useState(true);
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ w: 1200, h: 700 });

  // Resize observer
  useEffect(() => {
    const el = canvasRef.current; if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const cr = e.contentRect;
        setSize({ w: Math.round(cr.width), h: Math.round(cr.height) });
      }
    });
    ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, []);

  // Render strokes
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size.w * dpr; c.height = size.h * dpr;
    c.style.width = size.w + 'px'; c.style.height = size.h + 'px';
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    for (const s of strokes) drawStroke(ctx, s, size);
    if (liveStroke.current) drawStroke(ctx, liveStroke.current, size);
  }, [strokes, size]);

  const liveStroke = useRef(null);
  const drawing = useRef(false);

  function drawStroke(ctx, stroke, sz) {
    const pts = stroke.points;
    if (!pts || pts.length === 0) return;
    ctx.save();
    if (stroke.tool === 'highlighter') {
      ctx.globalAlpha = 0.32;
      ctx.globalCompositeOperation = 'multiply';
    } else {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.strokeStyle = stroke.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (pts.length === 1) {
      const p = pts[0];
      ctx.beginPath();
      ctx.fillStyle = stroke.color;
      ctx.arc(p.x * sz.w, p.y * sz.h, (stroke.width * (p.p || 0.5)) / 2 + 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    // Variable-width by sampling segments
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const w = stroke.width * ((a.p + b.p) / 2 || 0.6);
      ctx.lineWidth = Math.max(0.5, w);
      ctx.beginPath();
      ctx.moveTo(a.x * sz.w, a.y * sz.h);
      ctx.lineTo(b.x * sz.w, b.y * sz.h);
      ctx.stroke();
    }
    ctx.restore();
  }

  function getRel(e) {
    const r = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
      p: e.pressure && e.pressure > 0 ? e.pressure : (e.pointerType === 'pen' ? 0.5 : 0.6),
    };
  }
  function shouldAccept(e) {
    if (penOnly) return e.pointerType === 'pen' || e.pointerType === 'mouse';
    return true;
  }
  // S Pen barrel button held, or pen flipped to eraser tip → temporary erase.
  // Different devices/firmwares report the side button differently, so we cast a wide net:
  //   - e.buttons & 32  = stylus barrel (W3C)
  //   - e.buttons & 2   = secondary button (right-click / S Pen side on Samsung)
  //   - e.button === 5  = eraser-tip / barrel reported on pointerdown
  function isBarrelErase(e) {
    if (e.pointerType !== 'pen') return false;
    if ((e.buttons & 32) === 32) return true;
    if ((e.buttons & 2)  === 2)  return true;
    if (e.button === 5) return true;
    return false;
  }
  const barrelEraseRef = useRef(false);

  const onPointerDown = (e) => {
    if (!shouldAccept(e)) return;
    e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId);
    drawing.current = true;
    barrelEraseRef.current = isBarrelErase(e);
    const pt = getRel(e);
    const effectiveTool = barrelEraseRef.current ? 'eraser' : tool;
    if (effectiveTool === 'eraser') {
      hitErase(pt);
      return;
    }
    liveStroke.current = {
      id: WeeklyDB.uid('s'),
      dateKey,
      tool: effectiveTool,
      color,
      width: effectiveTool === 'highlighter' ? Math.max(width * 4, 16) : width,
      points: [pt],
      createdAt: Date.now(),
    };
    redraw();
  };
  const onPointerMove = (e) => {
    if (!drawing.current) return;
    if (!shouldAccept(e)) return;
    // Re-check barrel during the stroke so users can press/release mid-gesture.
    if (e.pointerType === 'pen') barrelEraseRef.current = isBarrelErase(e);
    const pt = getRel(e);
    const effectiveTool = barrelEraseRef.current ? 'eraser' : tool;
    if (effectiveTool === 'eraser') { hitErase(pt); return; }
    if (liveStroke.current) {
      liveStroke.current.points.push(pt);
      redraw();
    }
  };
  const onPointerUp = (e) => {
    if (!drawing.current) return;
    drawing.current = false;
    const wasErasing = barrelEraseRef.current || tool === 'eraser';
    barrelEraseRef.current = false;
    if (!wasErasing && liveStroke.current) {
      const finished = liveStroke.current;
      liveStroke.current = null;
      onAdd(finished);
    }
  };

  function hitErase(pt) {
    // Find topmost stroke whose any segment is within tolerance
    const tol = 0.012;
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i];
      for (const p of s.points) {
        const dx = p.x - pt.x; const dy = p.y - pt.y;
        if (dx * dx + dy * dy < tol * tol) {
          onRemoveStroke(s.id);
          return;
        }
      }
    }
  }

  function redraw() {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    for (const s of strokes) drawStroke(ctx, s, size);
    if (liveStroke.current) drawStroke(ctx, liveStroke.current, size);
  }

  const undo = () => {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    onRemoveStroke(last.id);
  };

  const colors = tool === 'highlighter' ? HIGHLIGHT_COLORS : PEN_COLORS;

  return (
    <div className="modal-shell" onClick={onClose}>
      <div className="modal draw-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3 className="modal-title">Sketchpad — {DOW_LONG[date.getDay()]}, {MONTHS[date.getMonth()]} {date.getDate()}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon.X/></button>
        </div>
        <div className="draw-toolbar">
          <div className="draw-tools">
            <button className={`tool-btn ${tool==='pen'?'is-on':''}`} onClick={() => setTool('pen')}><Icon.Pen/><span>Pen</span></button>
            <button className={`tool-btn ${tool==='highlighter'?'is-on':''}`} onClick={() => setTool('highlighter')}><Icon.Highlighter/><span>Highlight</span></button>
            <button className={`tool-btn ${tool==='eraser'?'is-on':''}`} onClick={() => setTool('eraser')}><Icon.Eraser/><span>Erase</span></button>
          </div>
          <div className="draw-colors">
            {colors.map((c) => (
              <button key={c} className={`swatch ${color===c?'is-on':''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Color ${c}`} />
            ))}
          </div>
          <label className="draw-width">
            <span>Size</span>
            <input type="range" min="1" max="14" step="1" value={width} onChange={(e) => setWidth(+e.target.value)} />
            <span className="width-num">{width}</span>
          </label>
          <label className="pen-only">
            <input type="checkbox" checked={penOnly} onChange={(e) => setPenOnly(e.target.checked)} />
            <span>S Pen only</span>
          </label>
          <div className="draw-actions">
            <button className="btn btn-ghost" onClick={undo} disabled={strokes.length===0}><Icon.Undo/><span>Undo</span></button>
            <button className="btn btn-ghost danger" onClick={onClear} disabled={strokes.length===0}><Icon.Trash/><span>Clear</span></button>
          </div>
        </div>
        <div className="draw-canvas-wrap">
          <canvas
            ref={canvasRef}
            className={`draw-canvas ${tool==='eraser'?'cursor-erase':'cursor-pen'}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ touchAction: 'none' }}
          />
          {strokes.length === 0 && (
            <div className="draw-hint">
              Sketch with the S Pen — pressure controls stroke width. Hold the S Pen <strong>side button</strong> while drawing to erase. Toggle <strong>S Pen only</strong> off to draw with a finger.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Mount ----------
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
