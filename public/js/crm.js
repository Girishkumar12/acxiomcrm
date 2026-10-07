/**
 * CRM Core Modules Controller (Customers, Leads, Opportunities, Follow-Ups)
 */

// CUSTOMERS
async function loadCustomersList() {
  const search = document.getElementById('custSearchInput').value;
  const status = document.getElementById('custStatusSelect').value;

  const res = await fetch(`/api/customers?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`);
  const data = await res.json();
  const list = data.data || [];

  const tbody = document.querySelector('#customersTable tbody');
  tbody.innerHTML = list.map(c => `
    <tr>
      <td class="font-monospace text-muted small">${c.customerCode}</td>
      <td class="fw-semibold text-dark">${c.customerName}</td>
      <td>${c.companyName || '-'}</td>
      <td>${c.email}</td>
      <td>${c.phone}</td>
      <td><span class="badge bg-light text-dark border">${c.ownerName || 'Unassigned'}</span></td>
      <td><span class="badge-status ${c.status === 'Active' ? 'badge-active' : 'badge-inactive'}">${c.status}</span></td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-secondary me-1 py-0 px-2" onclick="openEditCustomer('${c.customerId}')"><i class="bi bi-pencil"></i></button>
        ${c.status === 'Active' && window.currentUser.roleName !== 'SalesExecutive' ? `
          <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="deactivateCustomerRecord('${c.customerId}')"><i class="bi bi-x-circle"></i></button>
        ` : ''}
      </td>
    </tr>
  `).join('');
}

function openCreateCustomerModal() {
  document.getElementById('customerForm').reset();
  document.getElementById('custFormId').value = '';
  document.getElementById('customerModalHeader').textContent = 'Add Enterprise Customer';
  new bootstrap.Modal(document.getElementById('customerModal')).show();
}

async function openEditCustomer(id) {
  const res = await fetch(`/api/customers/${id}`);
  if (!res.ok) return showToast('Unable to fetch customer record.', 'error');
  const c = await res.json();

  document.getElementById('custFormId').value = c.customerId;
  document.getElementById('custName').value = c.customerName;
  document.getElementById('custEmail').value = c.email;
  document.getElementById('custPhone').value = c.phone;
  document.getElementById('custCompany').value = c.companyName || '';
  document.getElementById('customerModalHeader').textContent = 'Edit Customer Record';

  new bootstrap.Modal(document.getElementById('customerModal')).show();
}

async function deactivateCustomerRecord(id) {
  if (!confirm('Deactivate this customer account?')) return;
  const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (res.ok) {
    showToast(data.message, 'success');
    loadCustomersList();
  } else {
    showToast(data.error || 'Failed to deactivate customer.', 'error');
  }
}

// LEADS
async function loadLeadsList() {
  const search = document.getElementById('leadSearchInput').value;
  const status = document.getElementById('leadStatusSelect').value;

  const res = await fetch(`/api/leads?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`);
  const data = await res.json();
  const leads = data.data || [];

  const tbody = document.querySelector('#leadsTable tbody');
  tbody.innerHTML = leads.map(l => `
    <tr>
      <td class="font-monospace text-muted small">${l.leadCode}</td>
      <td class="fw-semibold text-dark">${l.leadName}</td>
      <td>${l.companyName || '-'}</td>
      <td>${l.email}</td>
      <td><span class="badge bg-light text-dark border">${l.source}</span></td>
      <td class="fw-semibold text-dark">${formatCurrency(l.expectedValue)}</td>
      <td>${l.ownerName || 'Unassigned'}</td>
      <td>
        <span class="badge-status ${
          l.status === 'Converted' ? 'badge-converted' :
          (l.status === 'Qualified' ? 'badge-qualified' :
          (l.status === 'Contacted' ? 'badge-contacted' : 'badge-new'))
        }">${l.status}</span>
      </td>
      <td class="text-end">
        ${l.status !== 'Converted' ? `
          <button class="btn btn-sm btn-outline-success py-0 px-2 fw-semibold" onclick="convertLeadToCustomer('${l.leadId}')"><i class="bi bi-arrow-right-circle"></i> Convert</button>
        ` : '<span class="text-muted small">Converted</span>'}
      </td>
    </tr>
  `).join('');
}

