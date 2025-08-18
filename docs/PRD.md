<!-- filename: PRD.md -->
---
title: 経営戦略ダッシュボード & 売上集計システム（社内向け）
version: 0.1.0
date: 2025-08-18
owner: TBD
reviewers: TBD
status: Draft
tags: [dashboard, analytics, sales, internal, RBAC-later]
github_url: https://github.com/kozuki1126/business-strategy-dashboard
---

# 概要
株価・為替・天候・近隣イベント・インバウンド統計・STEMニュース等の外部指標と、各営業部署/店舗からの売上・客数などの業績データを単一の**経営戦略ダッシュボード**で可視化し、**売上報告ワークフロー（当面はWeb入力）**と**分析/エクスポート**を提供する社内向けWebアプリ。初期は**全ユーザーがフル機能**を利用、のちに**権限(RBAC)**を導入。

## 背景/目的/KGI・KPI
- **KGI**：管理業務時間を**50%削減**（現状比）。
- **主要KPI（例）**
  - ダッシュボード日次利用率：≥ 70%
  - 売上報告SLA（当日24:00までの提出率）：≥ 95%
  - 手作業集計時間の短縮率：≥ 50%
  - データ更新SLA：日4回の更新完了率 ≥ 99%
  - エラー検知から通知まで：≤ 5分（E-mail）

## ユーザー/対象範囲
- 対象：**社内利用のみ**、約**10店舗**、本社/エリアMgr/店長/スタッフ/分析担当（初期は権限制御なし＝全機能可）。
- 提供形態：**インストール不要／URL + ログイン**（メールマジックリンク）。

## スコープ（Must/Should）
- **Must**
  - ダッシュボード（株価, 為替, 天候, 近隣イベント, インバウンド, STEMニュース, 売上/客数）
  - 売上Web入力フォーム（税抜で管理）
  - データ更新：**JST 06:00 / 12:00 / 18:00 / 22:00** の1日4回一括更新（公開Web情報ベース）
  - 分析：前日/前年比/曜日別・**天候/イベント有無**との比較、簡易相関ヒートマップ
  - エクスポート：**CSV/Excel**（許可）
  - 通知：更新/失敗を**E-mail**通知
  - 監査ログ（最小限：ログイン/出力/入力）
- **Should**
  - 店舗地図/近隣イベントの半径**5km**可視化
  - 指数ウォッチ：**TOPIX/日経225/（銘柄）7203/6758/9984**
  - 為替ペア：**USD/JPY, EUR/JPY, CNY/JPY**
  - インバウンド：全国/都道府県の**月次**（公開統計）
  - STEMニュース：日本語中心（AI/半導体/ロボ/バイオ）
- **Could（後続）**
  - **RBAC**（本部/エリア/店舗/部門粒度）
  - SSO（Azure AD/Google/Okta）
  - 予測/異常検知（需要/売上の時系列予測）
- **Won't（当面）**
  - 有償データ契約、リアルタイムティッカー、モバイルアプリ（ネイティブ）

## 受入基準（ATDD/BDD, Given-When-Then）
- **A. ダッシュボード描画**
  - **Given** 権限のある社内ユーザー（初期は全員）  
  - **When** 期間=当月/店舗=任意を選択  
  - **Then** 主要指標が **p95 ≤ 1500ms**、初回レンダリング **≤ 3.0s** で表示
- **B. データ更新（バッチ）**
  - **Given** 定期ジョブ（06:00/12:00/18:00/22:00 JST）  
  - **When** 更新完了  
  - **Then** ダッシュボードに **+10分以内** に反映、失敗時は自動リトライ（3回）＆**E-mail通知**
- **C. 売上入力**
  - **Given** 店舗担当が当日分を入力（税抜）  
  - **When** 保存  
  - **Then** 即時に店舗/全社集計へ反映、履歴/監査証跡が残る
- **D. エクスポート**
  - **Given** ログインユーザー  
  - **When** 期間/店舗を指定してCSV/Excel出力  
  - **Then** 生成が **p95 ≤ 5s**、監査ログに記録
- **E. 認証**
  - **Given** 登録済みメール  
  - **When** マジックリンクでログイン  
  - **Then** セッションが開始、TLSで保護、無操作**30分**で失効

## データ/スキーマ（初期）
- **売上**：`id, date, store_id, department, product_category, revenue_ex_tax, footfall, transactions, discounts, tax, notes, created_by, created_at, updated_at`
- **マスタ**：`store (id, name, address, lat, lng, area)`, `department`, `user`, `role`（将来RBAC用）
- **外部**：`market_index`, `stock_price`, `fx_rate`, `weather_daily`, `events_local`, `inbound_monthly`, `stem_news`
- **保持/削除**：監査ログ5年、業績/外部統計は原則永続（法令更新に応じ見直し）

## 非機能/SLO
- 可用性：**99.5%** 月次  
- 性能：API p95 ≤ 1000ms、ダッシュボード初回 ≤ 3.0s  
- 同時接続：目安100ユーザー  
- アクセシビリティ：**WCAG AA** 準拠を目標  
- セキュリティ：TLS1.2+、監査ログ、最小権限、秘密情報はSecrets/Envにて管理  
- データ所在：**国内優先（仮定）**／未確定の場合はTBD（リスク：法令/社内規定影響）

## 外部インターフェース
- 公開Web情報スクレイプ/Fetch（ニュースRSS/API、為替/株価公開API、気象公開API 等）※利用規約を順守
- E-mail通知（バッチ完了/失敗）

## マイルストーン（社内）
- **Alpha**：フル機能（権限制御なし）/売上入力/ダッシュボード/日4回バッチ/CSV出力  
- **Beta**：RBAC導入/SSO検討/予測のPoC  
- **GA(Internal)**：安定運用/監査・レポート

## 相互参照
- 技術詳細: [Rules_Architecture.md](./Rules_Architecture.md)  
- タスク: [Tasks.md](./Tasks.md)  
- 画像プロンプト: [ImageGen_Prompts.md](./ImageGen_Prompts.md)  
- 進捗ログ: `docs/DEVELOPMENT_PROGRESS.md`（URL: **https://github.com/kozuki1126/business-strategy-dashboard/blob/main/docs/DEVELOPMENT_PROGRESS.md**）