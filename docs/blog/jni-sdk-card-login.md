---
title: JNI 对接 ATQ 云验证：Java Native Interface 完整实战指南
date: 2026-02-20T00:00:00.000Z
author: ATQ Team
tags:
  - JNI
  - Java
  - C++
  - Native开发
  - 安全加密
  - 跨语言调用
  - 性能优化
createTime: 2026/02/20 01:05:26
permalink: /blog/x0kbzq29/
---

# JNI 对接 ATQ 云验证：Java Native Interface 完整实战指南

在移动应用和高性能计算场景中，JNI（Java Native Interface）提供了Java与原生代码之间的桥梁。本文将详细介绍如何通过JNI实现ATQ云验证的高性能对接，充分发挥Java的易用性和C++的执行效率。

## 📋 技术架构概述

### 1.1 JNI架构优势
- **性能提升**：关键算法用C++实现，比纯Java快3-5倍
- **代码复用**：可重用现有的C/C++加密库
- **平台集成**：更好地与系统底层功能集成
- **安全增强**：核心逻辑在Native层，更难被逆向分析

### 1.2 整体架构设计
```
Java层 (ATQJavaClient.java)
    ↓ JNI调用
Native接口层 (ATQNativeInterface.cpp)
    ↓ 调用
C++核心层 (ATQCore.cpp + CryptoUtils.cpp)
    ↓ 网络通信
ATQ云验证服务器
```

## 🔧 开发环境搭建

### 2.1 环境要求
```bash
# Java环境
Java JDK 8+ (推荐 JDK 11+)
Android SDK (移动端开发)

# C++编译环境
GCC/Clang (Linux/macOS)
Visual Studio (Windows)
NDK (Android Native Development Kit)

# 构建工具
CMake 3.15+
Gradle 6.0+ (Android项目)
```

### 2.2 项目结构
```
atq_jni_project/
├── java/
│   └── com/atq/client/
│       ├── ATQJavaClient.java          # Java接口层
│       ├── ATQCallback.java            # 回调接口
│       └── ATQException.java           # 自定义异常
├── native/
│   ├── include/
│   │   ├── atq_jni.h                   # JNI头文件
│   │   ├── atq_core.h                  # 核心功能头文件
│   │   └── crypto_utils.h              # 加密工具头文件
│   ├── src/
│   │   ├── atq_jni.cpp                 # JNI实现
│   │   ├── atq_core.cpp                # 核心业务逻辑
│   │   └── crypto_utils.cpp            # 加密算法实现
│   └── CMakeLists.txt                  # 构建配置
├── android/
│   ├── app/
│   │   ├── src/main/java/              # Android Java代码
│   │   ├── src/main/cpp/               # Android Native代码
│   │   └── CMakeLists.txt              # Android构建配置
│   └── build.gradle                    # Gradle配置
└── build.sh                            # 构建脚本
```

## 🚀 核心实现详解

### 3.1 Java接口层设计

```java
// java/com/atq/client/ATQJavaClient.java
package com.atq.client;

import java.util.concurrent.CompletableFuture;

/**
 * ATQ云验证Java客户端
 * 通过JNI调用Native层实现高性能验证
 */
public class ATQJavaClient {
    
    // 加载Native库
    static {
        try {
            System.loadLibrary("atq_jni");  // 加载libatq_jni.so
            initializeNative();             // 初始化Native层
        } catch (UnsatisfiedLinkError e) {
            throw new RuntimeException("无法加载Native库", e);
        }
    }
    
    // Native方法声明
    private static native void initializeNative();
    private static native String nativeCardLogin(String appId, String secretKey, 
                                               String host, String card, String markcode);
    private static native void nativeCleanup();
    
    private final String appId;
    private final String secretKey;
    private final String host;
    private boolean initialized = false;
    
    public ATQJavaClient(String appId, String secretKey, String host) {
        this.appId = appId;
        this.secretKey = secretKey;
        this.host = host;
        this.initialized = true;
    }
    
    /**
     * 同步卡密登录
     */
    public ATQResult cardLogin(String card, String markcode) throws ATQException {
        validateInitialized();
        
        try {
            String jsonResponse = nativeCardLogin(appId, secretKey, host, card, markcode);
            
            if (jsonResponse == null || jsonResponse.isEmpty()) {
                throw new ATQException("Native调用返回空结果");
            }
            
            return ATQResult.fromJson(jsonResponse);
            
        } catch (Exception e) {
            throw new ATQException("卡密登录失败", e);
        }
    }
    
    /**
     * 异步卡密登录
     */
    public CompletableFuture<ATQResult> cardLoginAsync(String card, String markcode) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return cardLogin(card, markcode);
            } catch (ATQException e) {
                throw new RuntimeException(e);
            }
        });
    }
    
    /**
     * 带回调的卡密登录
     */
    public void cardLoginWithCallback(String card, String markcode, ATQCallback callback) {
        new Thread(() -> {
            try {
                ATQResult result = cardLogin(card, markcode);
                callback.onSuccess(result);
            } catch (ATQException e) {
                callback.onError(e);
            }
        }).start();
    }
    
    /**
     * 清理资源
     */
    public void cleanup() {
        if (initialized) {
            nativeCleanup();
            initialized = false;
        }
    }
    
    private void validateInitialized() throws ATQException {
        if (!initialized) {
            throw new ATQException("客户端未正确初始化");
        }
    }
    
    @Override
    protected void finalize() throws Throwable {
        cleanup();
        super.finalize();
    }
}
```

