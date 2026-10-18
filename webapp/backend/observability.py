"""Low-cardinality HTTP metrics; no player IDs, tokens or room codes in labels."""
import os
import time

from fastapi import Response
from prometheus_client import CollectorRegistry, Counter, Histogram, CONTENT_TYPE_LATEST, generate_latest

requests = Counter("teramont_http_requests_total", "Completed HTTP requests", ["method", "route", "status"])
duration = Histogram("teramont_http_duration_seconds", "HTTP response duration", ["method", "route"])


async def measure(request, call_next):
    started = time.perf_counter()
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
        return response
    finally:
        route = getattr(request.scope.get("route"), "path", "unmatched")
        if route != "/metrics":
            requests.labels(request.method, route, str(status)).inc()
            duration.labels(request.method, route).observe(time.perf_counter() - started)


def metrics():
    registry = None
    if os.getenv("PROMETHEUS_MULTIPROC_DIR"):
        from prometheus_client import multiprocess
        registry = CollectorRegistry()
        multiprocess.MultiProcessCollector(registry)
    return Response(generate_latest(registry) if registry else generate_latest(), media_type=CONTENT_TYPE_LATEST)
