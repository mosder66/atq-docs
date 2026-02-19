/**
 * @see https://theme-plume.vuejs.press/config/navigation/ 查看文档了解配置详情
 *
 * Navbar 配置文件，它在 `.vuepress/plume.config.ts` 中被导入。
 */

import { defineNavbarConfig } from "vuepress-theme-plume";

export default defineNavbarConfig([
  { text: "首页", link: "/" },
  { text: "博客", link: "/blog/" },
  {
    text: "接口文档",
    icon: "material-symbols:api",
    items: [
      { text: "基础规范 (必看)", link: "/api/general/" },
      { text: "用户服务", link: "/api/user/" },
      { text: "卡密服务", link: "/api/card/" },
      { text: "HTML SDK", link: "/api/html_sdk.md" },
    ],
  },
]);
