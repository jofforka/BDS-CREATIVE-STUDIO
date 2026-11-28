(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const dateFormat = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
  const wat = value => dateFormat.format(new Date(value)).replace(' ', 'T');
  const kobo = value => Math.round(Number(value) * 100);
  const rpc = (api, name, params) => api('/rest/v1/rpc/' + name, 'POST', params);

  window.BDSStudioOperations = ({ api, money, status, refresh, session, reloadEnquiries }) => {
    const form = $('appointment-form');
    const calendar = $('appointment-day');
    const finance = $('finance-form');
    const expense = $('expense-form');
    let edit, report, expenseId;

    function clear() {
      form.hidden = true;
      form.reset();
      edit = null;
      for (const name of ['resources', 'service']) form.elements[name].replaceChildren();
      calendar.value = '';
      finance.reset();
      expense.reset();
      expenseId = null;
      report = null;
      $('finance-status').textContent = '';
      $('finance-export').disabled = true;
    }

    async function open(enquiry, appointment, services) {
      const generation = session();
      const [resources, allocations] = await Promise.all([
        api('/rest/v1/studio_resources?active=eq.true&select=id,name,kind&order=name'),
        appointment ? api('/rest/v1/studio_booking_resources?select=resource_id&booking_id=eq.' + appointment.id) : []
      ]);
      if (generation !== session()) return;
      form.reset();
      edit = { enquiry, appointment };
      const fields = form.elements;
      const packages = services.filter(service => service.active && enquiry &&
        service.name.split(' — ')[0] === enquiry.service);
      fields.service.replaceChildren(new Option('Select package', ''));
      for (const item of packages) fields.service.add(new Option(item.name, item.id));
      $('approval-fields').hidden = Boolean(appointment);
      for (const key of ['service', 'total', 'deposit', 'customer']) fields[key].disabled = Boolean(appointment);
      fields.resources.replaceChildren();
      for (const item of resources) {
        const option = new Option(item.name + ' · ' + item.kind, item.id);
        option.selected = allocations.some(row => row.resource_id === item.id);
        fields.resources.add(option);
      }
      fields.start.value = appointment ? wat(appointment.starts_at) : enquiry.preferred_date + 'T' + enquiry.preferred_time.slice(0, 5);
      if (appointment) fields.end.value = wat(appointment.ends_at);
      $('appointment-title').textContent = appointment ? 'Reschedule appointment' : 'Approve request for ' + enquiry.guest_name;
      form.hidden = false;
      fields.start.focus();
    }

    let currentServices = [];
    form.elements.service.addEventListener('change', () => {
      const row = currentServices.find(item => item.id === form.elements.service.value);
      if (row) form.elements.total.value = row.price_kobo == null ? '' : row.price_kobo / 100;
    });

    function approve(article, enquiry, services, route) {
      currentServices = services;
      const button = document.createElement('button');
      button.type = 'button';
      const linked = Array.isArray(enquiry.studio_bookings) ? enquiry.studio_bookings[0] : enquiry.studio_bookings;
      if (linked) {
        button.textContent = 'View appointment';
        button.addEventListener('click', () => {
          route('appointments');
          $('search-bookings').value = linked.id;
          $('search-bookings').dispatchEvent(new Event('input'));
        });
      } else {
        button.textContent = 'Review and approve';
        button.addEventListener('click', async () => {
          route('appointments');
          try { await open(enquiry, null, services); }
          catch (error) { status(error.message); }
        });
      }
      article.append(button);
    }

    function appointmentActions(button, appointment) {
      button.textContent = 'Reschedule';
      button.addEventListener('click', () => open(null, appointment, []).catch(error => status(error.message)));
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancel appointment';
      cancel.addEventListener('click', async () => {
        if (!confirm('Cancel this appointment and release its resources?')) return;
        const generation = session();
        cancel.disabled = true;
        try {
          await rpc(api, 'studio_cancel_appointment', { p_booking_id: appointment.id });
          if (generation !== session()) return;
          status('Appointment cancelled. Review any funds received in Payment history.');
          await refresh();
        } catch (error) { if (generation === session()) status(error.message); }
        finally { cancel.disabled = false; }
      });
      button.after(cancel);
    }

    $('appointment-close').addEventListener('click', () => { form.hidden = true; edit = null; });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!edit) return;
      const generation = session();
      const fields = form.elements;
      const submit = $('appointment-save');
      submit.disabled = true;
      try {
        const id = await rpc(api, 'studio_save_appointment', {
          p_enquiry_id: edit.enquiry?.id ?? null,
          p_booking_id: edit.appointment?.id ?? null,
          p_service_id: fields.service.value || null,
          p_start: fields.start.value + ':00+01:00',
          p_end: fields.end.value + ':00+01:00',
          p_resources: Array.from(fields.resources.selectedOptions, option => option.value),
          p_total: fields.total.disabled ? null : kobo(fields.total.value),
          p_deposit: fields.deposit.disabled ? null : kobo(fields.deposit.value),
          p_customer_id: fields.customer.disabled ? null : fields.customer.value || null
        });
        if (generation !== session()) return;
        form.hidden = true;
        edit = null;
        status('Appointment saved. Reference ' + id);
        await refresh();
        reloadEnquiries();
      } catch (error) { if (generation === session()) status(error.message); }
      finally { submit.disabled = false; }
    });

    const applyDay = () => $('search-bookings').dispatchEvent(new Event('input'));
    calendar.addEventListener('input', applyDay);
    $('appointment-all-days').addEventListener('click', () => { calendar.value = ''; applyDay(); });

    expense.addEventListener('input', () => { expenseId = null; });
    expense.addEventListener('submit', async event => {
      event.preventDefault();
      const generation = session();
      const data = new FormData(expense);
      const submit = expense.querySelector('button');
      expenseId ??= crypto.randomUUID();
      submit.disabled = true;
      try {
        await rpc(api, 'studio_record_expense', {
          p_id: expenseId, p_description: data.get('description'),
          p_amount: kobo(data.get('amount')), p_date: data.get('date')
        });
        if (generation !== session()) return;
        expense.reset();
        expenseId = null;
        status('Expense recorded. Run the report to refresh totals.');
      } catch (error) { if (generation === session()) status(error.message); }
      finally { submit.disabled = false; }
    });

    finance.addEventListener('submit', async event => {
      event.preventDefault();
      const generation = session();
      const submit = finance.querySelector('button');
      const { from, to } = Object.fromEntries(new FormData(finance));
      const result = $('finance-status');
      const exportButton = $('finance-export');
      exportButton.disabled = true;
      report = null;
      if (from > to) { result.textContent = 'Choose an end date on or after the start date.'; return; }
      submit.disabled = true;
      try {
        const entries = [];
        for (let offset = 0; generation === session(); offset += 500) {
          const page = await api('/rest/v1/studio_finance_entries?entry_date=gte.' + from +
            '&entry_date=lte.' + to + '&order=entry_date,entry_type,id&limit=500&offset=' + offset);
          entries.push(...page);
          if (page.length < 500) break;
        }
        if (generation !== session()) return;
        const sum = type => entries.filter(row => row.entry_type === type)
          .reduce((total, row) => total + Number(row.amount_kobo), 0);
        const revenue = sum('revenue'), expenses = sum('expense');
        result.textContent = 'Revenue ' + money(revenue) + ' · Expenses ' + money(expenses) +
          ' · Net cash ' + money(revenue - expenses) + ' · ' + entries.length + ' entries';
        report = entries;
        exportButton.disabled = false;
      } catch (error) { if (generation === session()) result.textContent = error.message; }
      finally { submit.disabled = false; }
    });

    $('finance-export').addEventListener('click', () => {
      if (!report) return;
      const csvCell = text => {
        const value = String(text);
        const safe = /^[\s]*[=+@-]|^[\t\r\n]/.test(value) ? "'" + value : value;
        return '"' + safe.replace(/"/g, '""') + '"';
      };
      const lines = report.map(row => [row.entry_date, row.entry_type, row.reference, row.amount_kobo].map(csvCell).join(','));
      const href = URL.createObjectURL(new Blob(['Date,Type,Reference,Amount (kobo)\r\n', lines.join('\r\n')], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = href;
      link.download = 'bds-finance.csv';
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    });

    return { approve, appointmentActions, clear };
  };
})();
