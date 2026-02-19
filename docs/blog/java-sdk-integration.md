---
title: Java 对接 ATQ 云验证：从零实现安全加固的卡密登录
date: 2026-02-20
author: ATQ Team
tags:
  - Java
  - SDK
  - 安全加密
  - 接口对接
---

# Java 对接 ATQ 云验证：从零实现安全加固的卡密登录

为了保障软件授权的安全性，ATQ 云验证采用了 **HMAC-SHA256 签名** 和 **AES-256 加密** 机制。本文将带你一步步使用 Java 语言实现标准对接流程。

## 准备工作

在开始编码前，请确保你已拥有：

1. **App ID**: 应用唯一标识。
2. **App Secret**: 用于签名的密钥（切勿泄露）。
3. **API 地址**: 本文档示例使用标准接口路径。

---

## 第一步：核心加密工具类实现

首先，我们需要准备好基础的加密算法。我们将创建一个 `SecurityUtils` 工具类。

### 1.1 HMAC-SHA256 签名算法

签名是为了防止请求参数在传输过程中被篡改。

```java
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

public class SecurityUtils {
    public static String calculateHMAC(String data, String key) throws Exception {
        SecretKeySpec secretKeySpec = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(secretKeySpec);
        byte[] bytes = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        return bytesToHex(bytes);
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
```

### 1.2 AES-256-ECB 加密算法

用于敏感业务数据（如卡密、用户信息）的加密传输。

```java
import javax.crypto.Cipher;
import java.util.Base64;

// 在 SecurityUtils 类中继续添加
public static String encryptAES(String content, String key) throws Exception {
    SecretKeySpec secretKey = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "AES");
    Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
    cipher.init(Cipher.ENCRYPT_MODE, secretKey);
    byte[] encrypted = cipher.doFinal(content.getBytes(StandardCharsets.UTF_8));
    return Base64.getEncoder().encodeToString(encrypted);
}
```

---

## 第二步：构造业务请求对象

ATQ 协议要求业务数据放在 `data` 字段中。如果是加密模式，`data` 应该是加密后的 Base64 字符串。

```java
// 假设我们要对一个简单的 Map 进行登录
Map<String, Object> bizData = new HashMap<>();
bizData.put("card", "ABCD-1234-EFGH");

// 转换成紧凑型 JSON 字符串 (如使用 FastJSON 或 Jackson)
String dataStr = JSON.toJSONString(bizData);

// 执行加密 (假设使用 AES 模式)
String encryptedData = SecurityUtils.encryptAES(dataStr, APP_SECRET);
```

---

## 第三步：生成签名

根据协议，待签名字符串由 `app_id` + `time` + `data` 拼接而成。

```java
long timestamp = System.currentTimeMillis() / 1000;
String appId = "1001";

// 拼接待签名字符串
String signData = appId + timestamp + encryptedData;

// 计算签名
String sign = SecurityUtils.calculateHMAC(signData, APP_SECRET);
```

---

## 第四步：发送网络请求

使用你喜欢的 HTTP 客户端（如 OkHttp, RestTemplate 或 HttpClient）发送 POST 请求。

```json
{
  "app_id": "1001",
  "time": "1708420000",
  "data": "vBt5X...加密内容...",
  "sign": "3a2b3c4d...签名内容..."
}
```

---

## 第五步：处理响应

服务器返回的 JSON 同样包含 `code`, `msg`, `data`, `sign`。

1. **校验 code**: 200 为成功。
2. **校验签名 (可选但推荐)**: 确保响应确实来自 ATQ 服务器。
3. **解密 data**: 如果返回的 data 是加密的，使用 `APP_SECRET` 进行解密。

```java
// 伪代码：解密服务端返回的数据
String responseData = result.get("data");
String decryptedJson = SecurityUtils.decryptAES(responseData, APP_SECRET);
```

---

## 注意事项 (必读)

> [!IMPORTANT]
> **密钥安全**：绝对不要将 `App Secret` 硬编码在容易被反编译的客户端混淆代码中。建议在生产环境中使用混淆器（如 ProGuard）或保护密钥。
>
> **时钟同步**：服务器会检查 `time` 字段，如果客户端系统时间偏移超过 300 秒，请求将被拦截。

---

## 总结

通过以上五个步骤，我们就完成了一个高安全的 Java 接口对接。这种“加密+签名”的双重机制可以有效防止中间人攻击和数据重放。

希望这篇教程能帮助你快速集成 ATQ 云验证！
