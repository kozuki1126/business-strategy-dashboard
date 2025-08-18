# Business Strategy Dashboard

経営戦略ダッシュボード & 売上集計システム（社内向け）

## 概要

株価・為替・天候・近隣イベント・インバウンド統計・STEMニュース等の外部指標と、各営業部署/店舗からの売上・客数などの業績データを単一の**経営戦略ダッシュボード**で可視化し、**売上報告ワークフロー（当面はWeb入力）**と**分析/エクスポート**を提供する社内向けWebアプリ。

## ドキュメント

- [PRD.md](./docs/PRD.md) - プロダクト要求仕様書
- [Rules_Architecture.md](./docs/Rules_Architecture.md) - アーキテクチャルール・ADR
- [Tasks.md](./docs/Tasks.md) - タスクプラン・バックログ
- [ImageGen_Prompts.md](./docs/ImageGen_Prompts.md) - UI モック画像生成プロンプト集

## 技術スタック

- **Frontend**: Next.js (App Router)
- **Backend**: Supabase (Postgres, Auth, Storage)
- **Deployment**: Vercel
- **Charts**: Recharts + ECharts
- **Auth**: Email Magic Link

## 開発フェーズ

- **Alpha**: フル機能（権限制御なし）/売上入力/ダッシュボード/日4回バッチ/CSV出力
- **Beta**: RBAC導入/SSO検討/予測のPoC
- **GA(Internal)**: 安定運用/監査・レポート

## ライセンス

MIT License
