<!-- filename: Tasks.md -->
---
title: Tasks & Plan（経営戦略ダッシュボード）
version: 0.1.0
date: 2025-08-18
owner: TBD
status: Draft
github_url: https://github.com/kozuki1126/business-strategy-dashboard
---

# 進行ルール
- 着手順序は **#001 から**。1タスク1成果物。完了定義＝**受入(GWT)満たす**＋`docs/DEVELOPMENT_PROGRESS.md`更新。
- フェーズ：**Inception → Alpha → Beta → GA(Internal) → PostGA**

# バックログ
| ID | Title | Desc | Owner | Status | Priority | DependsOn | Deliverables | Due | Acceptance (GWT) | Links (PRD/Rules/ImageGen) | GithubIssueURL | Log |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| #001 | リポジトリ初期化 | monorepo構成とdocs雛形 | TBD | Todo | High | - | repo, `docs/*` | TBD | Given repo作成 When push Then CIが動作 | PRD/Rules | TBD | |
| #002 | CI/PRゲート設定 | lint/unit/integration/e2e/build/coverage | TBD | Todo | High | #001 | GH Actions, badges | TBD | Given PR When CI Then 6チェック通過 | Rules | TBD | |
| #003 | Supabase初期化 | Postgres/Auth/Storage設定 | TBD | Todo | High | #001 | Supabase proj | TBD | Given env When migrate Then 接続OK | PRD/Rules | TBD | |
| #004 | スキーマ作成 | sales/masters/ext*/audit | TBD | Todo | High | #003 | SQL migration | TBD | Given migrate When seed Then 読書きOK | PRD/Rules | TBD | |
| #005 | 認証（メールリンク） | Magic Link ログイン | TBD | Todo | High | #003 | /auth 実装 | TBD | Given email When login Then セッション有効 | PRD/Rules | TBD | |
| #006 | ダッシュボードUI（α） | 指数/為替/天候/イベント/インバウンド/売上 | TBD | Todo | High | #004 | /dashboard | TBD | Given 選択 When 表示 Then p95≤1500ms | PRD/ImageGen | TBD | |
| #007 | 売上入力フォーム | 税抜入力/履歴/監査 | TBD | Todo | High | #004,#005 | /sales | TBD | Given 入力 When 保存 Then 即時反映 | PRD | TBD | |
| #008 | ETLスケジューラ | 06/12/18/22 JSTのFetch/Upsert | TBD | Todo | High | #003,#004 | jobs + logs | TBD | Given 時刻 When 実行 Then 10分内反映 | PRD/Rules | TBD | |
| #009 | E-mail通知 | 成功/失敗通知 | TBD | Todo | High | #008 | メール送信 | TBD | Given 失敗 When 検知 Then 通知送信 | PRD/Rules | TBD | |
| #010 | エクスポート | CSV/Excel生成/監査記録 | TBD | Todo | Medium | #004 | export機能 | TBD | Given 範囲 When Export Then p95≤5s | PRD | TBD | |
| #011 | 相関/比較分析 | 曜日/天候/イベント有無 | TBD | Todo | Medium | #006,#008 | 分析カード | TBD | Given 期間 When 分析 Then 指標表示 | PRD | TBD | |
| #012 | 監査ログ基盤 | view/export/inputを記録 | TBD | Todo | Medium | #004 | audit_log | TBD | Given 操作 When 実施 Then 記録有 | Rules | TBD | |
| #013 | RBAC設計（Phase1） | RLS/ロール/権限 | TBD | Todo | Medium | #012 | RLS有効化 | TBD | Given ロール When 切替 Then 制限動作 | PRD/Rules | TBD | |
| #014 | 性能・p95最適化 | N+1/キャッシュ/ISR | TBD | Todo | Medium | #006 | perf報告 | TBD | Given 100CCU When 30min Then SLO達成 | Rules | TBD | |
| #015 | E2E整備 | Playwright, retry=2, on-failure trace | TBD | Todo | Medium | #002 | e2e/ tests | TBD | Given pipeline When e2e Then 全pass | Rules | TBD | |
| #016 | 文書整備 | PRD/Rules/Tasks更新と相互参照 | TBD | Todo | Low | #001 | v0.2 docs | TBD | Given 更新 When review Then merge | 全て | TBD | |
| #IMG001 | 初期テンプレ（画像） | ImageGen_Prompts主要テンプレ5本 | TBD | Todo | High | #001 | 5テンプレ/3サンプル | TBD | Given prompts When run Then 3枚生成 | ImageGen | TBD | |
| #IMG002 | ブランド適用/AA | 色/タイポ/AAチェック | TBD | Todo | Medium | #IMG001 | 更新版/AA結果 | TBD | Given 指針 When mock Then AA準拠 | ImageGen/Rules | TBD | |

# マイルストーン
- **Alpha**：#001–#012 完了
- **Beta**：#013–#015 完了
- **GA(Internal)**：#016, #IMG001–#IMG002 完了

# リスク/課題
- 有償API未契約 → 公開API仕様変更リスク（モニタリング/フェイルソフト）  
- データ所在未確定 → コンプライアンス影響（**決定期限：Beta開始前**）  
- RBAC導入時の移行コスト → スキーマは**RLS前提で設計**

# 決定ログ（要約）
- 日4回更新（06/12/18/22 JST）、通知はE-mail、売上は**税抜**管理、エクスポート許可

# 参照
- [PRD.md](./PRD.md) / [Rules_Architecture.md](./Rules_Architecture.md) / [ImageGen_Prompts.md](./ImageGen_Prompts.md)