# Python SDK

```python
from mails_sdk import MailsClient

client = MailsClient('http://127.0.0.1:8787', api_key='YOUR_API_KEY')
created = client.create_address('demo@m1.example.com', 'demo', ttl_hours=24)
mail = client.wait_for_mail(created['address']['name'], timeout_ms=60000, interval_ms=3000)
print(mail['subject'])
```
