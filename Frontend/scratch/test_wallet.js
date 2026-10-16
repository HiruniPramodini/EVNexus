// Test-only scratch script: dynamically authenticates to get a fresh token
async function testWallet() {
    const loginRes = await fetch('http://localhost:5000/api/auth/driver/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: process.env.TEST_DRIVER_EMAIL || 'testdriver999@example.com',
            password: process.env.TEST_DRIVER_PASSWORD || 'Password123!'
        })
    });
    const loginData = await loginRes.json();
    const token = loginData?.data?.accessToken;
    if (!token) {
        console.error('Failed to obtain test token:', loginData);
        return;
    }

    const res = await fetch('http://localhost:5000/api/payment/wallet', {
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    });
    console.log('Status:', res.status);
    console.log(await res.text());
}

testWallet().catch(console.error);
