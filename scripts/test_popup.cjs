const { spawn } = require('child_process');
const http = require('http');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;

const proc = spawn(CHROME, [
  '--headless',
  `--remote-debugging-port=${PORT}`,
  '--disable-gpu',
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

      // Poll until .site list is populated
      const interval = setInterval(() => {
        ws.send(JSON.stringify({
          id: 2,
          method: 'Runtime.evaluate',
          params: { expression: "document.querySelectorAll('.site').length" }
        }));
      }, 500);

      ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.id === 2 && msg.result?.result?.value > 0) {
          clearInterval(interval);
          console.log('Sites found on page:', msg.result.result.value);

          // Click first site
          ws.send(JSON.stringify({
            id: 3,
            method: 'Runtime.evaluate',
            params: { expression: "document.querySelector('.site').click()" }
          }));

          // Read popup after photo and geocoding finish
          setTimeout(() => {
            ws.send(JSON.stringify({
              id: 4,
              method: 'Runtime.evaluate',
              params: {
                expression: `JSON.stringify({
                  title: document.querySelector('.popup h3')?.innerText,
                  photo: document.querySelector('.popup-photo')?.src,
                  desc: document.querySelector('.popup-desc')?.innerText,
                  address: document.querySelector('.popup-address')?.innerText,
                  chips: Array.from(document.querySelectorAll('.chip')).map(c => c.innerText)
                })`
              }
            }));
          }, 3500);
        } else if (msg.id === 4) {
          console.log('POPUP EVAL RESULT:', msg.result?.result?.value);
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
