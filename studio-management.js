(() => {
  'use strict';
  const $ = id => document.getElementById(id);

  window.BDSStudioManagement = ({ api, session }) => {
    const branches = $('branch-form');
    const staff = $('staff-form');
    const result = $('management-status');
    const resourceBranch = $('resource-form').elements.branch_id;
    let branchId = null;

    const title = (text, onClick) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      button.addEventListener('click', onClick);
      return button;
    };

    function clear() {
      branches.reset();
      staff.reset();
      branchId = null;
      staff.elements.user_id.readOnly = false;
      resourceBranch.replaceChildren(new Option('Unassigned', ''));
      result.textContent = '';
      for (const id of ['branch-list', 'staff-list', 'audit-list']) $(id).replaceChildren();
    }

    async function loadBranches() {
      const generation = session();
      const rows = await api('/rest/v1/studio_branches?select=id,name,active&order=name');
      if (generation !== session()) return [];
      const previous = resourceBranch.value;
      resourceBranch.replaceChildren(new Option('Unassigned', ''));
      for (const row of rows) resourceBranch.add(new Option(row.name + (row.active ? '' : ' (inactive)'), row.id));
      resourceBranch.value = previous;
      if (resourceBranch.selectedIndex < 0) resourceBranch.value = '';
      return rows;
    }

    async function load() {
      const generation = session();
      try {
        const [locations, people, events] = await Promise.all([
          loadBranches(),
          api('/rest/v1/studio_staff_access?select=user_id,schedule,payments,finance&order=user_id'),
          api('/rest/v1/studio_operations_audit?select=action,actor_id,record_id,occurred_at&order=id.desc&limit=50')
        ]);
        if (generation !== session()) return;
        $('branch-list').replaceChildren(...locations.map(row =>
          title(row.name + (row.active ? '' : ' (inactive)'), () => {
            branchId = row.id;
            branches.elements.name.value = row.name;
            branches.elements.active.checked = row.active;
            branches.elements.name.focus();
          })));
        $('staff-list').replaceChildren(...people.map(row => title(row.user_id, () => {
          staff.elements.user_id.value = row.user_id;
          staff.elements.user_id.readOnly = true;
          for (const key of ['schedule', 'payments', 'finance']) staff.elements[key].checked = row[key];
          staff.elements.schedule.focus();
        })));
        $('audit-list').replaceChildren(...events.map(row => {
          const item = document.createElement('li');
          item.textContent = [new Date(row.occurred_at).toLocaleString('en-NG',{timeZone:'Africa/Lagos'}),
            row.action, row.record_id, row.actor_id].join(' · ');
          return item;
        }));
      } catch (error) { if (generation === session()) result.textContent = error.message; }
    }

    $('branch-reset').addEventListener('click', () => { branchId = null; branches.reset(); });
    $('staff-reset').addEventListener('click', () => { staff.reset(); staff.elements.user_id.readOnly = false; });

    async function save(form, path, method, body, reset) {
      const generation = session();
      const button = form.querySelector('button[type=submit]');
      button.disabled = true;
      try {
        const saved = await api('/rest/v1/' + path, method, body);
        if (generation !== session()) return;
        if (saved.length !== 1) throw Error('No record was saved.');
        $(reset).click();
        result.textContent = 'Changes saved.';
        await load();
      } catch (error) { if (generation === session()) result.textContent = error.message; }
      finally { button.disabled = false; }
    }

    branches.addEventListener('submit', event => {
      event.preventDefault();
      save(branches, 'studio_branches' + (branchId ? '?id=eq.' + branchId : ''),
        branchId ? 'PATCH' : 'POST', { name: branches.elements.name.value.trim(), active: branches.elements.active.checked }, 'branch-reset');
    });
    staff.addEventListener('submit', event => {
      event.preventDefault();
      const fields = staff.elements;
      const existing = fields.user_id.readOnly;
      const payload = { schedule: fields.schedule.checked, payments: fields.payments.checked, finance: fields.finance.checked };
      if (!existing) payload.user_id = fields.user_id.value;
      save(staff, 'studio_staff_access' + (existing ? '?user_id=eq.' + fields.user_id.value : ''),
        existing ? 'PATCH' : 'POST', payload, 'staff-reset');
    });

    return { load, loadBranches, clear };
  };
})();
