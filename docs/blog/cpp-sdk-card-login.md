---
title: C++ 对接 ATQ 云验证：高性能卡密登录实现指南
date: 2026-02-20T00:00:00.000Z
author: ATQ Team
tags:
  - C++
  - SDK
  - 安全加密
  - RC4加密
  - HMAC-SHA256
  - 接口对接
  - 跨平台
createTime: 2026/02/20 01:02:23
permalink: /blog/2fm9k228/
---

# C++ 对接 ATQ 云验证：高性能卡密登录实现指南

在系统级编程和高性能应用场景中，C++以其卓越的性能表现成为首选语言。本文将详细介绍如何使用现代C++（C++17及以上）实现ATQ云验证的完整对接流程，涵盖RC4加密、HMAC-SHA256签名等核心技术。

## 📋 开发环境准备

### 1.1 编译器要求
- **GCC**: 7.0+ (推荐 GCC 11+)
- **Clang**: 6.0+ (推荐 Clang 14+)
- **MSVC**: Visual Studio 2019+ (推荐 VS 2022)

### 1.2 依赖库安装

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install libcurl4-openssl-dev libssl-dev nlohmann-json3-dev

# CentOS/RHEL
sudo yum install libcurl-devel openssl-devel json-devel

# macOS (使用 Homebrew)
brew install curl openssl nlohmann-json

# Windows (使用 vcpkg)
vcpkg install curl openssl nlohmann-json
```

### 1.3 项目结构
```
atq_cpp_client/
├── include/
│   ├── atq_client.hpp
│   ├── crypto_utils.hpp
│   └── http_client.hpp
├── src/
│   ├── atq_client.cpp
│   ├── crypto_utils.cpp
│   └── http_client.cpp
├── examples/
│   └── card_login_example.cpp
├── tests/
│   └── test_crypto.cpp
├── CMakeLists.txt
└── README.md
```

## 🔧 核心工具模块实现

### 2.1 RC4 加密算法实现

```cpp
// include/crypto_utils.hpp
#pragma once
#include <vector>
#include <string>
#include <cstdint>

namespace atq {
namespace crypto {

class RC4 {
public:
    /**
     * RC4加解密类
     * 注意：RC4是对称加密算法，加密和解密使用相同的方法
     */
    explicit RC4(const std::string& key);
    
    /**
     * 执行RC4加解密操作
     * @param data 输入数据
     * @return 加密/解密后的数据
     */
    std::vector<uint8_t> process(const std::vector<uint8_t>& data);
    
    /**
     * 字符串版本的加解密接口
     * @param data 输入字符串
     * @return 加密/解密后的字节数组
     */
    std::vector<uint8_t> process_string(const std::string& data);

private:
    std::vector<uint8_t> s_box_;
    void initialize_sbox(const std::string& key);
};

/**
 * 工具函数：字节数组转十六进制字符串
 */
std::string bytes_to_hex(const std::vector<uint8_t>& bytes);

/**
 * 工具函数：十六进制字符串转字节数组
 */
std::vector<uint8_t> hex_to_bytes(const std::string& hex);

} // namespace crypto
} // namespace atq
```

```cpp
// src/crypto_utils.cpp
#include "crypto_utils.hpp"
#include <stdexcept>
#include <iomanip>
#include <sstream>

