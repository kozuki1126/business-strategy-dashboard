<!-- filename: Tasks.md -->
---
title: Tasks & Plan（経営戦略ダッシュボード）
version: 0.1.8
date: 2025-08-20
owner: Development Team
status: Active
github_url: https://github.com/kozuki1126/business-strategy-dashboard
progress_url: https://github.com/kozuki1126/business-strategy-dashboard/blob/main/docs/DEVELOPMENT_PROGRESS.md
---

# 進行ルール
- 着手順序は **#001 から**。1タスク1成果物。完了定義＝**受入(GWT)満たす**＋`docs/DEVELOPMENT_PROGRESS.md`更新。
- フェーズ：**Inception → Alpha → Beta → GA(Internal) → PostGA**
- 完了タスクのLogには `docs/DEVELOPMENT_PROGRESS.md` の該当セクションを参照

# バックログ

| ID | Title | Desc | Owner | Status | Priority | DependsOn | Deliverables | Due | Acceptance (GWT) | Links (PRD/Rules/ImageGen) | GithubIssueURL | Log |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| #001 | リポジトリ初期化 | monorepo構成とdocs雛形 | Claude Assistant | ✅ Completed | High | - | repo, `docs/*` | 2025-08-18 | Given repo作成 When push Then CIが動作 | PRD/Rules | TBD | [2025-08-18 14:30](https://github.com/kozuki1126/business-strategy-dashboard/blob/main/docs/DEVELOPMENT_PROGRESS.md#completed-001---リポジトリ初期化) |
| #002 | CI/PRゲート設定 | lint/unit/integration/e2e/build/coverage | Claude Assistant | ✅ Completed | High | #001 | GH Actions, Next.js基盤, テスト環境 | 2025-08-18 | Given PR When CI Then 6チェック通過 | Rules | TBD | [2025-08-18 15:00](https://github.com/kozuki1126/business-strategy-dashboard/blob/main/docs/DEVELOPMENT_PROGRESS.md#completed-002---ciprゲート設定) |
| #003 | Supabase初期化 | Postgres DB/Auth/Storage/環境変数設定 | Claude Assistant | ✅ Completed | High | #001,#002 | Supabase proj, DB接続確認, Auth設定 | 2025-08-19 | Given .env.local設定 When `npm run db:migrate` Then 接続成功＋seed実行OK | PRD/Rules | TBD | [2025-08-19 14:00](https://github.com/kozuki1126/business-strategy-dashboard/blob/main/docs/DEVELOPMENT_PROGRESS.md#completed-003---supabase初期化) |
| #004 | データベーススキーマ作成 | sales/dim_store/ext_**/audit_log テーブル設計・実装 | Claude Assistant | ✅ Completed | High | #003 | migration files, seed data, tests | 2025-08-19 | Given migration実行 When seed投入 Then 全テーブル作成＋基本データ確認 | PRD/Rules | TBD | [2025-08-19 16:45](https://github.com/kozuki1126/business-strategy-dashboard/blob/main/docs/DEVELOPMENT_PROGRESS.md#completed-004---データベーススキーマ作成) |
| #005 | 認証（メールマジックリンク） | Supabase Auth + Magic Link実装 | Claude Assistant | ✅ Completed | High | #003,#004 | /auth pages, auth middleware | 2025-08-19 | Given 登録メール When magic link Then ログイン成功＋セッション30分有効 | PRD/Rules | TBD | [2025-08-19 16:57](https://github.com/kozuki1126/business-strategy-dashboard/blob/main/docs/DEVELOPMENT_PROGRESS.md#completed-005---認証メールマジックリンク実装) |
| #006 | ダッシュボードUI（α版） | 外部指標・売上表示（静的モック→動的） | Claude Assistant | ✅ Completed | High | #004,#005 | /dashboard page, charts | 2025-08-19 | Given 期間・店舗選択 When 表示 Then p95≤1500ms＋全指標レンダリング | PRD/ImageGen | TBD | [2025-08-19 17:30](https://github.com/kozuki1126/business-strategy-dashboard/blob/main/docs/DEVELOPMENT_PROGRESS.md#completed-006---ダッシュボードuiα版実装) |
| #007 | 売上入力フォーム | 税抜入力・バリデーション・履歴・監査証跡 | Claude Assistant | ✅ Completed | High | #004,#005 | /sales page, form validation | 2025-08-19 | Given 店舗担当 When 売上入力・保存 Then 即時集計反映＋audit_log記録 | PRD | TBD | [2025-08-19 18:45](https://github.com/kozuki1126/business-strategy-dashboard/blob/main/docs/DEVELOPMENT_PROGRESS.md#completed-007---売上入力フォーム実装) |
| #008 | ETLスケジューラ | 外部API取得（06/12/18/22 JST）・データ正規化 | Claude Assistant | ✅ Completed | High | #003,#004 | cron jobs, API integration | 2025-08-19 | Given 定時 When バッチ実行 Then 10分以内にext_**テーブル更新完了 | PRD/Rules | TBD | [2025-08-19 22:45](https://github.com/kozuki1126/business-strategy-dashboard/blob/main/docs/DEVELOPMENT_PROGRESS.md#completed-008---etlスケジューラ実装) |
| #009 | E-mail通知システム | バッチ成功・失敗通知（Resend/SendGrid） | Claude Assistant | ✅ Completed | High | #008 | email service integration | 2025-08-20 | Given バッチ失敗 When 検知 Then 5分以内にアラートメール送信 | PRD/Rules | TBD | [2025-08-20 09:15](https://github.com/kozuki1126/business-strategy-dashboard/blob/main/docs/DEVELOPMENT_PROGRESS.md#completed-009---e-mail通知システム実装) |
| #010 | エクスポート機能 | CSV/Excel生成・ダウンロード・監査記録 | Claude Assistant | ✅ Completed | Medium | #004,#005 | /export API, file generation | 2025-08-20 | Given 期間・店舗指定 When Export実行 Then p95≤5s＋audit_log記録 | PRD | TBD | [2025-08-20 13:15](https://github.com/kozuki1126/business-strategy-dashboard/blob/main/docs/DEVELOPMENT_PROGRESS.md#completed-010---エクスポート機能実装) |
| #011 | 相関・比較分析 | 曜日・天候・イベント有無との売上相関 | Claude Assistant | ✅ Completed | Medium | #006,#008 | analytics components | 2025-08-20 | Given 分析期間指定 When 実行 Then 相関係数・ヒートマップ表示 | PRD | TBD | [2025-08-20 14:30](https://github.com/kozuki1126/business-strategy-dashboard/blob/main/docs/DEVELOPMENT_PROGRESS.md#completed-011---相関比較分析実装) |
| #012 | 監査ログ基盤 | 閲覧・操作・エクスポート記録システム | Claude Assistant | ✅ Completed | Medium | #004 | audit_log完全実装 | 2025-08-20 | Given 任意操作 When 実行 Then audit_log(actor/action/target/timestamp)記録 | Rules | TBD | [2025-08-20 18:30](https://github.com/kozuki1126/business-strategy-dashboard/blob/main/docs/DEVELOPMENT_PROGRESS.md#completed-012---監査ログ基盤実装) |
| #013 | RBAC設計（Phase1） | Row Level Security・ロール・権限制御 | Claude Assistant | ✅ Completed | Medium | #012 | RLS policies, role management | 2025-08-20 | Given ロール設定 When データアクセス Then 適切な制限動作確認 | PRD/Rules | TBD | [2025-08-20 19:15](https://github.com/kozuki1126/business-strategy-dashboard/blob/main/docs/DEVELOPMENT_PROGRESS.md#completed-013---rbac設計phase1実装) |
| #014 | 性能・p95最適化 | N+1解消・キャッシュ・ISR・CDN活用 | Claude Assistant | 🚧 In Progress | Medium | #006,#008 | performance audit報告 | TBD | Given 100CCU負荷 When 30分継続 Then SLO(99.5%可用性)達成 | Rules | TBD | ⏳ Next Task |
| #015 | E2Eテスト整備 | Playwright拡張・retry・失敗時trace | TBD | Todo | Medium | #002,#006 | comprehensive e2e suite | TBD | Given CI pipeline When e2e実行 Then 全シナリオpass・失敗時trace取得 | Rules | TBD | |
| #016 | ドキュメント整備 | PRD/Rules/Tasks更新・相互参照リンク | TBD | Todo | Low | All core features | v0.2 documentation | TBD | Given 文書更新 When レビュー Then 相互参照・整合性確認済み | All | TBD | |
| #IMG001 | UIモックアップ生成 | ImageGen_Prompts主要テンプレート実行 | TBD | Todo | High | #001 | 5template/15mockup images | TBD | Given prompts When 画像生成 Then 高品質mockup 3枚/template完成 | ImageGen | TBD | |
| #IMG002 | ブランドガイド適用 | 色彩・タイポグラフィ・アクセシビリティ | TBD | Todo | Medium | #IMG001 | brand-compliant designs | TBD | Given ブランド指針 When デザイン適用 Then WCAG AA準拠確認 | ImageGen/Rules | TBD | |

