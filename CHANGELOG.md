# 更新记录 / Changelog

## 1.1.0 — 2026-10-27

### 简体中文

- 搜索：标题与正文关键词、多关键词匹配、命中高亮、全部便签 / 当前视图范围、一键清除。加锁便签只搜索标题。
- 密码锁：每篇便签独立设置密码，正文与图片加密保存；支持解锁编辑、切换和关闭后自动锁定、立即锁定及验证密码后移除锁。
- 多窗口：悬浮窗口单独解锁；立即锁定前先保存该便签各窗口的修改，锁定后清除正文与撤销历史。
- 分组移动：分组下拉框、工具栏按钮、右键菜单及拖到左侧分组均可移动便签。
- 右键菜单：置顶、设置密码、复制、导出和删除；回收站中可恢复或永久删除。
- 联系入口：仅保留两个文字链接，“联系作者”打开抖音，“使用反馈 / 功能建议”打开作者网站。
- Windows 安装包：支持中文 / 英文安装向导、自选安装目录、桌面及开始菜单快捷方式；应用界面为简体中文。
- 文档：更新中英文说明、演示截图、存储和界面测试。

**升级与密码说明**

更新前先导出备份，并从系统托盘退出旧版。首次加锁会将数据格式升级为版本 2，旧版 1.0.x 无法读取；之后请使用 1.1.0 或更新版本。新版仍可读取旧数据及追加导入旧备份。

密码无法找回。正文和图片加密，标题、分组及时间仍可见。加锁便签的完整 JSON 备份与副本保留密码保护；解锁后导出的 TXT / HTML 是明文。加锁前已有的备份和副本不会自动加密。

**许可**

自 1.0.1 起采用非商业许可：免费软件，禁止商业用途。本项目新版源码公开可查看，但该许可不属于 OSI 定义的开源许可。此前按 MIT 发布的 1.0.0 及其代码保留原有许可，原声明保存在 `LICENSE-MIT-1.0.0`；第三方组件保留各自许可。

### English

- Search titles and bodies with multiple keywords, highlights, all-notes/current-view scopes, and one-click clearing. Protected notes are searchable by title only.
- Set a separate password for each note. Bodies and images are encrypted; support editing after authentication, automatic relocking when switching notes or closing windows, immediate lock, and password-verified lock removal.
- Floating windows authenticate independently. Immediate lock saves pending edits across windows, then clears plaintext and editor undo history.
- Move notes using the folder selector, toolbar, context menu, or drag-and-drop onto a sidebar folder.
- Context menus provide pin, password, duplicate, export, and trash actions; trash menus provide restore and permanent deletion.
- Keep only two contact text links: Contact the author opens Douyin; Feedback / feature suggestions opens the author website.
- Windows setup supports Chinese/English, custom installation directories, and desktop/Start-menu shortcuts. The app UI remains Simplified Chinese.
- Refresh bilingual documentation, demo screenshots, storage tests, and interface tests.

**Upgrade and password notes**

Export a backup and quit the old app from its tray menu before updating. The first password lock upgrades the storage format to version 2, which 1.0.x cannot read. Use 1.1.0 or newer afterward. Old data and additive backup import remain supported.

Forgotten passwords cannot be recovered. Titles, folders, and timestamps remain visible. Complete JSON backups and duplicates retain password protection; TXT/HTML exports are plaintext. Preexisting backups and other copies are not encrypted retroactively.

**License**

Since 1.0.1, original content uses a noncommercial license: free of charge, with commercial use prohibited. The source is publicly available, but this is not an OSI open-source license. Previously MIT-licensed 1.0.0 code retains its original license in `LICENSE-MIT-1.0.0`. Third-party components keep their own licenses.