namespace atq {
namespace crypto {

RC4::RC4(const std::string& key) {
    if (key.empty()) {
        throw std::invalid_argument("Key cannot be empty");
    }
    initialize_sbox(key);
}

void RC4::initialize_sbox(const std::string& key) {
    s_box_.resize(256);
    
    // 初始化S盒
    for (int i = 0; i < 256; ++i) {
        s_box_[i] = static_cast<uint8_t>(i);
    }
    
    // KSA算法：根据密钥打乱S盒
    uint8_t j = 0;
    for (int i = 0; i < 256; ++i) {
        j = (j + s_box_[i] + static_cast<uint8_t>(key[i % key.length()])) % 256;
        // 交换s_box_[i]和s_box_[j]
        std::swap(s_box_[i], s_box_[j]);
    }
}

std::vector<uint8_t> RC4::process(const std::vector<uint8_t>& data) {
    std::vector<uint8_t> result;
    result.reserve(data.size());
    
    uint8_t i = 0, j = 0;
    
    for (size_t index = 0; index < data.size(); ++index) {
        // PRGA算法：生成密钥流
        i = (i + 1) % 256;
        j = (j + s_box_[i]) % 256;
        
        // 交换
        std::swap(s_box_[i], s_box_[j]);
        
        // 生成密钥字节
        uint8_t keystream_byte = s_box_[(s_box_[i] + s_box_[j]) % 256];
        
        // 异或运算
        result.push_back(data[index] ^ keystream_byte);
    }
    
    return result;
}

std::vector<uint8_t> RC4::process_string(const std::string& data) {
    std::vector<uint8_t> byte_data(data.begin(), data.end());
    return process(byte_data);
}

std::string bytes_to_hex(const std::vector<uint8_t>& bytes) {
    std::stringstream ss;
    ss << std::hex << std::setfill('0');
    
    for (const auto& byte : bytes) {
        ss << std::setw(2) << static_cast<int>(byte);
    }
    
    return ss.str();
}

std::vector<uint8_t> hex_to_bytes(const std::string& hex) {
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

} // namespace crypto
} // namespace atq
```

### 2.2 HMAC-SHA256 签名实现

```cpp
// include/crypto_utils.hpp (追加)
#include <openssl/hmac.h>
#include <openssl/sha.h>

namespace atq {
namespace crypto {

/**
 * HMAC-SHA256签名计算
 * @param data 待签名数据
 * @param key 签名密钥
 * @return 64位十六进制签名字符串
 */
std::string hmac_sha256(const std::string& data, const std::string& key);

} // namespace crypto
} // namespace atq
```

```cpp
// src/crypto_utils.cpp (追加)
std::string hmac_sha256(const std::string& data, const std::string& key) {
    unsigned char* digest;
    unsigned int digest_len = SHA256_DIGEST_LENGTH;
    
    // 使用OpenSSL计算HMAC-SHA256
    digest = HMAC(EVP_sha256(),
                  key.c_str(), key.length(),
                  reinterpret_cast<const unsigned char*>(data.c_str()), data.length(),
                  nullptr, &digest_len);
    
    if (!digest) {
        throw std::runtime_error("HMAC calculation failed");
    }
    
    // 转换为十六进制字符串
    std::stringstream ss;
    ss << std::hex << std::setfill('0');
    
    for (unsigned int i = 0; i < digest_len; ++i) {
        ss << std::setw(2) << static_cast<unsigned int>(digest[i]);
    }
    
    return ss.str();
}

} // namespace crypto
} // namespace atq
```

### 2.3 HTTP客户端实现

```cpp
// include/http_client.hpp
#pragma once
#include <string>
#include <map>
#include <chrono>

namespace atq {
namespace http {

struct HttpResponse {
    int status_code;
    std::string body;
    std::map<std::string, std::string> headers;
    bool success;
    std::string error_message;
};

class HttpClient {
public:
    /**
     * HTTP客户端构造函数
     * @param timeout_seconds 超时时间（秒）
     */
    explicit HttpClient(long timeout_seconds = 10);
    
    /**
     * 发送POST请求
     * @param url 请求URL
     * @param json_data JSON数据
     * @param headers HTTP头部
     * @return HTTP响应
     */
    HttpResponse post(const std::string& url, 
                     const std::string& json_data,
                     const std::map<std::string, std::string>& headers = {});
    
    /**
     * 设置用户代理
     */
    void set_user_agent(const std::string& user_agent);
    
private:
    long timeout_seconds_;
    std::string user_agent_;
};

} // namespace http
} // namespace atq
```

```cpp
// src/http_client.cpp
#include "http_client.hpp"
#include <curl/curl.h>
#include <iostream>
#include <sstream>

