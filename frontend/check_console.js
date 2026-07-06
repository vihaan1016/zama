import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  page.on('requestfailed', request =>
    console.log('BROWSER REQUEST FAILED:', request.url(), request.failure()?.errorText)
  );

  console.log('Navigating to localhost:5173...');
  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  } catch (err) {
    console.log('Goto error:', err.message);
  }

  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