# マイルストーン

- **🏗️ Inception (完了済み)**: #001–#002 ✅ **完了** (2025-08-18)
  - リポジトリ・CI/CD基盤・Next.js環境構築
- **🚀 Alpha (完了済み)**: #003–#012 ✅ **完了** (10/10 完了)
  - ✅ #003 Supabase初期化（2025-08-19 完了）
  - ✅ #004 データベーススキーマ作成（2025-08-19 完了）
  - ✅ #005 認証（メールマジックリンク）実装（2025-08-19 完了）
  - ✅ #006 ダッシュボードUI（α版）実装（2025-08-19 完了）
  - ✅ #007 売上入力フォーム実装（2025-08-19 完了）
  - ✅ #008 ETLスケジューラ実装（2025-08-19 完了）
  - ✅ #009 E-mail通知システム実装（2025-08-20 完了）
  - ✅ #010 エクスポート機能実装（2025-08-20 完了）
  - ✅ #011 相関・比較分析実装（2025-08-20 完了）
  - ✅ #012 監査ログ基盤実装（2025-08-20 完了）
  - **主要成果物**: 完全ダッシュボード・認証・売上入力・ETLスケジューラ・通知システム・エクスポート機能・相関分析・監査ログ基盤・包括的テスト
- **🔒 Beta**: #013–#015 🚧 **2/3完了** 
  - ✅ #013 RBAC設計（Phase1）実装（2025-08-20 完了）
  - 🚧 #014 性能・p95最適化（現在進行中）
  - ⏳ #015 E2Eテスト整備（予定）
