# FlowKit

[English](./README.md) | [简体中文](./README.zh-CN.md)

FlowKit 是一个面向企业 Web 应用的适配器驱动、Headless 审批流 SDK。它关注审批体验层：任务列表、任务详情、表单、审批动作、审批历史和状态编排。FlowKit 不是 BPMN 引擎，也不绑定某个特定后端。

第一个里程碑刻意保持小型化：

1. 定义核心任务与工作流协议。
2. 构建可供各框架组件消费的 Headless 状态层。
3. 构建面向审批表单的表单层。
4. 提供用于本地开发的 Mock Adapter。
5. 提供最小化的 Vue 2 组件集。
6. 提供采购审批和请假审批示例流程。

## 当前状态

FlowKit 已打通第一个最小闭环：Mock Adapter 提供待办任务，headless 层负责加载列表、打开详情、提交审批动作并刷新审批历史。当前实现用于本地开发，生产环境仍需接入真实后端 Adapter。

## 包结构

| 包 | 用途 |
| --- | --- |
| `@flowkit/core` | 核心工作流类型、任务协议和状态定义。 |
| `@flowkit/headless` | 与框架无关的工作流状态编排层。 |
| `@flowkit/adapter-mock` | 无网络依赖的确定性 Mock 任务和审批动作。 |
| `@flowkit/form` | 审批表单 Schema、渲染协议和校验模型。 |

完整目标结构还会包含 Adapter、Vue 包、UI 包、设计器、示例和文档。这些包会在对应里程碑启动时逐步加入。

## 开发

FlowKit 使用 [pnpm](https://pnpm.io/) workspaces。

```bash
pnpm install
pnpm verify
pnpm demo
```

`pnpm demo` 会执行“加载待办 → 打开任务 → 同意 → 刷新列表和历史”的完整流程。示例代码位于 `examples/mock-vue2/src/index.js`；Vue 2 组件可以直接复用同一组 headless 方法。

## 仓库规范

- 默认分支：`main`
- 功能分支：`feat/<scope>-<name>`
- 修复分支：`fix/<scope>-<name>`
- 提交格式：`feat(core): add task action transition`
- 发布顺序：`core`、`headless`、adapter 和 form、`vue2`、`ui`

## 许可证

FlowKit 基于 [MIT License](./LICENSE) 发布。
