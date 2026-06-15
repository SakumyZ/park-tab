# Park Tab

Park Tab 是一个面向多设备使用者的浏览器标签页管理插件。

它计划提供类似 OneTab 的一键收纳、分组保存、恢复标签页等能力，并增强 WebDAV 同步、完整导入导出和多设备状态一致性。

当前项目处于需求规划和早期开发阶段，详细需求见 [docs/requirements.md](docs/requirements.md)。

## 开发

```bash
npm install
npm run build
```

构建产物会输出到 `dist/`，可在 Chromium 系浏览器中以“加载已解压的扩展程序”的方式加载。