- **📋 GA(Internal)**: #016, #IMG001–#IMG002 (文書・デザイン整備)

# 次のアクション

**🎯 現在着手中**: #014 性能・p95最適化実装
- **優先度**: Medium
- **依存**: #006, #008 (完了済み)  
- **目標**: 100CCU負荷・99.5%可用性・p95応答時間改善
- **実装内容**:
  - N+1解消・キャッシュ・ISR・CDN活用
  - パフォーマンス監視・SLO達成・負荷テスト
  - メモリ最適化・クエリ最適化・レスポンス改善

**📊 受入基準**: Given 100CCU負荷 When 30分継続 Then SLO(99.5%可用性)達成

## 🚨 **重要**: Vercelデプロイメントエラー修正済み
- ✅ Next.js設定修正（next.config.mjs統一）
- ✅ 存在しないパッケージ削除（@bundle-analyzer/webpack-plugin）
- ✅ Next.js 15.5.0対応設定完了
- 📋 **次**: デプロイメント成功確認後、#014本格着手

# リスク・課題

- ⚠️ **有償API未契約** → 公開API仕様変更リスク（モニタリング・フェイルソフト実装で対応）
- ⚠️ **データ所在未確定** → コンプライアンス影響（**決定期限：Beta開始前**）
- ✅ **Vercelデプロイメントエラー** → 修正完了（Next.js設定統一）

# 決定ログ（要約）

- 日4回更新（06/12/18/22 JST）
- 通知はE-mail
- 売上は**税抜**で管理
- エクスポート機能は許可
- 初期は全ユーザー・全機能アクセス可
- Next.js 15.5.0 + next.config.mjs統一使用

# 進捗トラッキング

**現在の状況**:
- ✅ Inception完了 (2タスク完了)
- ✅ Alpha完了 (10タスク完了) 
- 🚧 Beta進行中 (2/3タスク完了)
- 📈 全体進度: 72% (13/18タスク完了)

**パフォーマンス状況**:
- 🚨 Vercelデプロイメント: 修正作業完了（#014前の重要課題）
- 🎯 次の重点: 性能最適化・SLO達成

詳細な進捗ログ: [DEVELOPMENT_PROGRESS.md](https://github.com/kozuki1126/business-strategy-dashboard/blob/main/docs/DEVELOPMENT_PROGRESS.md)

# 参照

- [PRD.md](./PRD.md) - プロダクト要求仕様
- [Rules_Architecture.md](./Rules_Architecture.md) - 技術アーキテクチャ・ADR
- [ImageGen_Prompts.md](./ImageGen_Prompts.md) - UIモックアップ生成プロンプト
- [DEVELOPMENT_PROGRESS.md](./DEVELOPMENT_PROGRESS.md) - 詳細進捗ログ