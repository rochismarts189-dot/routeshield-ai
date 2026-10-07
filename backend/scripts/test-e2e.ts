import fs from 'fs';
import path from 'path';

async function main() {
  const baseUrl = 'http://localhost:5000';

  console.log('1. Logging in...');
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'SecurePassword123!' }),
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    console.error('Login failed:', loginData);
    process.exit(1);
  }
  const token = loginData.token;
  console.log('✓ Logged in as:', loginData.user.email);

  console.log('2. Submitting visual report on edge BC...');
  const fixturePath = path.resolve(process.cwd(), '../demo/fixtures/obstruction_barrier_1.jpg');
  const imageBuffer = fs.readFileSync(fixturePath);
  const blob = new Blob([imageBuffer], { type: 'image/jpeg' });

  const formData = new FormData();
  formData.append('photo', blob, 'obstruction_barrier_1.jpg');
  formData.append('edgeId', 'BC');
  formData.append('claim', 'BLOCKED');
  formData.append('description', 'Construction barrier blocking the walkway');
  formData.append('observedAt', new Date().toISOString());

  const reportRes = await fetch(`${baseUrl}/api/reports`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const reportData = await reportRes.json();
  console.log('Report response status:', reportRes.status);
  console.log('Report response body:', JSON.stringify(reportData, null, 2));

  if (!reportRes.ok) {
    console.error('Report submission failed');
    process.exit(1);
  }

  const incidentId = reportData.incidentId;
  console.log('3. Fetching incident details for:', incidentId);
  const incRes = await fetch(`${baseUrl}/api/incidents/${incidentId}`);
  const incData = await incRes.json();
  console.log('✓ Incident status:', incData.incident.status);
  console.log('✓ Reports attached:', incData.incident.reports.length);

  console.log('4. Planning route A -> D under STEP_FREE...');
  const planRes = await fetch(`${baseUrl}/api/routes/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ originId: 'A', destinationId: 'D', profile: 'STEP_FREE' }),
  });
  const planData = await planRes.json();
  console.log('✓ Route status:', planData.status);
  console.log('✓ Route path:', planData.route?.nodeIds?.join(' -> '));
  console.log('✓ Route distance:', planData.route?.distanceMeters, 'm');
  console.log('✓ Warnings:', planData.warnings);
}

main().catch(console.error);