namespace atq {
namespace http {

namespace {
    // CURL回调函数：写入响应数据
    size_t WriteCallback(void* contents, size_t size, size_t nmemb, std::string* userp) {
        size_t total_size = size * nmemb;
        userp->append(static_cast<char*>(contents), total_size);
        return total_size;
    }
}

HttpClient::HttpClient(long timeout_seconds) 
    : timeout_seconds_(timeout_seconds)
    , user_agent_("ATQ-CPP-Client/1.0") {
    // 全局CURL初始化
    curl_global_init(CURL_GLOBAL_DEFAULT);
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
    
    // 设置基本选项
    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_data.c_str());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response_body);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, timeout_seconds_);
    curl_easy_setopt(curl, CURLOPT_USERAGENT, user_agent_.c_str());
    
    // 设置HTTP头部
    struct curl_slist* header_list = nullptr;
    header_list = curl_slist_append(header_list, "Content-Type: application/json");
    
    for (const auto& [key, value] : headers) {
        std::string header = key + ": " + value;
        header_list = curl_slist_append(header_list, header.c_str());
    }
    
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, header_list);
    
    // 执行请求
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
    
    // 清理资源
    curl_slist_free_all(header_list);
    curl_easy_cleanup(curl);
    
    return response;
}

void HttpClient::set_user_agent(const std::string& user_agent) {
    user_agent_ = user_agent;
}

} // namespace http
} // namespace atq
```

## 🚀 核心业务类实现

### 3.1 ATQ客户端主类

```cpp
// include/atq_client.hpp
#pragma once
#include "crypto_utils.hpp"
#include "http_client.hpp"
#include <nlohmann/json.hpp>
#include <string>
#include <chrono>

namespace atq {

using json = nlohmann::json;

class ATQClient {
public:
    /**
     * ATQ客户端构造函数
     * @param app_id 应用ID
     * @param secret_key 应用密钥
     * @param host 服务器地址
     */
    ATQClient(const std::string& app_id, 
              const std::string& secret_key, 
              const std::string& host = "https://apiy.me");
    
    /**
     * 卡密登录接口
     * @param card 卡密字符串
     * @param markcode 设备识别码
     * @return JSON响应数据或空对象（失败时）
     */
    json card_login(const std::string& card, 
                   const std::string& markcode = "CPP_CLIENT");
    
    /**
     * 获取最后一次错误信息
     */
    const std::string& get_last_error() const { return last_error_; }
    
private:
    std::string app_id_;
    std::string secret_key_;
    std::string host_;
    http::HttpClient http_client_;
    mutable std::string last_error_;
    
    /**
     * 准备标准请求载荷
     */
    json prepare_request(const json& biz_data);
    
    /**
     * 获取当前Unix时间戳
     */
    std::string get_timestamp() const;
    
    /**
     * 解密响应数据
     */
    json decrypt_response_data(const std::string& encrypted_data);
};

} // namespace atq
```

```cpp
// src/atq_client.cpp
#include "atq_client.hpp"
#include <iostream>
#include <iomanip>

