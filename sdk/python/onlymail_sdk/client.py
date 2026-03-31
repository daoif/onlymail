from __future__ import annotations

import time
from typing import Any

import requests

from .exceptions import OnlyMailSdkError, TimeoutError


class OnlyMailClient:
    def __init__(self, base_url: str, api_key: str, timeout: int = 30):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.timeout = timeout

    def _request(self, method: str, path: str, *, json: dict[str, Any] | None = None) -> dict[str, Any]:
        response = requests.request(
            method,
            f"{self.base_url}{path}",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json=json,
            timeout=self.timeout,
        )

        try:
            payload = response.json()
        except ValueError as exc:
            raise OnlyMailSdkError("响应不是合法 JSON", response.status_code) from exc

        if not response.ok:
            error = payload.get("error", {})
            raise OnlyMailSdkError(error.get("message", "请求失败"), response.status_code, error.get("details"))

        return payload

    # ── 邮箱操作 ──────────────────────────────────────────────

    def create_address(self, address: str, project: str, ttl_hours: int | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {"address": address, "project": project}
        if ttl_hours is not None:
            payload["ttl_hours"] = ttl_hours
        return self._request("POST", "/call/address", json=payload)["data"]

    def get_mail_list(self, address: str, page: int = 1, size: int = 20) -> list[dict[str, Any]]:
        payload = self._request("GET", f"/call/mails/{address}?page={page}&size={size}")
        return payload["data"]["items"]

    def get_mail(self, mail_id: int) -> dict[str, Any]:
        return self._request("GET", f"/call/mail/{mail_id}")["data"]

    def wait_for_mail(self, address: str, timeout_ms: int = 60000, interval_ms: int = 3000) -> dict[str, Any]:
        start = time.monotonic()
        known_ids = {item["id"] for item in self.get_mail_list(address, page=1, size=50)}

        while (time.monotonic() - start) * 1000 < timeout_ms:
            items = self.get_mail_list(address, page=1, size=50)
            next_mail = next((item for item in items if item["id"] not in known_ids), None)
            if next_mail is not None:
                return self.get_mail(next_mail["id"])
            time.sleep(interval_ms / 1000)

        raise TimeoutError(f"等待 {address} 的新邮件超时")

    # ── 域名操作 ──────────────────────────────────────────────

    def list_domains(
        self, type: str | None = None, root: str | None = None, limit: int | None = None
    ) -> list[dict[str, Any]]:
        params: list[str] = []
        if type:
            params.append(f"type={type}")
        if root:
            params.append(f"root={root}")
        if limit is not None:
            params.append(f"limit={limit}")
        qs = "&".join(params)
        path = f"/call/domains?{qs}" if qs else "/call/domains"
        return self._request("GET", path)["data"]

    def get_domain(self, name: str) -> dict[str, Any]:
        return self._request("GET", f"/call/domains/{name}")["data"]

    def create_subdomain(self, name: str, root_name: str | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {"name": name}
        if root_name:
            payload["rootName"] = root_name
        return self._request("POST", "/call/domains", json=payload)["data"]
