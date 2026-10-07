/**
 * AcxiomCRM Application Bootstrapper
 */

window.currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  await initializeSession();
  bindFormSubmissions();
  navigateToSection('dashboard');
});

async function initializeSession() {
  try {
    const res = await fetch('/api/customers');
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }

    const cached = localStorage.getItem('acxiom_user_session');
    if (cached) {
      window.currentUser = JSON.parse(cached);
    } else {
      window.currentUser = { userId: 'usr_admin_01', name: 'Elena Vance', email: 'admin@acxiom.com', roleName: 'Admin' };
    }

    renderUserHeader();
  } catch (e) {
    console.error('Session initialization error:', e);
  }
}

function renderUserHeader() {
  if (!window.currentUser) return;
  document.getElementById('headerUserName').textContent = window.currentUser.name;
  const badge = document.getElementById('headerUserRole');
  badge.textContent = window.currentUser.roleName;

  badge.className = 'badge ' + (
    window.currentUser.roleName === 'Admin' ? 'badge-role-admin' :
    (window.currentUser.roleName === 'Manager' ? 'badge-role-manager' : 'badge-role-sales')
  );

  // Toggle role restricted menu items
  document.querySelectorAll('.role-admin-mgr').forEach(el => {
    if (window.currentUser.roleName === 'SalesExecutive') el.classList.add('d-none');
    else el.classList.remove('d-none');
  });
}

async function switchRoleProfile(email) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Password123!' })
    });
    if (res.ok) {
      const data = await res.json();
      window.currentUser = data.user;
      localStorage.setItem('acxiom_user_session', JSON.stringify(data.user));
      renderUserHeader();
      showToast(`Switched active profile to ${data.user.name} (${data.user.roleName})`, 'success');
      refreshCurrentSection();
    }
  } catch (err) {
    showToast('Failed to switch profile.', 'error');
  }
}

function handleLogout() {
  fetch('/api/auth/logout', { method: 'POST' }).then(() => {
    localStorage.removeItem('acxiom_user_session');
    window.location.href = '/login';
  });
}

function navigateToSection(sectionId, btn) {
  document.querySelectorAll('.view-panel').forEach(p => p.classList.add('d-none'));
  document.querySelectorAll('.nav-item-btn').forEach(b => b.classList.remove('active'));

  const target = document.getElementById(`view-${sectionId}`);
  if (target) target.classList.remove('d-none');

  if (btn) btn.classList.add('active');
  else {
    const el = document.querySelector(`.nav-item-btn[onclick*="${sectionId}"]`);
    if (el) el.classList.add('active');
  }

  // Section data trigger
  if (sectionId === 'dashboard') loadDashboardMetrics();
  else if (sectionId === 'customers') loadCustomersList();
  else if (sectionId === 'leads') loadLeadsList();
  else if (sectionId === 'opportunities') loadOpportunitiesList();
  else if (sectionId === 'followups') loadFollowUpsList();
  else if (sectionId === 'users') loadUsersList();
  else if (sectionId === 'audit') loadAuditLogEntries();
  else if (sectionId === 'reports') loadReportView('customers');
}

function refreshCurrentSection() {
  const activeView = document.querySelector('.view-panel:not(.d-none)');
  if (activeView) {
    const id = activeView.id.replace('view-', '');
    navigateToSection(id);
  }
}

function bindFormSubmissions() {
  // Customer Form
  document.getElementById('customerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('custName').value.trim();
    const email = document.getElementById('custEmail').value.trim();
    const phone = document.getElementById('custPhone').value.trim();
    const company = document.getElementById('custCompany').value.trim();
    const id = document.getElementById('custFormId').value;

    if (!name || !email || !phone) return showToast('Please fill out required customer fields.', 'error');

    const res = await fetch(id ? `/api/customers/${id}` : '/api/customers', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName: name, email, phone, companyName: company })
    });
    const data = await res.json();
    if (res.ok) {
      bootstrap.Modal.getInstance(document.getElementById('customerModal')).hide();
      showToast('Customer saved successfully!', 'success');
      loadCustomersList();
    } else {
      showToast(data.error || 'Validation error saving customer.', 'error');
    }
  });

  // Lead Form
  document.getElementById('leadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const leadName = document.getElementById('leadName').value.trim();
    const email = document.getElementById('leadEmail').value.trim();
    const phone = document.getElementById('leadPhone').value.trim();
    const expectedValue = parseFloat(document.getElementById('leadExpValue').value);

    if (!leadName || !email || !phone) return showToast('Lead contact information required.', 'error');

    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadName, email, phone, expectedValue })
    });
    const data = await res.json();
    if (res.ok) {
      bootstrap.Modal.getInstance(document.getElementById('leadModal')).hide();
      showToast('Lead captured successfully.', 'success');
      loadLeadsList();
    } else {
      showToast(data.error || 'Error saving lead.', 'error');
    }
  });

  // Opportunity Form (Validation: Amount > 0, Prob 0-100, Date >= Today)
  document.getElementById('oppForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const opportunityName = document.getElementById('oppName').value.trim();
    const customerId = document.getElementById('oppCustomerId').value;
    const amount = parseFloat(document.getElementById('oppAmount').value);
    const stage = document.getElementById('oppStage').value;
    const probability = parseInt(document.getElementById('oppProbability').value);
    const expectedCloseDate = document.getElementById('oppCloseDate').value;
    const todayStr = new Date().toISOString().split('T')[0];

    if (!opportunityName) return showToast('Opportunity name required.', 'error');
    if (isNaN(amount) || amount <= 0) return showToast('Deal Amount must be greater than 0.', 'error');
    if (isNaN(probability) || probability < 0 || probability > 100) return showToast('Probability must be between 0 and 100%.', 'error');
    if (stage !== 'Won' && stage !== 'Lost' && expectedCloseDate < todayStr) return showToast('Target close date cannot be in the past.', 'error');

    const res = await fetch('/api/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunityName, customerId, amount, stage, probability, expectedCloseDate })
    });
    const data = await res.json();
    if (res.ok) {
      bootstrap.Modal.getInstance(document.getElementById('oppModal')).hide();
      showToast('Deal opportunity created.', 'success');
      loadOpportunitiesList();
    } else {
      showToast(data.error || 'Opportunity validation failed.', 'error');
    }
  });

  // Follow-Up Form (Validation: Date >= Today)
  document.getElementById('followUpForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const subject = document.getElementById('flwSubject').value.trim();
    const followUpDate = document.getElementById('flwDate').value;
    const followUpType = document.getElementById('flwType').value;
    const remarks = document.getElementById('flwRemarks').value;
    const todayStr = new Date().toISOString().split('T')[0];

    if (!subject) return showToast('Task subject required.', 'error');
    if (!followUpDate || followUpDate < todayStr) return showToast('Task date cannot be earlier than today.', 'error');

    const res = await fetch('/api/followups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, followUpDate, followUpType, remarks, status: 'Planned' })
    });
    const data = await res.json();
    if (res.ok) {
      bootstrap.Modal.getInstance(document.getElementById('followUpModal')).hide();
      showToast('Task scheduled.', 'success');
      loadFollowUpsList();
    } else {
      showToast(data.error || 'Error scheduling task.', 'error');
    }
  });
}