namespace atq {

ATQClient::ATQClient(const std::string& app_id, 
                     const std::string& secret_key, 
                     const std::string& host)
    : app_id_(app_id)
    , secret_key_(secret_key)
    , host_(host)
    , http_client_(10) {  // 10秒超时
}

json ATQClient::card_login(const std::string& card, const std::string& markcode) {
    std::cout << "\n" << std::string(50, '=') << std::endl;
    std::cout << "开始卡密登录流程" << std::endl;
    std::cout << "卡密: " << card << std::endl;
    std::cout << "设备码: " << markcode << std::endl;
    std::cout << std::string(50, '=') << std::endl;
    
    try {
        // 1. 准备业务数据
        json biz_data = {
            {"card", card},
            {"markcode", markcode}
        };
        
        // 2. 构造完整请求
        json payload = prepare_request(biz_data);
        
        // 3. 发送HTTP请求
        std::string url = host_ + "/api/cardLogin";
        std::string json_payload = payload.dump();
        
        std::cout << "[*] 请求URL: " << url << std::endl;
        std::cout << "[*] 请求载荷: " << json_payload << std::endl;
        
        auto response = http_client_.post(url, json_payload);
        
        std::cout << "[*] HTTP状态码: " << response.status_code << std::endl;
        std::cout << "[*] 响应体: " << response.body << std::endl;
        
        if (!response.success) {
            last_error_ = "HTTP请求失败: " + response.error_message;
            return json{};
        }
        
        // 4. 解析响应JSON
        json response_json;
        try {
            response_json = json::parse(response.body);
        } catch (const json::exception& e) {
            last_error_ = "响应JSON解析失败: " + std::string(e.what());
            return json{};
        }
        
        std::string code = response_json.value("code", "");
        std::string message = response_json.value("message", "");
        
        std::cout << "[*] 响应码: " << code << std::endl;
        std::cout << "[*] 响应消息: " << message << std::endl;
        
        if (code == "200") {
            // 成功：解密响应数据
            std::string encrypted_data = response_json.value("data", "");
            if (encrypted_data.empty()) {
                last_error_ = "响应数据为空";
                return json{};
            }
            
            try {
                json decrypted_data = decrypt_response_data(encrypted_data);
                std::cout << "[*] 解密后数据: " << decrypted_data.dump(2) << std::endl;
                return decrypted_data;
            } catch (const std::exception& e) {
                last_error_ = "解密响应数据失败: " + std::string(e.what());
                return json{};
            }
        } else {
            // 失败：返回错误信息
            last_error_ = message;
            return json{};
        }
        
    } catch (const std::exception& e) {
        last_error_ = "请求异常: " + std::string(e.what());
        return json{};
    }
}

json ATQClient::prepare_request(const json& biz_data) {
    // 1. 序列化业务数据为紧凑JSON
    std::string biz_json = biz_data.dump();
    std::cout << "[DEBUG] 业务数据JSON: " << biz_json << std::endl;
    
    // 2. RC4加密业务数据
    crypto::RC4 rc4(secret_key_);
    auto encrypted_bytes = rc4.process_string(biz_json);
    std::string encrypted_data = crypto::bytes_to_hex(encrypted_bytes);
    std::cout << "[DEBUG] 加密后数据: " << encrypted_data << std::endl;
    
    // 3. 生成时间戳
    std::string timestamp = get_timestamp();
    std::cout << "[DEBUG] 当前时间戳: " << timestamp << std::endl;
    
    // 4. 构造签名字符串
    std::string sign_str = app_id_ + timestamp + encrypted_data;
    std::cout << "[DEBUG] 签名原串: " << sign_str << std::endl;
    
    // 5. 计算HMAC-SHA256签名
    std::string signature = crypto::hmac_sha256(sign_str, secret_key_);
    std::cout << "[DEBUG] 生成签名: " << signature << std::endl;
    
    // 6. 构造完整请求载荷
    json payload = {
        {"app_id", app_id_},
        {"time", timestamp},
        {"data", encrypted_data},
        {"sign", signature}
    };
    
    return payload;
}

std::string ATQClient::get_timestamp() const {
    auto now = std::chrono::duration_cast<std::chrono::seconds>(
        std::chrono::system_clock::now().time_since_epoch()
    );
    return std::to_string(now.count());
}

json ATQClient::decrypt_response_data(const std::string& encrypted_data) {
    // 1. 十六进制字符串转字节数组
    auto encrypted_bytes = crypto::hex_to_bytes(encrypted_data);
    
    // 2. RC4解密
    crypto::RC4 rc4(secret_key_);
    auto decrypted_bytes = rc4.process(encrypted_bytes);
    
    // 3. 字节数组转字符串并解析JSON
    std::string decrypted_string(decrypted_bytes.begin(), decrypted_bytes.end());
    return json::parse(decrypted_string);
}

} // namespace atq
```

## 📊 使用示例

### 4.1 基础使用示例

```cpp
// examples/card_login_example.cpp
#include "atq_client.hpp"
#include <iostream>

