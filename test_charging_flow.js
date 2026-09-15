const API_URL = 'http://localhost:5000/api';

async function runTests() {
    console.log("=========================================");
    console.log("🔋 EVNexus End-to-End Automated Test Flow (50 Iterations)");
    console.log("=========================================\n");

    try {
        const rand = Math.floor(Math.random() * 100000);
        const companyEmail = `colomboco${rand}@evnexus.com`;

        // 1. COMPANY REGISTRATION
        console.log(`[1/3] 🏢 Registering Company: ${companyEmail} (Auto-Approved)`);
        const regCoRes = await fetch(`${API_URL}/auth/company/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                companyName: "Colombo Charging Network",
                registrationNumber: `REG-${rand}`,
                businessEmail: companyEmail,
                phone: "077-1234567",
                address: "Lotus Tower, Colombo",
                password: "Password123!"
            })
        });
        const coData = await regCoRes.json();
        if (!coData.success) throw new Error("Company registration failed: " + JSON.stringify(coData));
        
        await fetch(`${API_URL}/auth/company/verify-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: companyEmail, verificationCode: coData.data.verificationCode })
        });

        const coLoginRes = await fetch(`${API_URL}/auth/company/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ businessEmail: companyEmail, password: "Password123!" })
        });
        const coLoginData = await coLoginRes.json();
        if (!coLoginData.success) throw new Error("Company login failed: " + JSON.stringify(coLoginData));
        const coToken = coLoginData.data.accessToken;

        // 2. STATION CREATION (COLOMBO)
        console.log(`[2/3] 🔌 Creating a Charging Station in Colombo`);
        const createStationRes = await fetch(`${API_URL}/map/company/stations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coToken}` },
            body: JSON.stringify({
                name: "Lotus Tower Fast Charger",
                address: "Lotus Tower, Colombo, Sri Lanka",
                latitude: 6.927100,
                longitude: 79.861200,
                status: "Active",
                capacityKw: 150.0,
                connectorType: "CCS",
                pricePerKwh: 0.80
            })
        });
        const textResponse = await createStationRes.text();
        console.log("Status:", createStationRes.status);
        console.log("Response text:", textResponse);
        const stationResData = JSON.parse(textResponse);
        console.log("Station creation response:", stationResData);
        if (!stationResData.success) throw new Error("Station creation failed: " + JSON.stringify(stationResData));
        const stationId = stationResData.id;
        const chargingCode = stationResData.code;
        console.log(`      ✅ Station created successfully! Generated Charging Code: ${chargingCode}`);

        // 3. DRIVER REGISTRATION & LOOP 50 TIMES
        console.log(`\n[3/3] 🚗 Running 50 random charging session tests...`);
        const driverEmail = `driver${rand}@example.com`;
        const regDriverRes = await fetch(`${API_URL}/auth/driver/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: "Test Driver",
                email: driverEmail,
                phone: "077-9999888",
                password: "Password123!"
            })
        });
        const drData = await regDriverRes.json();
        if (!drData.success) throw new Error("Driver registration failed: " + JSON.stringify(drData));

        await fetch(`${API_URL}/auth/driver/verify-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: driverEmail, verificationCode: drData.data.verificationCode })
        });

        const drLoginRes = await fetch(`${API_URL}/auth/driver/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: driverEmail, password: "Password123!" })
        });
        const drLoginData = await drLoginRes.json();
        if (!drLoginData.success) throw new Error("Driver login failed: " + JSON.stringify(drLoginData));
        const drToken = drLoginData.data.accessToken;

        let successCount = 0;
        for (let i = 1; i <= 50; i++) {
            process.stdout.write(`      Test ${i}/50: Starting session... `);
            try {
                const startSessionRes = await fetch(`${API_URL}/map/driver/sessions/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${drToken}` },
                    body: JSON.stringify({ chargingCode: chargingCode })
                });
                const startText = await startSessionRes.text();
                if (!startSessionRes.ok) {
                    console.log(`❌ Failed (${startSessionRes.status}): ${startText}`);
                    continue;
                }
                const startData = JSON.parse(startText);
                const sessionId = startData.data.id;
                
                // Simulate 200ms of charging
                await new Promise(resolve => setTimeout(resolve, 200));

                const stopSessionRes = await fetch(`${API_URL}/map/driver/sessions/${sessionId}/stop`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${drToken}` }
                });
                const stopData = await stopSessionRes.json();
                if (stopData.success) {
                    console.log(`✅ Passed (Cost: $${stopData.data.totalCost})`);
                    successCount++;
                } else {
                    console.log(`❌ Stop Failed (${stopData.message})`);
                }
            } catch (err) {
                console.log(`❌ Error: ${err.message}`);
            }
        }

        console.log(`\n🎉 RAN 50 TESTS! (${successCount}/50 Passed)`);
        console.log("Check the frontend UI at Colombo coordinates to see the new blue pin.");

    } catch (error) {
        console.error("\n❌ TEST SUITE FAILED:");
        console.error(error.message);
    }
}

runTests();
