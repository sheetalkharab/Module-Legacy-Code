from datetime import datetime
from flask.json.provider import DefaultJSONProvider


class CustomJsonProvider(DefaultJSONProvider):
   def __init__(self, *args, **kwargs):
       DefaultJSONProvider.__init__(self, *args, **kwargs)
       original_default = self.default
       self.default = lambda x: (
           x.isoformat() if isinstance(x, datetime) else original_default(x)
       )

