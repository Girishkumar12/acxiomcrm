let leadChartInstance = null;
let oppChartInstance = null;
let salesChartInstance = null;

async function loadDashboardMetrics() {
  try {
    const [custRes, leadRes, oppRes, flwRes] = await Promise.all([
      fetch('/api/customers'),
      fetch('/api/leads'),
      fetch('/api/opportunities'),
      fetch('/api/followups')
    ]);

    const customers = (await custRes.json()).data || [];
    const leads = (await leadRes.json()).data || [];
    const opps = (await oppRes.json()).data || [];
    const followups = (await flwRes.json()).data || [];

    // KPI Updates
    document.getElementById('kpiTotalCustomers').textContent = customers.length;
    
    const openLeads = leads.filter(l => l.status !== 'Converted' && l.status !== 'Lost');
    document.getElementById('kpiTotalLeads').textContent = leads.length;
    document.getElementById('kpiOpenLeadsSub').textContent = `${openLeads.length} active leads`;

    const openOpps = opps.filter(o => o.stage !== 'Won' && o.stage !== 'Lost');
    const wonOpps = opps.filter(o => o.stage === 'Won');
    const lostOpps = opps.filter(o => o.stage === 'Lost');

    document.getElementById('kpiOpenOpps').textContent = openOpps.length;
    document.getElementById('kpiWonLostSub').textContent = `${wonOpps.length} Won · ${lostOpps.length} Lost`;

    const pipelineTotal = openOpps.reduce((sum, o) => sum + (o.amount || 0), 0);
    document.getElementById('kpiPipelineValue').textContent = formatCurrency(pipelineTotal);

    // Follow-ups preview table
    const flwTbody = document.querySelector('#dashboardFollowupsTable tbody');
    if (flwTbody) {
      if (followups.length === 0) {
        flwTbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">No upcoming tasks scheduled.</td></tr>';
      } else {
        flwTbody.innerHTML = followups.slice(0, 5).map(f => `
          <tr>
            <td class="fw-semibold">${f.subject}</td>
            <td><span class="badge bg-light text-dark border">${f.followUpType}</span></td>
            <td>${formatDate(f.followUpDate)}</td>
            <td>${f.assignedUserName || 'Unassigned'}</td>
            <td>
              <span class="badge-status ${f.status === 'Completed' ? 'badge-active' : (f.status === 'Planned' ? 'badge-contacted' : 'badge-lost')}">
                ${f.status}
              </span>
            </td>
          </tr>
        `).join('');
      }
    }

    renderDashboardCharts(leads, opps);
  } catch (err) {
    console.error('[Dashboard] Load error:', err);
  }
}

function renderDashboardCharts(leads, opps) {
  // Chart 1: Lead Distribution
  const leadStatuses = ['New', 'Contacted', 'Qualified', 'Lost', 'Converted'];
  const leadCounts = leadStatuses.map(st => leads.filter(l => l.status === st).length);

  const ctxLead = document.getElementById('chartLeadStatus').getContext('2d');
  if (leadChartInstance) leadChartInstance.destroy();
  leadChartInstance = new Chart(ctxLead, {
    type: 'doughnut',
    data: {
      labels: leadStatuses,
      datasets: [{
        data: leadCounts,
        backgroundColor: ['#6366f1', '#0ea5e9', '#10b981', '#ef4444', '#8b5cf6'],
        borderWidth: 0
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });

  // Chart 2: Pipeline Stages
  const stages = ['Qualification', 'Proposal', 'Negotiation', 'Won', 'Lost'];
  const oppCounts = stages.map(st => opps.filter(o => o.stage === st).length);

  const ctxOpp = document.getElementById('chartOppPipeline').getContext('2d');
  if (oppChartInstance) oppChartInstance.destroy();
  oppChartInstance = new Chart(ctxOpp, {
    type: 'bar',
    data: {
      labels: stages,
      datasets: [{
        label: 'Active Deals',
        data: oppCounts,
        backgroundColor: ['#38bdf8', '#fbbf24', '#c084fc', '#10b981', '#f87171'],
        borderRadius: 6
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  // Chart 3: Quarterly Growth
  const months = ['Q1', 'Q2', 'Q3', 'Q4'];
  const salesData = [45000, 78000, 110000, 145000];

  const ctxSales = document.getElementById('chartSalesTrend').getContext('2d');
  if (salesChartInstance) salesChartInstance.destroy();
  salesChartInstance = new Chart(ctxSales, {
    type: 'line',
    data: {
      labels: months,
      datasets: [{
        label: 'Closed Revenue ($)',
        data: salesData,
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 4
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}
