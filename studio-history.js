const status = document.getElementById('history-status');
const list = document.getElementById('history-list');
const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' });
const date = new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' });

async function load() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const config = window.BDS_ACADEMY_CONFIG;
  const client = createClient(config.supabaseUrl, config.supabasePublishableKey, { auth: { flowType: 'pkce' } });
  client.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') {
      list.replaceChildren();
      status.textContent = 'Sign in to view your linked appointments.';
    }
  });
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous) {
    status.textContent = 'Sign in to view your linked appointments.';
    return;
  }
  const [appointments, balances] = await Promise.all([
    client.from('studio_bookings').select('id,starts_at,ends_at,status,total_kobo').eq('customer_id', user.id).order('starts_at', { ascending: false }),
    client.from('studio_appointment_balances').select('id,balance_kobo,deposit_remaining_kobo')
  ]);
  if (appointments.error || balances.error) throw Error('Appointments could not load.');
  if ((await client.auth.getUser()).data.user?.id !== user.id) return;
  const amounts = new Map(balances.data.map(row => [row.id, row]));
  status.textContent = appointments.data.length ? 'Times shown in WAT.' : 'No appointments are linked to your account. Contact the studio with your booking reference.';
  for (const appointment of appointments.data) {
    const row = document.createElement('article');
    const body = document.createElement('p');
    const balance = amounts.get(appointment.id);
    body.textContent = [
      appointment.id, date.formatRange(new Date(appointment.starts_at), new Date(appointment.ends_at)),
      appointment.status, 'Total ' + money.format(appointment.total_kobo / 100),
      balance ? 'Deposit remaining ' + money.format(balance.deposit_remaining_kobo / 100) : '',
      balance ? 'Balance ' + money.format(balance.balance_kobo / 100) : ''
    ].filter(Boolean).join(' · ');
    row.append(body);
    list.append(row);
  }
}

load().catch(() => { status.textContent = 'Appointments could not load. Please refresh to try again.'; });
