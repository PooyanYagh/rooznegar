import { createClient } from '@supabase/supabase-js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const fa = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const shortFa = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'short', day: 'numeric' });
let entries = []; let reviewKind = 'monthly'; let timerId; let seconds = 300;
const today = () => new Date().toISOString().slice(0, 10);
const isoDate = (date) => date.toISOString().slice(0, 10);
const parseIso = (date) => new Date(`${date}T12:00:00`);
const setStatus = (id, msg) => { $(id).textContent = msg; };
const formatFa = (number) => new Intl.NumberFormat('fa-IR').format(number);

$('#date').value = today();
$('#today-label').textContent = fa.format(new Date());

function cleanAuthUrl() { if (location.hash.includes('access_token') || location.hash.includes('error=')) history.replaceState(null, '', `${location.pathname}${location.search}`); }
function showTab(name) { $$('.tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === name)); $$('.panel').forEach((panel) => panel.classList.toggle('active', panel.id === name)); if (name === 'insights') renderCharts(); if (name === 'reviews') loadReview(); }
function updateDateLabel() { $('#jalali-date').textContent = fa.format(parseIso($('#date').value)); }
function updateMetricLabels() { ['score', 'mood', 'stress', 'focus'].forEach((name) => { $(`#${name}Text`).textContent = `${formatFa($(`#${name}`).value)}/۱۰`; }); }
function words(value = '') { return value.split(/[،,]/).map((x) => x.trim()).filter(Boolean); }
function make(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }

function addEvent(value = {}) {
  const node = $('#event-template').content.firstElementChild.cloneNode(true);
  node.querySelector('.event-time').value = value.event_time || value.time || '';
  node.querySelector('.event-title').value = value.title || '';
  node.querySelector('.event-thought').value = value.thoughts || '';
  node.querySelector('.event-emotions').value = (value.emotions || []).join('، ');
  node.querySelector('.event-reflection').value = value.reflection || '';
  if (value.thoughts || value.reflection || (value.emotions || []).length) node.querySelector('details').open = true;
  node.querySelector('.remove-event').onclick = () => node.remove();
  $('#events').append(node);
}

function setDay(entry) {
  $('#highlight').value = entry?.highlight || '';
  $('#dump').value = entry?.brain_dump || '';
  $('#lesson').value = entry?.lesson || '';
  ['score', 'mood', 'stress', 'focus'].forEach((name) => { $(`#${name}`).value = entry?.[name] || 5; });
  $('#sleep').value = entry?.sleep_hours ?? '';
  $('#events').innerHTML = '';
  (entry?.journal_events || []).sort((a, b) => (a.event_time || '').localeCompare(b.event_time || '')).forEach(addEvent);
  if (!$('#events').children.length) addEvent();
  updateMetricLabels(); updateDateLabel();
}

async function loadEntries() {
  const { data, error } = await sb.from('journal_entries').select('id,entry_date,jalali_date,highlight,score,mood,stress,focus,sleep_hours,brain_dump,lesson,journal_events(*)').order('entry_date', { ascending: false }).limit(366);
  if (error) return setStatus('#day-status', 'دریافت داده‌ها ناموفق بود.');
  entries = data || []; renderCalendar(); renderCharts();
}
async function loadDay() {
  const { data, error } = await sb.from('journal_entries').select('*,journal_events(*)').eq('entry_date', $('#date').value).maybeSingle();
  if (error) return setStatus('#day-status', 'دریافت نوشته با خطا روبه‌رو شد.');
  setDay(data);
}
async function saveDay() {
  const entryDate = $('#date').value;
  const payload = { entry_date: entryDate, jalali_date: shortFa.format(parseIso(entryDate)), highlight: $('#highlight').value.trim(), brain_dump: $('#dump').value, lesson: $('#lesson').value, score: +$('#score').value, mood: +$('#mood').value, stress: +$('#stress').value, focus: +$('#focus').value, sleep_hours: $('#sleep').value ? +$('#sleep').value : null };
  const { data, error } = await sb.from('journal_entries').upsert(payload, { onConflict: 'user_id,entry_date' }).select().single();
  if (error) return setStatus('#day-status', error.message);
  const events = $$('.event-card').map((node) => ({ entry_id: data.id, event_time: node.querySelector('.event-time').value || null, title: node.querySelector('.event-title').value.trim(), thoughts: node.querySelector('.event-thought').value.trim(), emotions: words(node.querySelector('.event-emotions').value), reflection: node.querySelector('.event-reflection').value.trim() })).filter((event) => event.title);
  const deleted = await sb.from('journal_events').delete().eq('entry_id', data.id);
  if (deleted.error) return setStatus('#day-status', deleted.error.message);
  if (events.length) { const { error: eventError } = await sb.from('journal_events').insert(events); if (eventError) return setStatus('#day-status', eventError.message); }
  setStatus('#day-status', 'روز شما با موفقیت ذخیره شد.'); await loadEntries(); await loadDay();
}

function renderCalendar() {
  const host = $('#calendar-list'); host.innerHTML = '';
  if (!entries.length) { host.append(make('div', 'empty', 'هنوز روزی ثبت نشده است.')); return; }
  entries.forEach((entry) => { const item = make('article'); const title = make('b', null, entry.jalali_date || shortFa.format(parseIso(entry.entry_date))); const note = make('small', null, entry.highlight || 'بدون هایلایت'); item.append(title, document.createElement('br'), note); item.onclick = () => { $('#date').value = entry.entry_date; showTab('day'); loadDay(); }; host.append(item); });
}

function metricChart(title, key) {
  const values = entries.slice(0, 30).reverse().filter((entry) => entry[key] !== null && entry[key] !== undefined);
  if (!values.length) return null;
  const card = make('article', 'chart-card'); const head = make('div', 'chart-head'); head.append(make('b', null, title), make('span', null, `آخرین: ${formatFa(values.at(-1)[key])}/۱۰`)); const bars = make('div', 'bars'); values.forEach((entry) => { const bar = make('i', 'bar-col'); bar.style.height = `${Math.max(7, Number(entry[key]) * 10)}%`; bar.title = `${shortFa.format(parseIso(entry.entry_date))}: ${entry[key]}`; bars.append(bar); }); card.append(head, bars); return card;
}
function renderCharts() {
  const charts = $('#charts'); if (!charts) return; charts.innerHTML = '';
  [['امتیاز روز', 'score'], ['حال', 'mood'], ['استرس', 'stress'], ['تمرکز', 'focus']].forEach(([label, key]) => { const chart = metricChart(label, key); if (chart) charts.append(chart); });
  const sleep = entries.slice(0, 30).reverse().filter((entry) => entry.sleep_hours !== null);
  if (sleep.length) { const card = make('article', 'chart-card'); const head = make('div', 'chart-head'); head.append(make('b', null, 'خواب'), make('span', null, `آخرین: ${formatFa(sleep.at(-1).sleep_hours)} ساعت`)); const bars = make('div', 'bars'); sleep.forEach((entry) => { const bar = make('i', 'bar-col'); bar.style.height = `${Math.max(7, Math.min(100, Number(entry.sleep_hours) / 12 * 100))}%`; bars.append(bar); }); card.append(head, bars); charts.append(card); }
  $('#insight-empty').hidden = charts.children.length > 0;
}

function renderGoals(goals) {
  const host = $('#goals-list'); host.innerHTML = '';
  if (!goals.length) { host.append(make('div', 'empty', 'اولین هدف‌تان را اضافه کنید.')); return; }
  goals.forEach((goal) => { const card = make('article', 'goal-card'); const title = make('h3', null, goal.title); const meta = make('div', 'goal-meta'); meta.append(make('span', null, goal.due_date ? `موعد: ${shortFa.format(parseIso(goal.due_date))}` : 'بدون موعد'), make('span', null, `${formatFa(goal.progress)}٪`)); const progress = make('div', 'progress'); const fill = make('i'); fill.style.width = `${goal.progress}%`; progress.append(fill); const why = make('p', 'hint', goal.why || 'چرایی ثبت نشده است.'); const action = make('div', 'goal-actions'); const input = document.createElement('input'); input.placeholder = 'اقدام امروز برای این هدف'; const button = make('button', 'quiet', 'ثبت اقدام'); button.onclick = async () => { if (!input.value.trim()) return; const { error } = await sb.from('goal_actions').insert({ goal_id: goal.id, action_date: today(), body: input.value.trim(), progress_delta: 0 }); if (error) return setStatus('#day-status', error.message); input.value = ''; setStatus('#day-status', 'اقدام هدف ثبت شد.'); }; action.append(input, button); card.append(title, meta, progress, why, action); host.append(card); });
}
async function loadGoals() { const { data, error } = await sb.from('goals').select('*').order('created_at', { ascending: false }); if (!error) renderGoals(data || []); }
async function saveGoal(event) { event.preventDefault(); const payload = { title: $('#goal-title').value.trim(), why: $('#goal-why').value.trim(), due_date: $('#goal-due').value || null, progress: +$('#goal-progress').value }; const { error } = await sb.from('goals').insert(payload); if (error) return setStatus('#day-status', error.message); event.target.reset(); $('#goal-progress-text').textContent = '۰٪'; event.target.hidden = true; await loadGoals(); }

function period() { const now = new Date(); if (reviewKind === 'yearly') return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` }; const start = new Date(now.getFullYear(), now.getMonth(), 1); const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); return { start: isoDate(start), end: isoDate(end) }; }
function termsInCurrentPeriod() { const { start, end } = period(); const relevant = entries.filter((entry) => entry.entry_date >= start && entry.entry_date <= end); const pool = relevant.flatMap((entry) => [entry.highlight, entry.lesson, ...(entry.journal_events || []).flatMap((event) => [event.title, ...(event.emotions || [])])].filter(Boolean)); const counts = {}; pool.flatMap((value) => String(value).split(/\s|،|,/)).filter((word) => word.length > 3).forEach((word) => { counts[word] = (counts[word] || 0) + 1; }); return { relevant, top: Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([word]) => word) }; }
async function loadReview() { const { start, end } = period(); const { relevant, top } = termsInCurrentPeriod(); const host = $('#review-summary'); host.innerHTML = ''; host.append(make('p', null, `${formatFa(relevant.length)} روز ثبت‌شده در این بازه.`)); const label = make('b', null, 'موضوع‌ها و احساس‌های پرتکرار'); const chips = make('div', 'topic-list'); (top.length ? top : ['با ثبت روزهای بیشتر، الگوها ظاهر می‌شوند']).forEach((word) => chips.append(make('span', 'chip', word))); host.append(label, chips); const { data } = await sb.from('journal_reviews').select('*').eq('period_start', start).eq('period_kind', reviewKind).maybeSingle(); $('#review-keep').value = data?.keep || ''; $('#review-adjust').value = data?.adjust || ''; }
async function saveReview() { const { start, end } = period(); const { error } = await sb.from('journal_reviews').upsert({ period_start: start, period_end: end, period_kind: reviewKind, keep: $('#review-keep').value, adjust: $('#review-adjust').value }, { onConflict: 'user_id,period_start,period_kind' }); setStatus('#review-status', error ? error.message : 'مرور ذخیره شد.'); }

function renderTimer() { const min = String(Math.floor(seconds / 60)).padStart(2, '0'); const sec = String(seconds % 60).padStart(2, '0'); $('#timer').textContent = `${formatFa(min)}:${formatFa(sec)}`; }
function toggleTimer() { if (timerId) { clearInterval(timerId); timerId = null; $('#timer-toggle').textContent = 'ادامه'; return; } $('#timer-toggle').textContent = 'توقف'; timerId = setInterval(() => { if (seconds <= 0) { clearInterval(timerId); timerId = null; $('#timer-toggle').textContent = 'شروع تایمر'; return; } seconds -= 1; renderTimer(); }, 1000); }

$$('.tab').forEach((button) => button.onclick = () => showTab(button.dataset.tab));
['score', 'mood', 'stress', 'focus'].forEach((name) => { $(`#${name}`).oninput = updateMetricLabels; });
$('#previous-day').onclick = () => { const date = parseIso($('#date').value); date.setDate(date.getDate() - 1); $('#date').value = isoDate(date); loadDay(); };
$('#next-day').onclick = () => { const date = parseIso($('#date').value); date.setDate(date.getDate() + 1); $('#date').value = isoDate(date); loadDay(); };
$('#date').onchange = loadDay; $('#add-event').onclick = () => addEvent(); $('#save-day').onclick = saveDay;
$('#timer-toggle').onclick = toggleTimer; $('#timer-reset').onclick = () => { clearInterval(timerId); timerId = null; seconds = 300; renderTimer(); $('#timer-toggle').textContent = 'شروع تایمر'; };
$('#new-goal').onclick = () => { $('#goal-form').hidden = !$('#goal-form').hidden; }; $('#goal-progress').oninput = (event) => { $('#goal-progress-text').textContent = `${formatFa(event.target.value)}٪`; }; $('#goal-form').onsubmit = saveGoal;
$$('.review-kind').forEach((button) => button.onclick = () => { reviewKind = button.dataset.kind; $$('.review-kind').forEach((item) => item.classList.toggle('active', item === button)); loadReview(); }); $('#save-review').onclick = saveReview;
$('#login').onclick = async () => { const email = $('#email').value.trim(); if (!email) return setStatus('#auth-status', 'لطفاً ایمیل‌تان را وارد کنید.'); const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } }); setStatus('#auth-status', error?.message || 'لینک ورود ارسال شد.'); };
$('#logout').onclick = () => sb.auth.signOut();
renderTimer();
sb.auth.onAuthStateChange(async (_event, session) => { const signedIn = Boolean(session?.user); $('#auth').hidden = signedIn; $('#app').hidden = !signedIn; $('#logout').hidden = !signedIn; if (signedIn) { cleanAuthUrl(); await loadEntries(); await loadDay(); await loadGoals(); } });