int main() {
    try {
        // 配置参数
        const std::string APP_ID = "1";
        const std::string SECRET_KEY = "123456";
        const std::string HOST = "https://apiy.me";
        
        // 创建客户端实例
        atq::ATQClient client(APP_ID, SECRET_KEY, HOST);
        
        // 测试卡密登录
        std::string test_card = "CARDJUCMS6KWB5IJ";
        
        auto result = client.card_login(test_card);
        
        std::cout << "\n" << std::string(50, '=') << std::endl;
        if (!result.empty()) {
            std::cout << "[✓] 卡密登录成功！" << std::endl;
            std::cout << "卡号: " << result.value("card", "") << std::endl;
            std::cout << "到期时间: " << result.value("endTime", "") << std::endl;
            std::cout << "Token: " << result.value("token", "") << std::endl;
        } else {
            std::cout << "[✗] 卡密登录失败" << std::endl;
            std::cout << "错误信息: " << client.get_last_error() << std::endl;
        }
        std::cout << std::string(50, '=') << std::endl;
        
    } catch (const std::exception& e) {
        std::cerr << "程序异常: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}
```

### 4.2 CMake构建配置

```cmake
# CMakeLists.txt
cmake_minimum_required(VERSION 3.15)
project(atq_cpp_client VERSION 1.0.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 查找依赖库
find_package(PkgConfig REQUIRED)
find_package(OpenSSL REQUIRED)

pkg_check_modules(JSON REQUIRED nlohmann_json)

# 包含目录
include_directories(include)
include_directories(${OPENSSL_INCLUDE_DIR})
include_directories(${JSON_INCLUDE_DIRS})

# 编译选项
if(MSVC)
    add_compile_options(/W4)
else()
    add_compile_options(-Wall -Wextra -pedantic)
endif()

# 源文件
set(SOURCES
    src/crypto_utils.cpp
    src/http_client.cpp
    src/atq_client.cpp
)

# 库目标
add_library(atq_client STATIC ${SOURCES})

target_link_libraries(atq_client 
    ${OPENSSL_LIBRARIES}
    CURL
    ${JSON_LIBRARIES}
)

# 示例程序
add_executable(card_login_example examples/card_login_example.cpp)
target_link_libraries(card_login_example atq_client)

# 测试程序
add_executable(test_crypto tests/test_crypto.cpp)
target_link_libraries(test_crypto atq_client)
```

### 4.3 构建和运行

```bash
# 创建构建目录
mkdir build && cd build

# 配置项目
cmake ..

# 编译
make

# 运行示例
./card_login_example

# 运行测试
./test_crypto
```

## 🔒 高级特性实现

### 5.1 连接池优化

```cpp
// include/connection_pool.hpp
#pragma once
#include <queue>
#include <mutex>
#include <memory>
#include <curl/curl.h>

namespace atq {
namespace http {

class CurlConnection {
public:
    CurlConnection();
    ~CurlConnection();
    CURL* get_handle() { return curl_; }
    
private:
    CURL* curl_;
};

class ConnectionPool {
public:
    static ConnectionPool& instance();
    
    std::shared_ptr<CurlConnection> acquire_connection();
    void release_connection(std::shared_ptr<CurlConnection> conn);
    
private:
    ConnectionPool() = default;
    std::queue<std::shared_ptr<CurlConnection>> pool_;
    std::mutex mutex_;
    static constexpr size_t MAX_POOL_SIZE = 10;
};

} // namespace http
} // namespace atq
```

### 5.2 异步请求支持

```cpp
// include/async_client.hpp
#pragma once
#include <future>
#include <thread>
#include "atq_client.hpp"

namespace atq {

class AsyncATQClient : public ATQClient {
public:
    using ATQClient::ATQClient;
    
    /**
     * 异步卡密登录
     */
    std::future<json> async_card_login(const std::string& card, 
                                      const std::string& markcode = "CPP_ASYNC_CLIENT") {
        return std::async(std::launch::async, 
                         [this, card, markcode]() {
                             return this->card_login(card, markcode);
                         });
    }
};

} // namespace atq
```

## 🛠️ 生产环境最佳实践

### 6.1 配置管理

```cpp
// include/config_manager.hpp
#pragma once
#include <string>
#include <unordered_map>

namespace atq {

class ConfigManager {
public:
    static ConfigManager& instance();
    
    bool load_from_file(const std::string& filepath);
    bool load_from_env();
    
    std::string get(const std::string& key, const std::string& default_value = "") const;
    void set(const std::string& key, const std::string& value);
    
private:
    ConfigManager() = default;
    std::unordered_map<std::string, std::string> config_;
};

} // namespace atq
```

### 6.2 日志系统集成

```cpp
// include/logger.hpp
#pragma once
#include <string>
#include <fstream>
#include <mutex>

namespace atq {

enum class LogLevel {
    DEBUG,
    INFO,
    WARN,
    ERROR
};

class Logger {
public:
    static Logger& instance();
    
    void set_log_level(LogLevel level);
    void set_log_file(const std::string& filepath);
    
    void log(LogLevel level, const std::string& message);
    
private:
    Logger() = default;
    LogLevel current_level_ = LogLevel::INFO;
    std::ofstream log_file_;
    std::mutex mutex_;
};

#define LOG_DEBUG(msg) Logger::instance().log(LogLevel::DEBUG, msg)
#define LOG_INFO(msg)  Logger::instance().log(LogLevel::INFO, msg)
#define LOG_WARN(msg)  Logger::instance().log(LogLevel::WARN, msg)
#define LOG_ERROR(msg) Logger::instance().log(LogLevel::ERROR, msg)

} // namespace atq
```

## 📈 性能优化建议

### 7.1 内存管理优化

```cpp
// 使用智能指针避免内存泄漏
class ATQClient {
private:
    std::unique_ptr<crypto::RC4> rc4_encryptor_;
    std::unique_ptr<http::HttpClient> http_client_;
};

// 预分配容器容量
std::vector<uint8_t> result;
result.reserve(data.size());  // 避免频繁重新分配
```

### 7.2 编译优化选项

```cmake
# CMakeLists.txt (追加)
if(CMAKE_BUILD_TYPE STREQUAL "Release")
    if(MSVC)
        target_compile_options(atq_client PRIVATE /O2 /GL)
        target_link_options(atq_client PRIVATE /LTCG)
    else()
        target_compile_options(atq_client PRIVATE -O3 -march=native)
    endif()
endif()
```

## 🎯 跨平台兼容性

### 8.1 平台特定代码

```cpp
// include/platform_utils.hpp
#pragma once
#include <string>

namespace atq {
namespace platform {

#ifdef _WIN32
    const std::string PATH_SEPARATOR = "\\";
    // Windows特定实现
#else
    const std::string PATH_SEPARATOR = "/";
    // Unix/Linux/macOS特定实现
#endif

std::string get_current_time_string();
std::string get_machine_guid();

} // namespace platform
} // namespace atq
```

## 🧪 单元测试示例

```cpp
// tests/test_crypto.cpp
#include "crypto_utils.hpp"
#include <cassert>
#include <iostream>

void test_rc4_basic() {
    std::cout << "测试RC4基本功能..." << std::endl;
    
    std::string key = "test_key";
    std::string plaintext = "Hello ATQ!";
    
    atq::crypto::RC4 rc4(key);
    
    // 加密
    auto encrypted = rc4.process_string(plaintext);
    std::string encrypted_hex = atq::crypto::bytes_to_hex(encrypted);
    std::cout << "加密结果: " << encrypted_hex << std::endl;
    
    // 解密（使用相同密钥）
    auto decrypted = rc4.process(encrypted);
    std::string decrypted_text(decrypted.begin(), decrypted.end());
    
    assert(plaintext == decrypted_text);
    std::cout << "✓ RC4加解密测试通过" << std::endl;
}

void test_hmac_sha256() {
    std::cout << "测试HMAC-SHA256..." << std::endl;
    
    std::string data = "test data";
    std::string key = "secret_key";
    
    std::string signature = atq::crypto::hmac_sha256(data, key);
    
    assert(signature.length() == 64);  // 32字节 = 64个十六进制字符
    std::cout << "✓ HMAC-SHA256测试通过" << std::endl;
}

int main() {
    try {
        test_rc4_basic();
        test_hmac_sha256();
        std::cout << "\n🎉 所有测试通过！" << std::endl;
        return 0;
    } catch (const std::exception& e) {
        std::cerr << "测试失败: " << e.what() << std::endl;
        return 1;
    }
}
```

## 📚 总结

通过本文的学习，你应该掌握了：

1. **现代C++开发**：C++17特性运用、智能指针、RAII等
2. **加密算法实现**：RC4流加密的完整实现
3. **网络安全**：HMAC-SHA256签名机制
4. **HTTP通信**：基于libcurl的高效HTTP客户端
5. **工程实践**：CMake构建、单元测试、日志系统等

这套C++ SDK具有以下优势：
- **高性能**：接近原生代码的执行效率
- **跨平台**：支持Windows、Linux、macOS
- **类型安全**：充分利用C++强类型特性
- **内存安全**：RAII和智能指针避免内存泄漏
- **易于集成**：模块化设计，便于嵌入现有项目

**完整源码已在GitHub开源**，欢迎提交Issue和Pull Request！

---
*作者：ATQ Team*  
*最后更新：2026-02-20*