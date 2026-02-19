from pathlib import Path
import sys
import json

from fastapi.testclient import TestClient

# Ensure imports work regardless of current working directory/shell.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import app


def main() -> None:
    def print_json(label: str, payload: object) -> None:
        print(f"{label}: {json.dumps(payload, ensure_ascii=True)}")

    with TestClient(app) as client:
        print_json("health", client.get("/health").json())
        print_json("ping", client.get("/api/system/ping").json())
        print_json("settings:get", client.get("/api/settings").json())
        print_json(
            "settings:test-connection",
            client.post(
                "/api/settings/test-connection",
                json={
                    "service_type": "llm",
                    "provider": "openai_compatible",
                    "api_key": "",
                    "base_url": "https://api.openai.com/v1",
                    "model": "gpt-4o-mini",
                },
            ).json(),
        )
        print_json(
            "settings:put",
            client.put(
                "/api/settings",
                json={"llm_model": "gpt-4o", "llm_api_key": "sk-test-12345678"},
            ).json(),
        )
        print_json("settings:get:after", client.get("/api/settings").json())
        print_json("vocab:stats", client.get("/api/vocabulary/stats").json())
        print_json("vocab:heatmap", client.get("/api/vocabulary/heatmap").json())
        print_json("vocab:curve", client.get("/api/vocabulary/learning-curve?days=7").json())
        print_json("vocab:search", client.get("/api/vocabulary/search?q=plau").json())
        review_list = client.get("/api/vocabulary/review?limit=2").json()
        print_json("vocab:review:list", review_list)
        first_id = review_list["data"]["words"][0]["id"]
        print_json(
            "vocab:review:submit",
            client.post(f"/api/vocabulary/{first_id}/review", json={"quality": 3}).json(),
        )

        with client.websocket_connect("/api/speaking/ws") as ws:
            print_json("ws_connected", ws.receive_json())
            ws.send_json({"type": "ping"})
            print_json("ws_ping", ws.receive_json())


if __name__ == "__main__":
    main()
