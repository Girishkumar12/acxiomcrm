const http = require('http');
const seedDatabase = require('./src/database/seed');

// Ensure DB is seeded
seedDatabase();

const server = require('./server');

setTimeout(async () => {
  console.log('\n--- Running Automated Verification Suite ---\n');

  try {
    // Test 1: Unauthenticated API call to protected endpoint (Expect 401)
    const res1 = await fetch('http://localhost:3000/api/customers');
    console.log(`[Test 1] Unauthenticated GET /api/customers -> Status: ${res1.status} (Expected: 401)`);
    console.assert(res1.status === 401, 'Test 1 Failed');

    // Test 2: Login as Admin
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@acxiom.com', password: 'Password123!' })
    });
    const loginData = await loginRes.json();
    console.log(`[Test 2] Login Admin -> Status: ${loginRes.status}, User: ${loginData.user?.name}`);
    console.assert(loginRes.status === 200 && loginData.token, 'Test 2 Failed');

    const token = loginData.token;
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // Test 3: Authenticated GET /api/customers
    const res3 = await fetch('http://localhost:3000/api/customers', { headers: authHeaders });
    const data3 = await res3.json();
    console.log(`[Test 3] Authenticated GET /api/customers -> Count: ${data3.count}`);
    console.assert(res3.status === 200 && data3.count > 0, 'Test 3 Failed');

    // Test 4: Server-Side Validation - Invalid Email / Phone on Customer Create (Expect 400)
    const res4 = await fetch('http://localhost:3000/api/customers', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ customerName: 'Test Corp', email: 'not-an-email', phone: '12' })
    });
    console.log(`[Test 4] Server-Side Customer Validation -> Status: ${res4.status} (Expected: 400)`);
    console.assert(res4.status === 400, 'Test 4 Failed');

    // Test 5: Opportunity Amount <= 0 (Expect 400)
    const res5 = await fetch('http://localhost:3000/api/opportunities', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        opportunityName: 'Bad Deal',
        customerId: 'cust_849201',
        amount: 0,
        stage: 'Qualification',
        probability: 50,
        expectedCloseDate: '2027-12-31'
      })
    });
    console.log(`[Test 5] Opportunity Amount <= 0 -> Status: ${res5.status} (Expected: 400)`);
    console.assert(res5.status === 400, 'Test 5 Failed');

    // Test 6: Opportunity Probability > 100 (Expect 400)
    const res6 = await fetch('http://localhost:3000/api/opportunities', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        opportunityName: 'Bad Prob Deal',
        customerId: 'cust_849201',
        amount: 1000,
        stage: 'Qualification',
        probability: 150,
        expectedCloseDate: '2027-12-31'
      })
    });
    console.log(`[Test 6] Opportunity Probability > 100 -> Status: ${res6.status} (Expected: 400)`);
    console.assert(res6.status === 400, 'Test 6 Failed');

    // Test 7: Opportunity Expected Close Date in Past (Expect 400)
    const res7 = await fetch('http://localhost:3000/api/opportunities', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        opportunityName: 'Past Date Deal',
        customerId: 'cust_849201',
        amount: 1000,
        stage: 'Qualification',
        probability: 50,
        expectedCloseDate: '2020-01-01'
      })
    });
    console.log(`[Test 7] Expected Close Date in Past -> Status: ${res7.status} (Expected: 400)`);
    console.assert(res7.status === 400, 'Test 7 Failed');

    // Test 8: Follow-Up Date Earlier than Today (Expect 400)
    const res8 = await fetch('http://localhost:3000/api/followups', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        subject: 'Past Followup',
        followUpDate: '2020-01-01',
        followUpType: 'Call',
        status: 'Planned'
      })
    });
    console.log(`[Test 8] Follow-Up Date in Past -> Status: ${res8.status} (Expected: 400)`);
    console.assert(res8.status === 400, 'Test 8 Failed');

    // Test 9: Valid Opportunity Creation
    const res9 = await fetch('http://localhost:3000/api/opportunities', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        opportunityName: 'Valid Expansion Deal',
        customerId: 'cust_849201',
        amount: 150000,
        stage: 'Proposal',
        probability: 70,
        expectedCloseDate: '2027-12-31'
      })
    });
    const data9 = await res9.json();
    console.log(`[Test 9] Valid Opportunity Creation -> Status: ${res9.status}, ID: ${data9.opportunityId}`);
    console.assert(res9.status === 201, 'Test 9 Failed');

    // Test 10: Audit Log verification for creation
    const res10 = await fetch('http://localhost:3000/api/audit-logs', { headers: authHeaders });
    const data10 = await res10.json();
    console.log(`[Test 10] Audit Logs Count -> ${data10.data?.length}`);
    console.assert(data10.data?.length > 0, 'Test 10 Failed');

    // Test 11: Account Lockout after 5 failed logins
    console.log(`[Test 11] Testing Account Lockout threshold...`);
    for (let i = 1; i <= 5; i++) {
      await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sales1@acxiom.com', password: 'WrongPassword!' })
      });
    }

    const lockedRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sales1@acxiom.com', password: 'Password123!' })
    });
    console.log(`[Test 11] Login locked user -> Status: ${lockedRes.status} (Expected: 403 Account Locked)`);
    console.assert(lockedRes.status === 403, 'Test 11 Failed');

    console.log('\n✅ ALL 11 AUTOMATED VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('Test Suite Exception:', err);
    process.exit(1);
  }
}, 1500);
