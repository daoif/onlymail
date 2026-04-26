# Python SDK

## 安装

推荐直接装 GitHub Release 附件里的 wheel：

```bash
python -m pip install "https://github.com/<owner>/<repo>/releases/download/v<version>/onlymail_sdk-<version>-py3-none-any.whl"
```

要跟未发版代码，可以从仓库子目录装：

```bash
python -m pip install "git+https://github.com/<owner>/<repo>.git@<ref>#subdirectory=sdk/python"
```

写进 `requirements.txt`：

```txt
https://github.com/<owner>/<repo>/releases/download/v<version>/onlymail_sdk-<version>-py3-none-any.whl
```

如果你更想保留源码包，也可以直接装同一条 Release 里的 `.tar.gz`。

## 用法

```python
from onlymail_sdk import OnlyMailClient

client = OnlyMailClient('https://your-worker.your-account.workers.dev', api_key='YOUR_API_KEY')
created = client.create_address('demo@m1.example.com', 'demo', ttl_hours=24)
mail = client.wait_for_mail(created['address']['name'], timeout_ms=60000, interval_ms=3000)
print(mail['subject'])
```

创建子域名时，SDK 默认创建参与轮换的临时子域名；如果要长期保留，传 `subdomain_type`：

```python
client.create_subdomain('m1.example.com', subdomain_type='permanent')
```

这个 SDK 只面向你自己部署的实例：
- 第一个参数是你自己的后端地址
- `api_key` 是你在后台设置页生成的 API Key

后端地址的选择顺序：
- 正式环境优先用你自己绑定的 Worker API 自定义域名
- 没绑自定义域名时，用默认 `workers.dev` 地址
