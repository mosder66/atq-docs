---
title: 用户服务 API
icon: material-symbols:account-circle
createTime: 2026-02-18
permalink: /api/user/
---

# 用户服务 API

用户服务主要负责用户的账号生命周期管理，包括注册、登录、信息查询等。

## 1. 用户注册

**接口描述**: 允许新用户提交信息进行注册。

### 接口地址

`POST /api/userRegister`

### 请求参数 (data)

| 参数名   | 类型   | 是否必选 | 说明                                       |
| :------- | :----- | :------- | :----------------------------------------- |
| username | String | 是       | 唯一的用户名                               |
| password | String | 是       | 用户密码                                   |
| nickname | String | 否       | 用户昵称                                   |
| email    | String | 否       | 用户邮箱                                   |
| phone    | String | 否       | 用户手机号                                 |
| markcode | String | 否       | 设备识别码（若提供，注册后自动建立登录态） |
| app_id   | String | 是       | [外层] 所属应用 ID                         |

### 请求示例

```json
{
  "app_id": "app_123456",
  "data": {
    "username": "newuser001",
    "password": "your_password",
    "nickname": "小王",
    "email": "user@example.com",
    "phone": "13800000000",
    "markcode": "DEVICE_ID_001"
  },
  "time": "1676644800",
  "sign": "generated_signature"
}
```

### 响应结果

```json
{
  "code": "200",
  "message": "注册成功",
  "data": {
    "userId": 1001,
    "username": "newuser001"
  },
  "timestamp": 1676644805
}
```

---

## 2. 用户登录

**接口描述**: 验证用户身份并返回访问令牌。

### 接口地址

`POST /api/userLogin`

### 请求属性

- **方法**: `POST`
- **路径**: `/api/userLogin`

### 请求参数 (data)

| 参数名   | 类型   | 是否必选 | 说明    |
| :------- | :----- | :------- | :------ |
| username | String | 是       | 用户名  |
| password | String | 是       | 密码    |
| app_id   | String | 是       | 应用 ID |

---

## 3. 获取用户信息

**接口描述**: 用于客户端通过用户 ID 获取详细的个人资料及会员状态。

### 接口信息

- **请求路径**: `/api/getUserInfo`
- **请求方法**: `POST`
- **内容类型**: `application/json`
- **认证要求**: 需按照应用配置进行全量签名与加密处理。

### 请求参数

| 参数名  | 类型    | 必选 | 说明                  |
| :------ | :------ | :--- | :-------------------- |
| user_id | Integer | 是   | 需要查询的用户 ID     |
| app_id  | Integer | 是   | 当前操作所属的应用 ID |

### 响应说明

**成功响应示例**

```json
{
  "code": "200",
  "msg": "success",
  "data": {
    "id": 123,
    "username": "tester01",
    "nickname": "测试用户",
    "email": "test@example.com",
    "phone": "13800000000",
    "avatar": "http://domain.com/avatar.jpg",
    "role": "user",
    "membershipStatus": 1,
    "membershipExpireTime": "2026-12-31 23:59:59",
    "status": "1",
    "createTime": "2026-01-01 10:00:00",
    "updateTime": "2026-02-20 00:00:00",
    "token": "uuid-token-string",
    "ip": "127.0.0.1"
  }
}
```

### 关键字段解析

- **membershipStatus**: 会员状态（0-普通用户，1-会员）。
- **membershipExpireTime**: 会员过期时间，若非会员则可能为 null。
- **status**: 账户状态（1-正常，0-禁用）。

### 错误响应状态码

| 状态码 | 含义       | 原因建议                                           |
| :----- | :--------- | :------------------------------------------------- |
| 400    | 参数错误   | `user_id` 缺失或格式非法。                         |
| 404    | 用户不存在 | 数据库中找不到对应 `id` 且属于该 `app_id` 的用户。 |
| 500    | 系统错误   | 服务器内部逻辑异常。                               |

### 安全说明

查询时请确保 `app_id` 与用户具有从属关系，若发现跨应用查询，接口将返回 403。

---

## 4. 用户心跳

**接口描述**: 保持用户在线状态，防止因长时间无操作导致令牌失效。

### 接口地址

`POST /api/userHeartbeat`

### 请求参数 (data)

| 参数名   | 类型    | 说明              |
| :------- | :------ | :---------------- |
| user_id  | Integer | 用户 ID           |
| token    | String  | 登录凭证          |
| markcode | String  | 设备识别码 (可选) |

---

## 5. 用户会员激活

**接口描述**: 用于用户通过输入“用户会员卡密”（Type 3）来激活其会员身份。

### 接口信息

- **请求路径**: `/api/activateMembership`
- **请求方法**: `POST`
- **内容类型**: `application/json`
- **认证要求**: 需按照应用配置进行全量签名与加密处理（由 `SecurityInterceptor` 校验）。

### 请求参数

请求体需包含经过加密和签名的业务数据块：

| 参数名  | 类型    | 必选 | 说明                             |
| :------ | :------ | :--- | :------------------------------- |
| card    | String  | 是   | 待使用的卡密字符串               |
| user_id | Integer | 是   | 执行激活操作的用户 ID            |
| app_id  | Integer | 是   | 所属应用 ID (通常在签名公共头中) |

### 业务逻辑限制

1.  **卡密类型限制**: 仅允许 `type = 3` 的“用户会员卡”进行激活。
2.  **状态检查**:
    - 卡密必须处于“启用”状态。
    - 卡密必须从未被使用（`startTime` 必须为空）。
3.  **所属权校验**: 用户必须属于传入的 `app_id` 对应的应用。
4.  **时长计算**: 系统会根据卡密配置的 `card_type`（分钟、小时、天等）自动计算会员过期时间。

### 响应说明

**成功响应示例**

```json
{
  "code": "200",
  "msg": "success",
  "data": {
    "card": "XXXX-XXXX-XXXX-XXXX",
    "membershipExpireTime": "2026-03-20 00:00:00",
    "message": "会员激活成功"
  }
}
```

### 错误响应状态码

| 状态码 | 含义       | 可能原因                                           |
| :----- | :--------- | :------------------------------------------------- |
| 400    | 参数错误   | 缺少必填项、卡密已使用、卡密类型不匹配、用户跨应用 |
| 404    | 资源不存在 | 卡密无效或用户 ID 不存在                           |
| 500    | 服务器错误 | 内部逻辑异常                                       |

### 注意事项

- 激活成功后，后台会同步更新 `Card` 表（标记已使用）和 `User` 表（更新过期时间）。
- 建议客户端在激活成功后引导用户重新请求用户信息接口以刷新本地状态。
