"""Local development server that simulates API Gateway + Lambda.

Run with:
    cd backend
    python -m app.local_server
"""

import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

from .handler import handler

PORT = 8000


class LocalHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        self._dispatch("GET")

    def do_POST(self) -> None:
        self._dispatch("POST")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _dispatch(self, method: str) -> None:
        parsed = urlparse(self.path)
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else None

        query_params: dict[str, str] = {}
        if parsed.query:
            from urllib.parse import parse_qs

            query_params = {k: v[0] for k, v in parse_qs(parsed.query).items()}

        event = {
            "rawPath": parsed.path,
            "requestContext": {"http": {"method": method}},
            "queryStringParameters": query_params,
            "headers": {k.lower(): v for k, v in self.headers.items()},
            "body": body,
        }

        response = handler(event)
        self.send_response(response["statusCode"])
        for k, v in response.get("headers", {}).items():
            self.send_header(k, v)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(response["body"].encode("utf-8"))

    def log_message(self, format: str, *args: object) -> None:
        print(f"[API] {args[0]} {args[1]}")


def main() -> None:
    server = HTTPServer(("127.0.0.1", PORT), LocalHandler)
    print(f"Silk Road Atlas local API server running on http://127.0.0.1:{PORT}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        server.server_close()


if __name__ == "__main__":
    main()
