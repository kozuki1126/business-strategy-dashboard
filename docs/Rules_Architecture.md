<!-- filename: Rules_Architecture.md -->
---
title: Rules & Architecture（経営戦略ダッシュボード）
version: 0.1.0
date: 2025-08-18
owner: TBD
reviewers: TBD
status: Draft
github_url: https://github.com/kozuki1126/business-strategy-dashboard
---

# ADR要旨
- **ADR-001** UI/FE：**Next.js（App Router）** を採用。理由：SSR/ISRで高速表示、URL配布のみで利用開始。  
- **ADR-002** 認証：**メール・マジックリンク**（SSOは後続）。  
- **ADR-003** データ基盤：**Supabase (Postgres, Auth, Storage)**。Row Level Security（RLS）は**RBAC導入時に有効化**。  
- **ADR-004** 可視化：**Recharts**（軽量）＋一部**ECharts**。  
- **ADR-005** デプロイ：**Vercel**（Edge/ISR）＋バッチは**サーバレスCron**（Supabase/Cloud Functions/GitHub Actions Scheduled）。  
- **ADR-006** 外部データ：公開Web API/RSS/オープンデータのみ（日4回）。  
- **ADR-007** エクスポート：CSV/Excel（サーバ生成、監査ログ付与）。  
- **ADR-008** テスト戦略：**TDD（Red→Green→Refactor）**、テストピラミッド準拠。

# システム構成（論理）
- **Web App (Next.js)**：/dashboard, /sales, /export, /auth  
- **API**：Next.js API Routes or Edge Functions（データ取得/集計/エクスポート）  
- **DB (Postgres)**：業績/外部データ/監査/ユーザー/ロール  
- **ETL**：スケジュール（06:00/12:00/18:00/22:00 JST）→Fetch→正規化→Upsert→集計更新→通知（E-mail）  
- **ストレージ**：エクスポートファイル/生成画像の一時保存  
- **監視/ログ**：アプリログ、バッチ成功/失敗ログ、監査ログ（DL/表示/入力）

# データモデル（概要）
- **sales**（税抜）：`date, store_id, department, product_category, revenue_ex_tax, footfall, transactions, discounts, tax`  
- **dim_store / dim_department / dim_date**  
- **ext_market_index / ext_stock_price / ext_fx_rate / ext_weather_daily / ext_events / ext_inbound / ext_stem_news`**  
- **audit_log**：`actor_id, action, target, at, ip, ua, meta`

# RBAC方針
- **Phase 0（初期）**：全ユーザー=全店舗閲覧/入力可（社内限定）。  
- **Phase 1**：RLSで**store_id**/役割で制限。  
- **Phase 2**：テナント/エリアRLS＋機能（閲覧/編集/エクスポート）粒度のABAC追加。

# CI/CD & GitHub運用
- **ブランチ**：`main`（保護） / `develop`（統合） / feature-*  
- **PRゲート（必須）**：`lint` / `unit` / `integration` / `e2e` / `build` / `coverage (lines≥80%, critical≥95%)`  
- **禁止**：`main`直コミット  
- **進行ログ**：`docs/DEVELOPMENT_PROGRESS.md` をPR毎・完了毎に更新（Who/When/What規約に準拠）

# テスト戦略（TDD）
- **目標配分**：Unit 70–80% / Integration 15–25% / E2E 5–10%  
- **E2E要件**：p95応答 ≤ 1500ms、retry=2、失敗時 trace/screenshot  
- **カバレッジ**：Lines ≥ 80%、Critical Paths ≥ 95%  
- **代表テスト（例）**  
  - 売上入力API：税抜/端数/NULL/重複日付  
  - 集計：曜日・天候別、イベント有無の差分  
  - エクスポート：範囲/フィルタ/監査記録  
  - 認証：マジックリンク、有効期限、再利用防止

# MCP/ツールガイド
| ツール | 主用途 | 権限/注意 |
|---|---|---|
| **github** | issue/branch/PR/commit/コメント、ドラフトPR起票 | `main`保護、Secrets使用、破壊操作禁止 |
| **filesystem** | `docs/`, `e2e/`, `assets/mockups/` 生成・更新 | ルート削除不可、LFS推奨（画像） |
| **playwright-mcp** | `e2e/` 実行（trace/screenshot） | 高頻度実行禁止 |
| **Context7** | PRD/決定/用語のインデックス化 | PII投入禁止 |
| **serena** | `lint/test/build/perf/index` パイプライン | 破壊的操作は**dry-run→確認→実行** |
| **supabase** | `test_*` スキーマ、seed/rollback、storage | 本番スキーマdrop禁止 |

# セキュリティ/運用
- **Auth**：メールマジックリンク、MFA（後続）  
- **通信**：TLS1.2+、HSTS  
- **秘密管理**：GitHub Secrets/Env、ローテーション  
- **監査**：ログイン/閲覧/出力/入力の記録  
- **バックアップ**：DB日次、保存30日（初期）  
- **アラート**：ETL失敗/闾値超過をE-mail通知

# アセット/画像ポリシー
- 画像生成物は `assets/mockups/` に保存、**Git LFS** 推奨  
- 権利配慮：実在人物/商標を含む描画は不可、社内利用でも出典/ライセンス明記  
- 参照：[ImageGen_Prompts.md](./ImageGen_Prompts.md)

# 変更管理
- PRテンプレ：目的/変更概要/関連Issue/テスト結果/スクショ/次アクション  
- リリースタグ：`vX.Y.Z`、CHANGELOG自動生成（serena task）

# 参照
- [PRD.md](./PRD.md) / [Tasks.md](./Tasks.md) / [ImageGen_Prompts.md](./ImageGen_Prompts.md)