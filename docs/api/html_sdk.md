---
title: HTML SDK 接入
icon: material-symbols:html
createTime: 2026/02/19 23:10:27
permalink: /api/6zp4ytyk/
---

# ATQ SDK HTML-Native 接入协议手册 (v1.0)

本手册旨在规范 HTML 验证界面的开发，确保前端样式能够与 Android 原生 SDK 完美兼容。

## 1. 接入方式

前端团队应在 HTML 文件中引入配套的 `atq_sdk.js`：

```html
<script src="atq_sdk.js"></script>
```

## 2. API 规范 (ATQ 对象)

### 2.1 卡密登录 `ATQ.login(card, callback)`

- **card**: `String` 类型的卡密字符串。
- **callback**: 异步回调。
  - **success**: `Boolean` 验证是否通过。
  - **message**: `String` 服务器返回的消息（如“登录成功”或具体错误原因）。
  - **data**: `Object` 验证成功后的透传数据（如 token 等）。

### 2.2 在线解绑 `ATQ.unbind(card, callback)`

- 参数同上。成功时会对卡密进行机器解绑操作。

### 2.3 数据持久化 `ATQ.save(key, value)` / `ATQ.get(key)`

- 用于在本地保存卡密等信息，即使 App 重启数据也不会丢失。

### 2.4 原生交互

- `ATQ.toast(msg)`: 显示 Android 原生 Toast 提示。
- `ATQ.close()`: 验证通过后，调用此方法关闭弹窗并进入主程序。
- `ATQ.open(url)`: 呼起手机默认浏览器打开链接（购卡、频道等）。

---

## 3. 错误处理原则

1. **网络超时**: 原生层已处理超时逻辑，前端只需通过 `callback` 的 `success` 标志位进行 UI 展示。
2. **非法输入**: 建议前端在调用 API 前进行基础的非空检查。

## 4. 示例代码

```javascript
// 简单验证逻辑示例
function onVerifyClick() {
  const card = document.getElementById("input_card").value;
  ATQ.login(card, (success, msg, data) => {
    if (success) {
      ATQ.save("kami", card);
      ATQ.toast("验证通过！");
      ATQ.close();
    } else {
      alert("失败：" + msg);
    }
  });
}
```
