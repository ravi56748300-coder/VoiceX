import puppeteer from 'puppeteer';
(async () => {
  try {
    const browser = await puppeteer.launch({ executablePath: 'C:\\Users\\laptop solutions\\.cache\\puppeteer\\chrome\\win64-151.0.7922.47\\chrome-win64\\chrome.exe' });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
    page.on('requestfailed', request => console.error('REQUEST FAILED:', request.url(), request.failure()?.errorText));
    
    await page.goto('http://localhost:5500', { waitUntil: 'networkidle0' });
    console.log("Page loaded!");
    await browser.close();
  } catch (err) {
    console.error("Puppeteer error:", err);
  }
})();
