"""Keep already compressed static files as fixed-length responses."""

from starlette.middleware.gzip import GZipMiddleware


class StaticAwareGZipMiddleware:
    def __init__(self, app, minimum_size=1000, compresslevel=6):
        self.app = app
        self.gzip = GZipMiddleware(app, minimum_size=minimum_size, compresslevel=compresslevel)

    async def __call__(self, scope, receive, send):
        path = scope.get('path', '')
        if scope['type'] == 'http' and path.startswith('/static/') and path.lower().endswith(
            ('.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.pack', '.woff', '.woff2', '.ttf', '.otf')
        ):
            await self.app(scope, receive, send)
            return
        await self.gzip(scope, receive, send)
