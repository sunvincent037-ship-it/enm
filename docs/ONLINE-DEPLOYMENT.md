# 免费试玩发布

使用 GitHub Pages 承载网页、Render Free 承载双人房间。所有链接必须以平台实际生成的地址为准。

## 本地运行

安装 Node.js 24，运行 `npm ci`、`npm start`，打开 `http://localhost:4173`。房间入口为 `?mode=online`。同一台电脑可开两个独立标签页测试创建、输入六位房间号、准备、房主开战。

## GitHub

将干净发布包的内容放进一个 GitHub 仓库根目录，默认分支为 `main`。仓库 Settings → Pages → Source 选择 GitHub Actions。Actions 中的 Publish playable game 成功后，Environment 会显示实际试玩地址。

发布包用 `node scripts/build-online-release.cjs` 生成到新的 `deploy-package/mobile-online-release`。已有非空输出目录不会被删除或覆盖；再次导出请提供新的 `--out` 目录。

## Render

在 Render 中以同一个 GitHub 仓库创建 Blueprint，使用根目录 `render.yaml`。配置明确为 Free、Singapore、Node 24、`npm ci --omit=dev`、`npm start`、健康检查 `/healthz`。使用 Render 注入的 PORT，不创建数据库或付费资源。

Render 部署后，先打开其 `/healthz`，确认返回 `ok:true`。在 GitHub 仓库 Settings → Secrets and variables → Actions → Variables 添加 `RENDER_SERVER_URL`，值为实际的 `https://服务名.onrender.com`。重新运行 Publish playable game，网页会使用对应的加密 WebSocket 房间服务。

也可直接修改 `versus/network-config.js` 的 `url` 为实际 Render HTTPS 地址。该地址是公开配置，不是密钥。默认空地址时 GitHub 网页会提示联机尚未配置，本地对战仍可玩；在 Render 域名上打开网页时会自动连接同域房间。

可在 Render 设置 `ALLOWED_ORIGINS` 为 GitHub Pages 源和 Render 源，以逗号分隔，源仅包含协议和域名，例如 `https://用户名.github.io,https://实际服务名.onrender.com`，不要带仓库路径。

## 试玩与限制

手机和平板推荐横屏。左摇杆左右移动，上推跳跃，下拉防御，快速双推同一方向冲刺。右侧普攻短按轻击、长按重击；技能一、技能二、必杀、脱身、援助六键。具有专属能力时增加一键，蓄气为小键。菜单中的自定义按键可拖动、缩放、保存，横竖屏分别记忆。

联机先做两人 1v1；双方准备后由房主开始。断线会清除该玩家的输入，并暂停等待最多20秒恢复；超时判负。离开房间会结束当前对局，房主可在结算后返回房间再战。房间只保存在内存中，服务重启后需重新创建。

Render Free 空闲后会休眠，首次连接可能约一分钟；页面有重连提示。GitHub Pages 与 Render 的中国大陆访问需要实际网络测试，无法保证所有地区或运营商稳定。Render 网页本身可作为 GitHub 入口的备用；若二者均不可达，仍需另选可用的静态托管与服务器。

官方说明：[Render Free](https://render.com/docs/free)、[Render Blueprint](https://render.com/docs/blueprint-spec)、[GitHub Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