```java
// java/com/atq/client/ATQResult.java
package com.atq.client;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * ATQ验证结果封装类
 */
public class ATQResult {
    private static final ObjectMapper mapper = new ObjectMapper();
    
    @JsonProperty("card")
    private String card;
    
    @JsonProperty("endTime")
    private String endTime;
    
    @JsonProperty("token")
    private String token;
    
    @JsonProperty("success")
    private boolean success;
    
    @JsonProperty("message")
    private String message;
    
    // 构造函数
    public ATQResult() {}
    
    public ATQResult(boolean success, String message) {
        this.success = success;
        this.message = message;
    }
    
    // 静态工厂方法
    public static ATQResult success(String card, String endTime, String token) {
        ATQResult result = new ATQResult();
        result.success = true;
        result.card = card;
        result.endTime = endTime;
        result.token = token;
        return result;
    }
    
    public static ATQResult failure(String message) {
        return new ATQResult(false, message);
    }
    
    // JSON序列化/反序列化
    public static ATQResult fromJson(String json) throws ATQException {
        try {
            return mapper.readValue(json, ATQResult.class);
        } catch (Exception e) {
            throw new ATQException("JSON解析失败: " + json, e);
        }
    }
    
    public String toJson() throws ATQException {
        try {
            return mapper.writeValueAsString(this);
        } catch (Exception e) {
            throw new ATQException("JSON序列化失败", e);
        }
    }
    
    // Getter/Setter方法
    public String getCard() { return card; }
    public void setCard(String card) { this.card = card; }
    
    public String getEndTime() { return endTime; }
    public void setEndTime(String endTime) { this.endTime = endTime; }
    
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
```

```java
// java/com/atq/client/ATQCallback.java
package com.atq.client;

/**
 * ATQ异步回调接口
 */
public interface ATQCallback {
    void onSuccess(ATQResult result);
    void onError(ATQException exception);
}
```

```java
// java/com/atq/client/ATQException.java
package com.atq.client;

/**
 * ATQ自定义异常类
 */
public class ATQException extends Exception {
    public ATQException(String message) {
        super(message);
    }
    
    public ATQException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

### 3.2 JNI接口层实现

```cpp
// native/src/atq_jni.cpp
#include <jni.h>
#include <string>
#include <android/log.h>
#include "../include/atq_jni.h"
#include "../include/atq_core.h"

#define TAG "ATQ_JNI"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

// 全局ATQ核心实例
static std::unique_ptr<atq::ATQCore> g_atq_core;

extern "C" {

/**
 * JNI_OnLoad - 库加载时调用
 */
JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void* reserved) {
    LOGI("ATQ JNI库加载中...");
    return JNI_VERSION_1_6;
}

/**
 * JNI_OnUnload - 库卸载时调用
 */
JNIEXPORT void JNICALL JNI_OnUnload(JavaVM* vm, void* reserved) {
    LOGI("ATQ JNI库卸载中...");
    g_atq_core.reset();
}

/**
 * 初始化Native层
 */
