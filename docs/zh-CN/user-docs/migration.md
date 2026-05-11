# 导入 `.planning` 项目

如果你有仍在使用 `.planning` 目录结构的项目，可以把它们导入 GWD 的 `.gwd` 格式。

## 运行导入

```bash
# 在项目目录内执行
/gwd migrate

# 或者显式指定路径
/gwd migrate ~/projects/my-old-project
```

## 会导入什么

导入工具会：

- 解析旧版的 `PROJECT.md`、`ROADMAP.md`、`REQUIREMENTS.md`、phase 目录、计划、总结和研究文档
- 将 phases 映射为 slices、plans 映射为 tasks、milestones 映射为 milestones
- 保留完成状态（`[x]` 阶段保持已完成，原有 summary 会被带过来）
- 将研究文件整合进新的目录结构
- 在真正写入前先展示预览
- 可选运行一次由 agent 驱动的结果审查，以做质量保证

## 支持的格式

导入器可处理多种 `.planning` 文档变体：

- 按 milestone 分段、带 `<details>` 块的 roadmap
- 粗体 phase 条目
- 列表格式的 requirements
- 十进制 phase 编号
- 跨不同 milestones 重复的 phase 编号

## 前提条件

如果项目有 `ROADMAP.md` 来描述 milestone 结构，导入效果最好。没有的话，系统会根据 `phases/` 目录推断 milestones。

## 导入后

导入完成后，用下面的命令检查输出结果：

```bash
/gwd doctor
```

它会检查 `.gwd/` 的完整性，并标出任何结构性问题。
