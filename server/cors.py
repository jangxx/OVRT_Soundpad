from typing import Iterable

ALLOWED_HEADERS = [
    "null",
    "http://localhost:",
]

def _add_cors_headers(response, methods: Iterable[str], request_origin) -> None:
    allow_methods = list(set(methods))
    if "OPTIONS" not in allow_methods:
        allow_methods.append("OPTIONS")

    matches = False

    for h in ALLOWED_HEADERS:
        if request_origin.startswith(h):
            matches = True
            break

    if matches:
        headers = {
            "Access-Control-Allow-Methods": ",".join(allow_methods),
            "Access-Control-Allow-Origin": request_origin,
        }
        response.headers.extend(headers)


def add_cors_headers(request, response):
    if request.method != "OPTIONS" and "origin" in request.headers:
        methods = [
            method
            for method in request.route.methods
        ]
        _add_cors_headers(response, methods, request.headers["origin"])