JNIEXPORT void JNICALL
Java_com_atq_client_ATQJavaClient_initializeNative(JNIEnv* env, jclass clazz) {
    try {
        LOGI("初始化ATQ Native核心...");
        g_atq_core = std::make_unique<atq::ATQCore>();
        LOGI("ATQ Native核心初始化成功");
    } catch (const std::exception& e) {
        LOGE("初始化失败: %s", e.what());
        jclass exception_class = env->FindClass("com/atq/client/ATQException");
        env->ThrowNew(exception_class, e.what());
    }
}

/**
 * 卡密登录Native实现
 */
JNIEXPORT jstring JNICALL
Java_com_atq_client_ATQJavaClient_nativeCardLogin(JNIEnv* env, jclass clazz,
                                                  jstring j_app_id,
                                                  jstring j_secret_key,
                                                  jstring j_host,
                                                  jstring j_card,
                                                  jstring j_markcode) {
    try {
        // 转换Java字符串为C++字符串
        const char* app_id = env->GetStringUTFChars(j_app_id, nullptr);
        const char* secret_key = env->GetStringUTFChars(j_secret_key, nullptr);
        const char* host = env->GetStringUTFChars(j_host, nullptr);
        const char* card = env->GetStringUTFChars(j_card, nullptr);
        const char* markcode = env->GetStringUTFChars(j_markcode, nullptr);
        
        // 创建字符串副本
        std::string cpp_app_id(app_id);
        std::string cpp_secret_key(secret_key);
        std::string cpp_host(host);
        std::string cpp_card(card);
        std::string cpp_markcode(markcode);
        
        // 释放JNI字符串引用
        env->ReleaseStringUTFChars(j_app_id, app_id);
        env->ReleaseStringUTFChars(j_secret_key, secret_key);
        env->ReleaseStringUTFChars(j_host, host);
        env->ReleaseStringUTFChars(j_card, card);
        env->ReleaseStringUTFChars(j_markcode, markcode);
        
        // 调用核心业务逻辑
        if (!g_atq_core) {
            throw std::runtime_error("ATQ核心未初始化");
        }
        
        LOGI("开始卡密登录 - 卡密: %s, 设备码: %s", 
             cpp_card.c_str(), cpp_markcode.c_str());
        
        nlohmann::json result = g_atq_core->cardLogin(
            cpp_app_id, cpp_secret_key, cpp_host, cpp_card, cpp_markcode);
        
        // 转换结果为JSON字符串
        std::string result_json = result.dump();
        LOGI("登录完成，结果: %s", result_json.c_str());
        
        // 返回Java字符串
        return env->NewStringUTF(result_json.c_str());
        
    } catch (const std::exception& e) {
        LOGE("卡密登录异常: %s", e.what());
        jclass exception_class = env->FindClass("com/atq/client/ATQException");
        env->ThrowNew(exception_class, e.what());
        return nullptr;
    }
}

/**
 * 清理Native资源
 */
JNIEXPORT void JNICALL
Java_com_atq_client_ATQJavaClient_nativeCleanup(JNIEnv* env, jclass clazz) {
    try {
        LOGI("清理ATQ Native资源...");
        g_atq_core.reset();
        LOGI("ATQ Native资源清理完成");
    } catch (const std::exception& e) {
        LOGE("清理资源异常: %s", e.what());
    }
}

} // extern "C"
```

### 3.3 C++核心业务逻辑

```cpp
// native/include/atq_core.h
#pragma once
#include <string>
#include <memory>
#include <nlohmann/json.hpp>
#include "crypto_utils.h"
#include "http_client.h"

namespace atq {

class ATQCore {
public:
    ATQCore();
    ~ATQCore();
    
    /**
     * 卡密登录核心方法
     */
    nlohmann::json cardLogin(const std::string& app_id,
                           const std::string& secret_key,
                           const std::string& host,
                           const std::string& card,
                           const std::string& markcode);
    
private:
    std::unique_ptr<HttpClient> http_client_;
    std::unique_ptr<CryptoUtils> crypto_utils_;
    
    /**
     * 准备请求载荷
     */
    nlohmann::json prepareRequest(const std::string& app_id,
                                const std::string& secret_key,
                                const nlohmann::json& biz_data);
    
