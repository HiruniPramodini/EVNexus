// Test-only scratch script
const testEmail = process.env.TEST_DRIVER_EMAIL || 'testdriver999@example.com';
const testPassword = process.env.TEST_DRIVER_PASSWORD || 'Password123!';

fetch('http://localhost:5000/api/auth/driver/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPassword })
})
.then(res => res.json())
.then(data => console.log(JSON.stringify(data, null, 2)))
.catch(console.error);
