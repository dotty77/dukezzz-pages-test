# DUKE GitHub Pages 测试站

[打开试站](https://dotty77.github.io/dukezzz-pages-test/) · [正式网站](https://dukezzz.com/)

网站文件统一放在 **docs/**，根目录保留这份说明和换行设置。目录调整不改网站资源，也不改变公开网址。

| 文件/目录 | 用途 |
| --- | --- |
| docs/*.html | 网站各个页面 |
| docs/*.js | 地图、计算和页面交互 |
| docs/*.json | 角色、物资、地图等公开资料 |
| docs/*.css | 页面样式 |
| docs/assets/ | 图片、模型、贴图及媒体包 |
| docs/vendor/、docs/locales/ 等 | 依赖、语言和网站运行数据 |

GitHub Pages 发布设置：分支 **codex/pages-test**，目录 **/docs**。公开地址仍为 `/dukezzz-pages-test/`，网址中不添加 `/docs/`。

这是独立静态测试站，正式网站继续运行。账号同步、真实展柜查询和调频链接导入请用页面中的正式站入口；两站分别保存数据，可通过现有导出/导入文件转移。

仓库只含已公开的网站资源与说明，不含服务端、凭据或开发记录。`.gitattributes` 的 `* -text` 对 docs/ 同样生效，保留所有文件原始字节。页面保留原有版权和资料来源说明。
