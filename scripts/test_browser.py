import json
import subprocess
import time
import urllib.request
import sys

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9222

# Start Chrome with remote debugging
proc = subprocess.Popen([
    CHROME,
    "--headless",
    f"--remote-debugging-port={PORT}",
    "--disable-gpu",
    "--no-sandbox",
    "https://d3fx98y0gpu4w7.cloudfront.net/"
])

time.sleep(3)

try:
    # Query DevTools list
    res = urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json")
    tabs = json.loads(res.read())
    print("Tabs found:", len(tabs))
    for t in tabs:
        print("Tab:", t.get("title"), t.get("url"))
        ws_url = t.get("webSocketDebuggerUrl")
        print("WS:", ws_url)
finally:
    proc.terminate()
