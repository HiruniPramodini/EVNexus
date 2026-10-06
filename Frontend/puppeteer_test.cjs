const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/api/')) {
      console.log('Response:', url, response.status());
    }
  });

  page.on('request', request => {
    const url = request.url();
    if (url.includes('/api/payment/wallet') || url.includes('/api/map/driver/')) {
      console.log('Request Headers for', url, ':', request.headers());
    }
  });

  await page.goto('http://localhost:5173'); 
  
  await new Promise(r => setTimeout(r, 2000));
  
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes('Driver Login')) {
      await btn.click();
      break;
    }
  }
  
  await new Promise(r => setTimeout(r, 1000));
  
  await page.type('input[type="email"]', 'testdriver999@example.com');
  await page.type('input[type="password"]', 'Password123!');
  await page.click('button[type="submit"]');
  
  await new Promise(r => setTimeout(r, 5000));
  
  const localStorageData = await page.evaluate(() => {
    return {
      token: localStorage.getItem('evnexus_auth_token'),
      user: localStorage.getItem('evnexus_auth_user')
    };
  });
  console.log('LocalStorage state after login:', localStorageData);
  
  await browser.close();
})();
