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

// ---------- Seed data ----------
function seedFor() {
  // Seed against this week starting Saturday.
  const sat = startOfWeekSat(TODAY);
  const groups = []; const todos = [];
  const make = (offset, gTitle, items) => {
    const dateKey = toKey(addDays(sat, offset));
    const gid = WeeklyDB.uid('g');
    groups.push({
      id: gid, dateKey, title: gTitle,
      order: groups.filter(g => g.dateKey === dateKey).length, collapsed: false,
    });
    items.forEach((t, i) => todos.push({
      id: WeeklyDB.uid('t'), groupId: gid, title: t.title,
      done: !!t.done, order: i, createdAt: Date.now() + i,
    }));
  };
  // Saturday (offset 0) … Friday (offset 6)
  make(0, 'Morning', [
    { title: 'Long run — 8 km #fitness', done: true },
    { title: 'Stretch + foam roll #fitness', done: true },
    { title: 'Cold shower' },
  ]);
  make(0, 'House', [
    { title: 'Grocery run #errands' },
    { title: 'Water the plants #home' },
    { title: 'Pay phone bill #bills', done: true },
  ]);
  make(1, 'Family', [
    { title: 'Brunch with parents #family' },
    { title: 'Call grandma #family' },
  ]);
  make(2, 'Work — focus block', [
    { title: 'Draft Q3 OKR doc #work' },
    { title: 'Review PR #284 #work', done: true },
    { title: 'Sync with design on tablet PWA #work' },
    { title: 'Inbox to zero #work' },
  ]);
  make(2, 'Errands', [
    { title: 'Drop package at post office #errands' },
    { title: 'Pharmacy refill #errands' },
  ]);
  make(3, 'Work', [
    { title: '1:1 with Maya, 10:00 #work' },
    { title: 'Roadmap review prep #work' },
  ]);
  make(3, 'Health', [
    { title: 'Yoga, 18:30 #fitness' },
  ]);
  make(4, 'Deep work', [
    { title: 'Write proposal: weekly review ritual #work' },
    { title: 'Outline talk for All-Hands #work' },
  ]);
  make(5, 'Personal', [
    { title: 'Book dentist #health' },
    { title: 'Reply to Sam re: trip #personal' },
  ]);
  make(6, 'Wrap up', [
    { title: 'Weekly review #work' },
    { title: 'Tidy desk + inbox #work' },
    { title: 'Plan next week' },
  ]);
  return { groups, todos };
}

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
      const seed = seedFor();
      const wsKey = toKey(startOfWeekSat(TODAY));
      await WeeklyDB.bulkSeed(seed.groups, seed.todos, wsKey);
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
    for (const t of todos) {
      const g = groups.find((x) => x.id === t.groupId);
      if (!g) continue;
      const m = (map[g.dateKey] ||= { done: 0, total: 0 });
      m.total += 1; if (t.done) m.done += 1;
    }
    return map;
  }, [groups, todos]);

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
function Sidebar({ weekStart, dateKey, onPickDate, onShiftWeek, onJumpToday, onOpenPicker, totalsByKey, themePref, setThemePref, isDark, allTags, onTag, onExport, onImport, importMsg }) {
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

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark" aria-hidden>
          <span className="brand-dot" /><span className="brand-dot" /><span className="brand-dot" />
        </div>
        <div className="brand-text">
          <div className="brand-name">Weekly</div>
          <div className="brand-sub">Plan · sketch · search</div>
        </div>
      </div>

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
          const active = k === dateKey;
          const today = k === TODAY_KEY;
          return (
            <button key={k} className={`day-btn ${active ? 'is-active' : ''} ${today ? 'is-today' : ''}`} onClick={() => onPickDate(k)} aria-current={active ? 'page' : undefined}>
              <div className="day-btn-row">
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

      <div className="sidebar-tools">
        <button className="tool-row" onClick={onOpenPicker}>
          <span className="tool-icon"><Icon.Calendar/></span>
          <span className="tool-text">Jump to date</span>
        </button>
        <button className="tool-row" onClick={onJumpToday}>
          <span className="tool-icon today-mini" aria-hidden>{TODAY.getDate()}</span>
          <span className="tool-text">Go to today</span>
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

      {allTags.length > 0 && (
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
    </aside>
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

  const onPointerDown = (e) => {
    if (!shouldAccept(e)) return;
    e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId);
    drawing.current = true;
    const pt = getRel(e);
    if (tool === 'eraser') {
      // Hit-test strokes
      hitErase(pt);
      return;
    }
    liveStroke.current = {
      id: WeeklyDB.uid('s'),
      dateKey,
      tool,
      color: tool === 'highlighter' ? color : color,
      width: tool === 'highlighter' ? Math.max(width * 4, 16) : width,
      points: [pt],
      createdAt: Date.now(),
    };
    redraw();
  };
  const onPointerMove = (e) => {
    if (!drawing.current) return;
    if (!shouldAccept(e)) return;
    const pt = getRel(e);
    if (tool === 'eraser') { hitErase(pt); return; }
    liveStroke.current.points.push(pt);
    redraw();
  };
  const onPointerUp = (e) => {
    if (!drawing.current) return;
    drawing.current = false;
    if (tool !== 'eraser' && liveStroke.current) {
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
            style={{ touchAction: penOnly ? 'auto' : 'none' }}
          />
          {strokes.length === 0 && (
            <div className="draw-hint">
              Sketch with the S Pen — pressure controls stroke width. Toggle <strong>S Pen only</strong> off to draw with a finger.
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