function openCreateLeadModal() {
  document.getElementById('leadForm').reset();
  new bootstrap.Modal(document.getElementById('leadModal')).show();
}

async function convertLeadToCustomer(id) {
  if (!confirm('Convert this lead into an active Customer and sales Deal?')) return;
  const res = await fetch(`/api/leads/${id}/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ createOpportunity: true })
  });
  const data = await res.json();
  if (res.ok) {
    showToast(data.message, 'success');
    loadLeadsList();
  } else {
    showToast(data.error || 'Lead conversion failed.', 'error');
  }
}

// OPPORTUNITIES
async function loadOpportunitiesList() {
  const search = document.getElementById('oppSearchInput').value;
  const stage = document.getElementById('oppStageSelect').value;

  const res = await fetch(`/api/opportunities?search=${encodeURIComponent(search)}&stage=${encodeURIComponent(stage)}`);
  const data = await res.json();
  const opps = data.data || [];

  const tbody = document.querySelector('#opportunitiesTable tbody');
  tbody.innerHTML = opps.map(o => `
    <tr>
      <td class="fw-semibold text-dark">${o.opportunityName}</td>
      <td>${o.customerName}</td>
      <td class="fw-semibold">${formatCurrency(o.amount)}</td>
      <td>
        <span class="badge-status ${
          o.stage === 'Won' ? 'badge-active' :
          (o.stage === 'Lost' ? 'badge-lost' : 'badge-new')
        }">${o.stage}</span>
      </td>
      <td>${o.probability}%</td>
      <td class="fw-semibold text-primary">${formatCurrency(o.weightedPipeline)}</td>
      <td>${formatDate(o.expectedCloseDate)}</td>
      <td>${o.ownerName || 'Unassigned'}</td>
    </tr>
  `).join('');
}

async function openCreateOpportunityModal() {
  document.getElementById('oppForm').reset();
  document.getElementById('oppCloseDate').value = new Date().toISOString().split('T')[0];

  const res = await fetch('/api/customers');
  const custs = (await res.json()).data || [];
  const custSelect = document.getElementById('oppCustomerId');
  custSelect.innerHTML = custs.map(c => `<option value="${c.customerId}">${c.customerName} (${c.customerCode})</option>`).join('');

  new bootstrap.Modal(document.getElementById('oppModal')).show();
}

// FOLLOW-UPS
async function loadFollowUpsList() {
  const res = await fetch('/api/followups');
  const data = await res.json();
  const followups = data.data || [];

  const tbody = document.querySelector('#followUpsTable tbody');
  tbody.innerHTML = followups.map(f => `
    <tr>
      <td class="fw-semibold text-dark">${f.subject}</td>
      <td><span class="badge bg-light text-dark border">${f.followUpType}</span></td>
      <td>${formatDate(f.followUpDate)}</td>
      <td>${f.remarks || '-'}</td>
      <td>${f.assignedUserName || 'Unassigned'}</td>
      <td>
        <span class="badge-status ${f.status === 'Completed' ? 'badge-active' : (f.status === 'Planned' ? 'badge-contacted' : 'badge-lost')}">
          ${f.status}
        </span>
      </td>
      <td class="text-end">
        ${f.status === 'Planned' ? `
          <button class="btn btn-sm btn-success py-0 px-2 me-1" onclick="changeFollowUpState('${f.followUpId}', 'Completed')">Done</button>
          <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="changeFollowUpState('${f.followUpId}', 'Cancelled')">Cancel</button>
        ` : '-'}
      </td>
    </tr>
  `).join('');
}

function openCreateFollowUpModal() {
  document.getElementById('followUpForm').reset();
  document.getElementById('flwDate').value = new Date().toISOString().split('T')[0];
  new bootstrap.Modal(document.getElementById('followUpModal')).show();
}

async function changeFollowUpState(id, status) {
  const res = await fetch(`/api/followups/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (res.ok) {
    showToast(`Task marked as ${status}`, 'success');
    loadFollowUpsList();
  }
}
