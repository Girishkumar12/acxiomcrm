/**
 * Admin & Service Modules (Users, Audit Logs, API Sandbox, CSV Export)
 */

let activeReportDataSet = [];
let currentReportType = 'customers';

async function loadUsersList() {
  const res = await fetch('/api/users');
  if (!res.ok) return;
  const users = (await res.json()).data || [];

  const tbody = document.querySelector('#usersTable tbody');
  tbody.innerHTML = users.map(u => `
    <tr>
      <td class="fw-semibold text-dark">${u.name}</td>
      <td>${u.email}</td>
      <td>${u.phone || '-'}</td>
      <td>
        <span class="badge ${u.roleName === 'Admin' ? 'badge-role-admin' : (u.roleName === 'Manager' ? 'badge-role-manager' : 'badge-role-sales')}">
          ${u.roleName}
        </span>
      </td>
      <td><span class="badge-status ${u.isActive ? 'badge-active' : 'badge-inactive'}">${u.isActive ? 'Active' : 'Disabled'}</span></td>
      <td>
        ${u.lockoutEnd && new Date(u.lockoutEnd) > new Date() ? `
          <span class="badge bg-danger"><i class="bi bi-lock-fill"></i> Locked</span>
        ` : '<span class="badge bg-light text-dark">Normal</span>'}
      </td>
      <td class="text-end">
        ${window.currentUser.roleName === 'Admin' ? `
          <button class="btn btn-sm btn-outline-secondary py-0 px-2 me-1" onclick="promptRoleChange('${u.userId}', '${u.roleName}')">Role</button>
          ${u.lockoutEnd ? `<button class="btn btn-sm btn-outline-warning py-0 px-2" onclick="unlockAccount('${u.userId}')">Unlock</button>` : ''}
        ` : '-'}
      </td>
    </tr>
  `).join('');
}

async function promptRoleChange(userId, currentRole) {
  const newRole = prompt('Enter new role (Admin, Manager, SalesExecutive):', currentRole);
  if (!newRole || newRole === currentRole) return;

  const res = await fetch(`/api/users/${userId}/role`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleName: newRole })
  });
  const data = await res.json();
  if (res.ok) {
    showToast(data.message, 'success');
    loadUsersList();
  } else {
    showToast(data.error, 'error');
  }
}

async function unlockAccount(userId) {
  const res = await fetch(`/api/users/${userId}/unlock`, { method: 'PUT' });
  const data = await res.json();
  if (res.ok) {
    showToast(data.message, 'success');
    loadUsersList();
  }
}

async function loadAuditLogEntries() {
  const user = document.getElementById('auditUserFilter').value;
  const mod = document.getElementById('auditModuleFilter').value;
  const action = document.getElementById('auditActionFilter').value;

  const url = `/api/audit-logs?user=${encodeURIComponent(user)}&module=${encodeURIComponent(mod)}&action=${encodeURIComponent(action)}`;
  const res = await fetch(url);
  if (!res.ok) return;
  const logs = (await res.json()).data || [];

  const tbody = document.querySelector('#auditLogsTable tbody');
  tbody.innerHTML = logs.map(l => `
    <tr>
      <td class="text-nowrap font-monospace text-muted small">${l.createdDate ? l.createdDate.replace('T', ' ').split('.')[0] : '-'}</td>
      <td class="fw-semibold text-dark">${l.userName || 'System'}</td>
      <td><span class="badge bg-dark">${l.action}</span></td>
      <td><span class="badge bg-secondary">${l.entityName}</span></td>
      <td class="font-monospace small">${l.recordId || '-'}</td>
      <td>${l.ipAddress || '127.0.0.1'}</td>
      <td><span class="badge-status ${l.result === 'Success' ? 'badge-active' : 'badge-lost'}">${l.result}</span></td>
      <td class="small text-muted">${l.details || '-'}</td>
    </tr>
  `).join('');
}

async function loadReportView(type, btn) {
  currentReportType = type;
  if (btn) {
    document.querySelectorAll('#reportNavTabs .nav-link').forEach(l => l.classList.remove('active'));
    btn.classList.add('active');
  }

  const head = document.getElementById('reportHead');
  const body = document.getElementById('reportBody');

  if (type === 'customers') {
    const res = await fetch('/api/customers');
    const data = (await res.json()).data || [];
    activeReportDataSet = data;
    head.innerHTML = `<tr><th>Code</th><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Owner</th></tr>`;
    body.innerHTML = data.map(c => `<tr><td>${c.customerCode}</td><td class="fw-semibold">${c.customerName}</td><td>${c.email}</td><td>${c.phone}</td><td>${c.status}</td><td>${c.ownerName || '-'}</td></tr>`).join('');
  } else if (type === 'leads') {
    const res = await fetch('/api/leads');
    const data = (await res.json()).data || [];
    activeReportDataSet = data;
    head.innerHTML = `<tr><th>Code</th><th>Lead Name</th><th>Source</th><th>Status</th><th>Value</th><th>Owner</th></tr>`;
    body.innerHTML = data.map(l => `<tr><td>${l.leadCode}</td><td class="fw-semibold">${l.leadName}</td><td>${l.source}</td><td>${l.status}</td><td>${formatCurrency(l.expectedValue)}</td><td>${l.ownerName || '-'}</td></tr>`).join('');
  } else if (type === 'opportunities') {
    const res = await fetch('/api/opportunities');
    const data = (await res.json()).data || [];
    activeReportDataSet = data;
    head.innerHTML = `<tr><th>Deal Name</th><th>Customer</th><th>Stage</th><th>Amount</th><th>Prob (%)</th><th>Close Date</th></tr>`;
    body.innerHTML = data.map(o => `<tr><td class="fw-semibold">${o.opportunityName}</td><td>${o.customerName}</td><td>${o.stage}</td><td>${formatCurrency(o.amount)}</td><td>${o.probability}%</td><td>${formatDate(o.expectedCloseDate)}</td></tr>`).join('');
  }
}

function exportCurrentReportCSV() {
  if (!activeReportDataSet || activeReportDataSet.length === 0) return showToast('No data available to export.', 'error');
  const headers = Object.keys(activeReportDataSet[0]).join(',');
  const rows = activeReportDataSet.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const csv = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
  const link = document.createElement("a");
  link.href = encodeURI(csv);
  link.download = `Acxiom_${currentReportType}_Report.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function runApiPresetSelect() {
  const preset = document.getElementById('apiPreset').value;
  const [method, path] = preset.split(' ');
  document.getElementById('apiMethodInput').value = method;
  document.getElementById('apiPathInput').value = path;
  document.getElementById('apiBodyInput').value = method === 'POST' ? '{\n  "customerName": "Acme Test",\n  "email": "test@acme.com",\n  "phone": "9876543210"\n}' : '';
}

async function sendApiExplorerRequest() {
  const method = document.getElementById('apiMethodInput').value;
  const path = document.getElementById('apiPathInput').value;
  const bodyText = document.getElementById('apiBodyInput').value;
  const output = document.getElementById('apiJsonResult');

  output.textContent = 'Sending request...';
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if ((method === 'POST' || method === 'PUT') && bodyText) {
    try {
      opts.body = JSON.stringify(JSON.parse(bodyText));
    } catch (e) {
      output.textContent = 'Error: Invalid JSON body format.';
      return;
    }
  }

  try {
    const res = await fetch(path, opts);
    const data = await res.json();
    output.textContent = `HTTP ${res.status} ${res.statusText}\n\n` + JSON.stringify(data, null, 2);
  } catch (err) {
    output.textContent = 'Request failed: ' + err.message;
  }
}
