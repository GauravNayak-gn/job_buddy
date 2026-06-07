from rest_framework.throttling import SimpleRateThrottle

class RoleBasedUserRateThrottle(SimpleRateThrottle):
    scope = 'user'

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = getattr(request.user, 'id', None) or getattr(request.user, 'pk', None)
        else:
            ident = self.get_ident(request)

        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }

    def get_rate(self):
        if not self.scope:
            return None
        # Fallback order: custom role scope -> default 'user' scope -> default '1000/day'
        return self.THROTTLE_RATES.get(self.scope, self.THROTTLE_RATES.get('user', '1000/day'))

    def allow_request(self, request, view):
        if request.user and request.user.is_authenticated:
            role = getattr(request.user, 'role', 'authenticated')
            self.scope = f"role_{role}"
        else:
            self.scope = 'anon'

        self.rate = self.get_rate()
        self.num_requests, self.duration = self.parse_rate(self.rate)

        return super().allow_request(request, view)
