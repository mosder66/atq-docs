---
title: 卡密与激活服务 API
icon: material-symbols:credit-card
createTime: 2026-02-18
permalink: /api/card/
---

# 卡密与激活服务 API

本章节包含卡密登录、心跳解绑以及激活会员服务。

## 1. 卡密服务

### 1.1 卡密登录

- **接口地址**: `POST /api/cardLogin`
- **参数 (data)**:
  - `card` (String): 唯一的卡密字符串
  - `markcode` (String): 设备的硬特征码

### 1.2 卡密心跳/解绑

- **接口地址 (心跳)**: `POST /api/cardHeartbeat`
- **接口地址 (解绑)**: `POST /api/cardUnbind`
- **通用参数 (data)**:
  - `card` (String): 卡密
  - `markcode` (String): 设备识别码
  - `token` (String): 业务令牌

---

## 2. 激活会员 (卡密充值)

**接口描述**: 使用指定类型的卡密为用户账号增加会员时长。

### 接口地址

`POST /api/activateMembership`

### 请求参数 (data)

| 参数名  | 类型    | 说明              |
| :------ | :------ | :---------------- |
| card    | String  | 会员卡密 (Type=3) |
| user_id | Integer | 目标用户 ID       |

---

## 3. 试用服务

### 3.1 试用登录/心跳

- **登录**: `POST /api/trialLogin` (参数: `markcode`)
- **心跳**: `POST /api/trialHeartbeat` (参数: `markcode`, `token`)
