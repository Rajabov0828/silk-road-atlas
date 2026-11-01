const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;

const proc = spawn(CHROME, [
  '--headless',
  `--remote-debugging-port=${PORT}`,
  '--disable-gpu',
  '--window-size=1280,800',
  '--no-sandbox',
  'https://d3fx98y0gpu4w7.cloudfront.net/'
]);

setTimeout(async () => {
  try {
    const tabs = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${PORT}/json`, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => resolve(JSON.parse(body)));
      }).on('error', reject);
    });

    const pageTab = tabs.find(t => t.type === 'page');
    const WebSocket = require('ws');
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

    ws.on('open', () => {
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));

      const check = setInterval(() => {
        ws.send(JSON.stringify({
          id: 3,
          method: 'Runtime.evaluate',
          params: { expression: "document.querySelectorAll('.site').length" }
        }));
      }, 500);

      ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.id === 3 && msg.result?.result?.value > 0) {
          clearInterval(check);
          // Click site
          ws.send(JSON.stringify({
            id: 4,
            method: 'Runtime.evaluate',
            params: { expression: "document.querySelector('.site').click()" }
          }));

          // Take screenshot after photo loads
          setTimeout(() => {
            ws.send(JSON.stringify({ id: 5, method: 'Page.captureScreenshot' }));
          }, 4000);
        } else if (msg.id === 5) {
          fs.writeFileSync('live_popup_screenshot.png', Buffer.from(msg.result.data, 'base64'));
          console.log('Saved live_popup_screenshot.png');
          ws.close();
          proc.kill();
          process.exit(0);
        }
      });
    });

  } catch (err) {
    console.error(err);
    proc.kill();
  }
}, 2000);