    /**
     * 解密响应数据
     */
    nlohmann::json decryptResponseData(const std::string& encrypted_data,
                                     const std::string& secret_key);
    
    /**
     * 获取时间戳
     */
    std::string getTimestamp() const;
};

} // namespace atq
```

```cpp
// native/src/atq_core.cpp
#include "../include/atq_core.h"
#include <chrono>
#include <iostream>

namespace atq {

ATQCore::ATQCore() 
    : http_client_(std::make_unique<HttpClient>())
    , crypto_utils_(std::make_unique<CryptoUtils>()) {
    // 初始化完成
}

ATQCore::~ATQCore() {
    // 自动清理资源
}

nlohmann::json ATQCore::cardLogin(const std::string& app_id,
                                 const std::string& secret_key,
                                 const std::string& host,
                                 const std::string& card,
                                 const std::string& markcode) {
    try {
        // 1. 准备业务数据
        nlohmann::json biz_data = {
            {"card", card},
            {"markcode", markcode}
        };
        
        // 2. 构造完整请求
        nlohmann::json payload = prepareRequest(app_id, secret_key, biz_data);
        
        // 3. 发送HTTP请求
        std::string url = host + "/api/cardLogin";
        std::string json_payload = payload.dump();
        
        auto response = http_client_->post(url, json_payload);
        
        if (!response.success) {
            return {
                {"success", false},
                {"message", "HTTP请求失败: " + response.error_message}
            };
        }
        
        // 4. 解析响应
        nlohmann::json response_json;
        try {
            response_json = nlohmann::json::parse(response.body);
        } catch (const nlohmann::json::exception& e) {
            return {
                {"success", false},
                {"message", "响应JSON解析失败"}
            };
        }
        
        std::string code = response_json.value("code", "");
        
        if (code == "200") {
            // 成功：解密响应数据
            std::string encrypted_data = response_json.value("data", "");
            if (encrypted_data.empty()) {
                return {
                    {"success", false},
                    {"message", "响应数据为空"}
                };
            }
            
            try {
                nlohmann::json decrypted_data = decryptResponseData(encrypted_data, secret_key);
                
                return {
                    {"success", true},
                    {"card", decrypted_data.value("card", "")},
                    {"endTime", decrypted_data.value("endTime", "")},
                    {"token", decrypted_data.value("token", "")}
                };
                
            } catch (const std::exception& e) {
                return {
                    {"success", false},
                    {"message", "解密响应数据失败: " + std::string(e.what())}
                };
            }
        } else {
            // 失败
            std::string message = response_json.value("message", "未知错误");
            return {
                {"success", false},
                {"message", message}
            };
        }
        
    } catch (const std::exception& e) {
        return {
            {"success", false},
            {"message", "请求异常: " + std::string(e.what())}
        };
    }
}

nlohmann::json ATQCore::prepareRequest(const std::string& app_id,
                                      const std::string& secret_key,
                                      const nlohmann::json& biz_data) {
    // 1. 序列化业务数据
    std::string biz_json = biz_data.dump();
    
    // 2. RC4加密
    std::vector<uint8_t> encrypted_bytes = crypto_utils_->rc4Encrypt(biz_json, secret_key);
    std::string encrypted_data = crypto_utils_->bytesToHex(encrypted_bytes);
    
    // 3. 生成时间戳
    std::string timestamp = getTimestamp();
    
    // 4. 构造签名字符串
    std::string sign_str = app_id + timestamp + encrypted_data;
    
    // 5. 计算HMAC-SHA256签名
    std::string signature = crypto_utils_->hmacSha256(sign_str, secret_key);
    
    // 6. 构造完整请求载荷
    return {
        {"app_id", app_id},
        {"time", timestamp},
        {"data", encrypted_data},
        {"sign", signature}
    };
}

nlohmann::json ATQCore::decryptResponseData(const std::string& encrypted_data,
                                          const std::string& secret_key) {
    // 1. 十六进制转字节数组
    std::vector<uint8_t> encrypted_bytes = crypto_utils_->hexToBytes(encrypted_data);
    
    // 2. RC4解密
    std::vector<uint8_t> decrypted_bytes = crypto_utils_->rc4Decrypt(encrypted_bytes, secret_key);
    
    // 3. 转换为字符串并解析JSON
    std::string decrypted_string(decrypted_bytes.begin(), decrypted_bytes.end());
    return nlohmann::json::parse(decrypted_string);
}

std::string ATQCore::getTimestamp() const {
    auto now = std::chrono::duration_cast<std::chrono::seconds>(
        std::chrono::system_clock::now().time_since_epoch()
    );
    return std::to_string(now.count());
}

} // namespace atq
```

### 3.4 加密工具类实现

```cpp
// native/include/crypto_utils.h
#pragma once
#include <vector>
#include <string>
#include <openssl/hmac.h>
#include <openssl/sha.h>

