import { createClient } from '@supabase/supabase-js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const sb = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
const today = () => new Date().toISOString().slice(0, 10);
$('#date').value = today();

function cleanAuthUrl() {
  if (location.hash.includes('access_token') || location.hash.includes('error=')) {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }
}
function setStatus(message) { $('#status').textContent = message; }
function addEvent(value = {}) {
  const row = document.createElement('div');
  row.className = 'event';
  row.innerHTML = `<input type="time" value="${value.time || ''}"><input value="${value.title || ''}" placeholder="چه اتفاقی افتاد؟"><button class="remove" aria-label="حذف اتفاق">×</button>`;
  row.querySelector('button').onclick = () => row.remove();
  $('#events').append(row);
}
async function loadHistory() {
  const { data, error } = await sb.from('journal_entries').select('entry_date,highlight,score').order('entry_date', { ascending: false }).limit(20);
  if (error) return;
  $('#history').innerHTML = (data || []).map((entry) => `<article><b>${entry.entry_date}</b> · ${entry.score}/۱۰<br>${entry.highlight || ''}</article>`).join('');
}
async function loadEntry() {
  const { data: entry, error } = await sb.from('journal_entries').select('*,journal_events(*)').eq('entry_date', $('#date').value).maybeSingle();
  if (error) return setStatus('دریافت نوشته با خطا روبه‌رو شد.');
  $('#highlight').value = entry?.highlight || '';
  $('#thoughts').value = entry?.thoughts || '';
  $('#dump').value = entry?.brain_dump || '';
  $('#lesson').value = entry?.lesson || '';
  $('#score').value = entry?.score || 5;
  $('#scoreText').textContent = `${$('#score').value}/۱۰`;
  $('#events').innerHTML = '';
  (entry?.journal_events || []).forEach((event) => addEvent({ time: event.event_time, title: event.title }));
  if (!$('#events').children.length) addEvent();
  await loadHistory();
}
$('#login').onclick = async () => {
  const email = $('#email').value.trim();
  if (!email) return setStatus('لطفاً ایمیل‌تان را وارد کنید.');
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } });
  setStatus(error?.message || 'لینک ورود ارسال شد. لطفاً فقط تازه‌ترین ایمیل را باز کنید.');
};
$('#logout').onclick = () => sb.auth.signOut();
$('#add').onclick = () => addEvent();
$('#date').onchange = loadEntry;
$('#score').oninput = (event) => { $('#scoreText').textContent = `${event.target.value}/۱۰`; };
$('#save').onclick = async () => {
  const payload = { entry_date: $('#date').value, highlight: $('#highlight').value, thoughts: $('#thoughts').value, brain_dump: $('#dump').value, lesson: $('#lesson').value, score: +$('#score').value };
  const { data, error } = await sb.from('journal_entries').upsert(payload, { onConflict: 'user_id,entry_date' }).select().single();
  if (error) return setStatus(error.message);
  await sb.from('journal_events').delete().eq('entry_id', data.id);
  const events = $$('#events .event').map((row) => ({ entry_id: data.id, event_time: row.querySelector('[type=time]').value || null, title: row.querySelector('[placeholder]').value })).filter((event) => event.title);
  if (events.length) await sb.from('journal_events').insert(events);
  setStatus('ذخیره شد.');
  await loadEntry();
};
sb.auth.onAuthStateChange(async (_event, session) => {
  const signedIn = Boolean(session?.user);
  $('#auth').hidden = signedIn;
  $('#app').hidden = !signedIn;
  $('#logout').hidden = !signedIn;
  if (signedIn) {
    cleanAuthUrl();
    await loadEntry();
  }
});