namespace atq {

class CryptoUtils {
public:
    /**
     * RC4加密
     */
    std::vector<uint8_t> rc4Encrypt(const std::string& data, const std::string& key);
    
    /**
     * RC4解密
     */
    std::vector<uint8_t> rc4Decrypt(const std::vector<uint8_t>& data, const std::string& key);
    
    /**
     * HMAC-SHA256签名
     */
    std::string hmacSha256(const std::string& data, const std::string& key);
    
    /**
     * 字节数组转十六进制字符串
     */
    std::string bytesToHex(const std::vector<uint8_t>& bytes);
    
    /**
     * 十六进制字符串转字节数组
     */
    std::vector<uint8_t> hexToBytes(const std::string& hex);
    
private:
    class RC4Engine {
    public:
        explicit RC4Engine(const std::string& key);
        std::vector<uint8_t> process(const std::vector<uint8_t>& data);
        
    private:
        std::vector<uint8_t> s_box_;
        void initializeSBox(const std::string& key);
    };
};

} // namespace atq
```

```cpp
// native/src/crypto_utils.cpp
#include "../include/crypto_utils.h"
#include <stdexcept>
#include <iomanip>
#include <sstream>

namespace atq {

std::vector<uint8_t> CryptoUtils::rc4Encrypt(const std::string& data, const std::string& key) {
    RC4Engine engine(key);
    std::vector<uint8_t> byte_data(data.begin(), data.end());
    return engine.process(byte_data);
}

std::vector<uint8_t> CryptoUtils::rc4Decrypt(const std::vector<uint8_t>& data, const std::string& key) {
    // RC4是对称加密，加密和解密使用相同算法
    RC4Engine engine(key);
    return engine.process(data);
}

std::string CryptoUtils::hmacSha256(const std::string& data, const std::string& key) {
    unsigned char* digest;
    unsigned int digest_len = SHA256_DIGEST_LENGTH;
    
    digest = HMAC(EVP_sha256(),
                  key.c_str(), key.length(),
                  reinterpret_cast<const unsigned char*>(data.c_str()), data.length(),
                  nullptr, &digest_len);
    
    if (!digest) {
        throw std::runtime_error("HMAC calculation failed");
    }
    
    std::stringstream ss;
    ss << std::hex << std::setfill('0');
    
    for (unsigned int i = 0; i < digest_len; ++i) {
        ss << std::setw(2) << static_cast<unsigned int>(digest[i]);
    }
    
    return ss.str();
}

std::string CryptoUtils::bytesToHex(const std::vector<uint8_t>& bytes) {
    std::stringstream ss;
    ss << std::hex << std::setfill('0');
    
    for (const auto& byte : bytes) {
        ss << std::setw(2) << static_cast<int>(byte);
    }
    
    return ss.str();
}

std::vector<uint8_t> CryptoUtils::hexToBytes(const std::string& hex) {
    std::vector<uint8_t> bytes;
    
    if (hex.length() % 2 != 0) {
        throw std::invalid_argument("Hex string must have even length");
    }
    
    for (size_t i = 0; i < hex.length(); i += 2) {
        std::string byte_string = hex.substr(i, 2);
        uint8_t byte = static_cast<uint8_t>(std::stoi(byte_string, nullptr, 16));
        bytes.push_back(byte);
    }
    
    return bytes;
}

// RC4Engine实现
CryptoUtils::RC4Engine::RC4Engine(const std::string& key) {
    if (key.empty()) {
        throw std::invalid_argument("Key cannot be empty");
    }
    initializeSBox(key);
}

void CryptoUtils::RC4Engine::initializeSBox(const std::string& key) {
    s_box_.resize(256);
    
    for (int i = 0; i < 256; ++i) {
        s_box_[i] = static_cast<uint8_t>(i);
    }
    
    uint8_t j = 0;
    for (int i = 0; i < 256; ++i) {
        j = (j + s_box_[i] + static_cast<uint8_t>(key[i % key.length()])) % 256;
        std::swap(s_box_[i], s_box_[j]);
    }
}

std::vector<uint8_t> CryptoUtils::RC4Engine::process(const std::vector<uint8_t>& data) {
    std::vector<uint8_t> result;
    result.reserve(data.size());
    
    uint8_t i = 0, j = 0;
    
    for (size_t index = 0; index < data.size(); ++index) {
        i = (i + 1) % 256;
        j = (j + s_box_[i]) % 256;
        
        std::swap(s_box_[i], s_box_[j]);
        
        uint8_t keystream_byte = s_box_[(s_box_[i] + s_box_[j]) % 256];
        result.push_back(data[index] ^ keystream_byte);
    }
    
    return result;
}

} // namespace atq
```

### 3.5 HTTP客户端实现

```cpp
// native/include/http_client.h
#pragma once
#include <string>
#include <map>
#include <curl/curl.h>

namespace atq {

struct HttpResponse {
    int status_code;
    std::string body;
    std::map<std::string, std::string> headers;
    bool success;
    std::string error_message;
};

class HttpClient {
public:
    explicit HttpClient(long timeout_seconds = 10);
    ~HttpClient();
    
    HttpResponse post(const std::string& url,
                     const std::string& json_data,
                     const std::map<std::string, std::string>& headers = {});
    
private:
    long timeout_seconds_;
    static size_t WriteCallback(void* contents, size_t size, size_t nmemb, std::string* userp);
};

} // namespace atq
```

```cpp
// native/src/http_client.cpp
#include "../include/http_client.h"
#include <iostream>

namespace atq {

namespace {
    size_t WriteCallback(void* contents, size_t size, size_t nmemb, std::string* userp) {
        size_t total_size = size * nmemb;
        userp->append(static_cast<char*>(contents), total_size);
        return total_size;
    }
}

HttpClient::HttpClient(long timeout_seconds) : timeout_seconds_(timeout_seconds) {
    curl_global_init(CURL_GLOBAL_DEFAULT);
}

HttpClient::~HttpClient() {
    curl_global_cleanup();
}

HttpResponse HttpClient::post(const std::string& url,
                             const std::string& json_data,
                             const std::map<std::string, std::string>& headers) {
    CURL* curl = curl_easy_init();
    HttpResponse response;
    
    if (!curl) {
        response.success = false;
        response.error_message = "Failed to initialize CURL";
        return response;
    }
    
    std::string response_body;
    
    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_data.c_str());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response_body);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, timeout_seconds_);
    curl_easy_setopt(curl, CURLOPT_USERAGENT, "ATQ-JNI-Client/1.0");
    
    struct curl_slist* header_list = nullptr;
    header_list = curl_slist_append(header_list, "Content-Type: application/json");
    
    for (const auto& [key, value] : headers) {
        std::string header = key + ": " + value;
        header_list = curl_slist_append(header_list, header.c_str());
    }
    
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, header_list);
    
    CURLcode res = curl_easy_perform(curl);
    
    if (res != CURLE_OK) {
        response.success = false;
        response.error_message = std::string("CURL error: ") + curl_easy_strerror(res);
    } else {
        long response_code;
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &response_code);
        
        response.success = (response_code == 200);
        response.status_code = static_cast<int>(response_code);
        response.body = response_body;
    }
    
    curl_slist_free_all(header_list);
    curl_easy_cleanup(curl);
    
    return response;
}

} // namespace atq
```

## 🛠️ 构建配置

### 4.1 CMakeLists.txt配置

```cmake
# native/CMakeLists.txt
cmake_minimum_required(VERSION 3.15)
project(atq_jni VERSION 1.0.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 查找依赖
find_package(PkgConfig REQUIRED)
find_package(OpenSSL REQUIRED)
find_package(JNI REQUIRED)

pkg_check_modules(JSON REQUIRED nlohmann_json)

# 包含目录
include_directories(include)
include_directories(${OPENSSL_INCLUDE_DIR})
include_directories(${JNI_INCLUDE_DIRS})
include_directories(${JSON_INCLUDE_DIRS})

# 编译选项
if(MSVC)
    add_compile_options(/W4)
else()
    add_compile_options(-Wall -Wextra -pedantic)
endif()

# 源文件
set(SOURCES
    src/atq_jni.cpp
    src/atq_core.cpp
    src/crypto_utils.cpp
    src/http_client.cpp
)

# 创建共享库
add_library(atq_jni SHARED ${SOURCES})

# 链接库
target_link_libraries(atq_jni
    ${OPENSSL_LIBRARIES}
    ${JNI_LIBRARIES}
    CURL
    ${JSON_LIBRARIES}
)

# 设置输出名称
set_target_properties(atq_jni PROPERTIES
    OUTPUT_NAME "atq_jni"
    LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/libs"
)
```

### 4.2 Android构建配置

```gradle
// android/app/build.gradle
android {
    compileSdkVersion 33
    
    defaultConfig {
        applicationId "com.atq.jni.demo"
        minSdkVersion 21
        targetSdkVersion 33
        versionCode 1
        versionName "1.0"
        
        // 启用C++支持
        externalNativeBuild {
            cmake {
                cppFlags "-std=c++17"
                abiFilters 'armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'
            }
        }
        
        // Java 8支持
        compileOptions {
            sourceCompatibility JavaVersion.VERSION_1_8
            targetCompatibility JavaVersion.VERSION_1_8
        }
    }
    
    externalNativeBuild {
        cmake {
            path "src/main/cpp/CMakeLists.txt"
            version "3.18.1"
        }
    }
}

dependencies {
    implementation 'com.fasterxml.jackson.core:jackson-databind:2.15.2'
    // 其他依赖...
}
```

```cmake
# android/app/src/main/cpp/CMakeLists.txt
cmake_minimum_required(VERSION 3.18.1)
project("atq_jni_android")

# 设置C++标准
set(CMAKE_CXX_STANDARD 17)

# 添加Native源文件
add_library(
    atq_jni_android
    SHARED
    atq_jni.cpp
    atq_core.cpp
    crypto_utils.cpp
    http_client.cpp
)

# 查找系统库
find_library(log-lib log)
find_library(android-lib android)

# 链接库
target_link_libraries(
    atq_jni_android
    ${log-lib}
    ${android-lib}
    ssl
    crypto
)
```

## 📱 使用示例

### 5.1 Android应用示例

```java
// MainActivity.java
public class MainActivity extends AppCompatActivity {
    private ATQJavaClient atqClient;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        
        // 初始化ATQ客户端
        atqClient = new ATQJavaClient("1", "123456", "https://apiy.me");
        
        // 绑定按钮事件
        Button loginButton = findViewById(R.id.btn_login);
        EditText cardInput = findViewById(R.id.et_card);
        
        loginButton.setOnClickListener(v -> {
            String card = cardInput.getText().toString().trim();
            if (!card.isEmpty()) {
                performLogin(card);
            }
        });
    }
    
    private void performLogin(String card) {
        ProgressDialog dialog = new ProgressDialog(this);
        dialog.setMessage("正在验证卡密...");
        dialog.show();
        
        // 异步登录
        atqClient.cardLoginAsync(card, "ANDROID_DEVICE")
            .thenAccept(result -> {
                runOnUiThread(() -> {
                    dialog.dismiss();
                    if (result.isSuccess()) {
                        showSuccessDialog(result);
                    } else {
                        showErrorDialog(result.getMessage());
                    }
                });
            })
            .exceptionally(throwable -> {
                runOnUiThread(() -> {
                    dialog.dismiss();
                    showErrorDialog("登录异常: " + throwable.getMessage());
                });
                return null;
            });
    }
    
    private void showSuccessDialog(ATQResult result) {
        new AlertDialog.Builder(this)
            .setTitle("登录成功")
            .setMessage(String.format(
                "卡号: %s\n到期时间: %s\nToken: %s",
                result.getCard(),
                result.getEndTime(),
                result.getToken()
            ))
            .setPositiveButton("确定", null)
            .show();
    }
    
    private void showErrorDialog(String message) {
        new AlertDialog.Builder(this)
            .setTitle("登录失败")
            .setMessage(message)
            .setPositiveButton("重试", (dialog, which) -> {
                // 重新尝试登录逻辑
            })
            .setNegativeButton("取消", null)
            .show();
    }
    
    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (atqClient != null) {
            atqClient.cleanup();
        }
    }
}
```

### 5.2 桌面Java应用示例

```java
// DesktopDemo.java
public class DesktopDemo {
    public static void main(String[] args) {
        try {
            // 创建ATQ客户端
            ATQJavaClient client = new ATQJavaClient("1", "123456", "https://apiy.me");
            
            // 同步登录
            System.out.println("开始卡密登录...");
            ATQResult result = client.cardLogin("CARDJUCMS6KWB5IJ", "DESKTOP_CLIENT");
            
            if (result.isSuccess()) {
                System.out.println("✓ 登录成功！");
                System.out.println("卡号: " + result.getCard());
                System.out.println("到期时间: " + result.getEndTime());
                System.out.println("Token: " + result.getToken());
            } else {
                System.out.println("✗ 登录失败: " + result.getMessage());
            }
            
            // 异步登录示例
            System.out.println("\n开始异步登录...");
            client.cardLoginAsync("CARDJUCMS6KWB5IJ", "ASYNC_CLIENT")
                .thenAccept(asyncResult -> {
                    if (asyncResult.isSuccess()) {
                        System.out.println("✓ 异步登录成功！");
                    } else {
                        System.out.println("✗ 异步登录失败: " + asyncResult.getMessage());
                    }
                })
                .join(); // 等待异步操作完成
                
        } catch (ATQException e) {
            System.err.println("ATQ异常: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
```

## 🔧 开发调试技巧

### 6.1 日志调试

```cpp
// 在关键位置添加详细日志
#ifdef DEBUG
    #define JNI_LOG(level, fmt, ...) \
        __android_log_print(level, "ATQ_JNI", "%s:%d " fmt, __FILE__, __LINE__, ##__VA_ARGS__)
#else
    #define JNI_LOG(level, fmt, ...) ((void)0)
#endif

// 使用示例
JNI_LOG(ANDROID_LOG_DEBUG, "加密前数据: %s", biz_json.c_str());
JNI_LOG(ANDROID_LOG_DEBUG, "加密后数据: %s", encrypted_data.c_str());
```

### 6.2 内存泄漏检测

```cpp
// 使用Valgrind检测内存泄漏（Linux）
// valgrind --leak-check=full --show-leak-kinds=all ./your_program

// Android Studio Memory Profiler
// 在Android Studio中使用Memory Profiler监控Native内存使用
```

### 6.3 性能分析

```cpp
// 性能计时器
class PerformanceTimer {
public:
    PerformanceTimer(const std::string& name) 
        : name_(name), start_(std::chrono::high_resolution_clock::now()) {}
    
    ~PerformanceTimer() {
        auto end = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::microseconds>(end - start_);
        LOGI("%s 执行时间: %ld 微秒", name_.c_str(), duration.count());
    }
    
private:
    std::string name_;
    std::chrono::high_resolution_clock::time_point start_;
};

// 使用示例
void someFunction() {
    PerformanceTimer timer("加密操作");
    // 执行耗时操作
}
```

## 🎯 最佳实践总结

### 7.1 安全性考虑
1. **密钥保护**：避免在代码中硬编码密钥
2. **混淆处理**：对Native库进行代码混淆
3. **完整性校验**：验证Native库的完整性
4. **运行时保护**：检测调试器和root状态

### 7.2 性能优化
1. **对象复用**：复用HttpClient和CryptoUtils实例
2. **连接池**：实现HTTP连接池减少连接开销
3. **异步处理**：网络请求使用异步避免阻塞UI线程
4. **缓存机制**：适当缓存验证结果

### 7.3 兼容性处理
1. **ABI支持**：编译多种CPU架构的so文件
2. **版本适配**：处理不同Android版本的API差异
3. **异常处理**：完善的异常捕获和错误恢复机制

这套JNI实现方案充分发挥了Java的跨平台优势和C++的性能优势，为ATQ云验证提供了高效、安全的解决方案。通过合理的架构设计和严格的测试，可以在各种应用场景中稳定运行。

---
*作者：ATQ Team*  
*最后更新：2026-02-20*