<!-- filename: ImageGen_Prompts.md -->
---
title: 画像生成プロンプト集（経営戦略ダッシュボード）
version: 0.2.0
date: 2025-08-26
owner: Development Team
reviewers: Claude Assistant
status: Active - PostGA Phase
tags: [mock, hero, dashboard, OG, business, ui-design, brand-guide]
github_url: https://github.com/kozuki1126/business-strategy-dashboard
progress_url: https://github.com/kozuki1126/business-strategy-dashboard/blob/main/docs/DEVELOPMENT_PROGRESS.md
---

# Usage
- 目的：ダッシュボードの**UIモック/キービジュアル/OG画像**などを**ChatGPT画像生成**で迅速に作成。  
- 注意：**実在人物/商標/他社ロゴの描画は禁止**。社内利用でも権利表記・出典明記。透かし不要。  
- 保存先：`assets/mockups/`（Git LFS 推奨）、命名例：`YYYYMMDD_title_v001.png`
- 関連タスク：**#IMG001**（UIモックアップ生成）・**#IMG002**（ブランドガイド適用）

# Global Defaults
- **Style**：一般的なビジネスデザイン、ミニマル、情報密度は中程度、十分な余白、角丸8–12px、微弱なシャドウ  
- **Palette**：`{{brand_colors}}`（未定なら中立：ブルー/グレー基調）  
- **Typography**：サンセリフ（Noto Sans / Inter想定）  
- **Aspect**：既定は **16:9**（他：1:1, 4:5 も可）  
- **Output**：PNG / 高解像度 / 背景透過は用途に応じ指定  
- **Accessibility**：コントラスト **WCAG AA** 目標

# Variables
`{{product}}`, `{{goal}}`, `{{kpi}}`, `{{brand_colors}}`, `{{subject}}`, `{{ui_state}}`, `{{style_refs}}`, `{{palette}}`, `{{aspect}}`, `{{copy.headline}}`, `{{copy.sub}}`, `{{cta}}`, `{{slug}}`, `{{feature}}`, `{{components}}`, `{{resolution}}`

# Templates

## 1) Web Hero Mock
```

# ChatGPT Image Prompt — Web Hero Mock

Goal: {{product}} のLPヒーロー。目的: {{goal}}（KPI: {{kpi}}）
Content: ロゴ/ブランド色={{brand\_colors}}、主役={{subject}}、UI要素={{ui\_state}}
Style: 一般的なビジネスデザイン、ミニマル、余白広め、角丸8–12px、シャドウ最小限
Composition: 視線誘導=Z型、焦点=中央1/3、CTA側に余白広め
Lighting: 柔らかい拡散光、反射弱め、影浅め
Palette: {{palette}}、高コントラスト（WCAG AA）
Aspect: {{aspect}}（例 16:9 / 4:5 / 1:1）
Text: 見出し="{{copy.headline}}" / サブ="{{copy.sub}}" / CTA="{{cta}}"
Output: PNG, 高解像度, 余白確保, 背景透過=false
Negatives: 実在ブランド/人物の暗示、過度なテクスチャ、読みにくい色
SaveTo: assets/mockups/{{slug}}_hero_{{aspect}}.png

```

## 2) Dashboard UI Mock
```

# ChatGPT Image Prompt — Dashboard UI Mock

Goal: 経営戦略ダッシュボードのトップ画面モック
Modules: KPIカード（売上/客数/客単価）、グラフ（売上推移、為替USDJPY、天候・イベント有無比較）、ニュース/インバウンド統計
Layout: ヘッダー、左ナビ（ダッシュボード/売上入力/エクスポート/アナリティクス/監査ログ）、メイングリッド（2–3カラム）
Style: 一般的なビジネス、情報密度中、余白十分、角丸8–12px
Widgets: フィルタ（期間/店舗）、ローディング/エンプティ状態も1枚
Features: RBAC対応・権限制御UI、パフォーマンス最適化済み表示、レスポンシブデザイン
Aspect: 16:9、解像度 1920x1080
Palette: {{brand\_colors}}
Text: 見出し="経営戦略ダッシュボード"、注釈なし
Output: PNG, 高解像度
SaveTo: assets/mockups/dashboard\_top\_v001.png

```

## 3) App UI Mock（State Compare）
```

# ChatGPT Image Prompt — App UI Mock (State Compare)

Goal: 売上入力の Before/After UI 比較
Frames: 2面（Before：未入力、After：保存成功トースト表示）
Style: 余白広め、角丸8–12px、影は最小限、フォームは税抜入力
Fields: 必須項目=date, store\_id, department, product\_category, revenue\_ex\_tax, footfall, transactions
Features: リアルタイムバリデーション・エラー表示、監査ログ記録UI、権限制御対応
Palette: {{brand\_colors}}、文字色はAA準拠
Aspect: 16:9、解像度 1920x1080
Output: PNG
SaveTo: assets/mockups/sales\_form\_state\_compare.png

```

## 4) Analytics & Export Mock
```

# ChatGPT Image Prompt — Analytics Dashboard Mock

Goal: 相関分析・エクスポート機能のUI表示
Features: 相関係数ヒートマップ（曜日×天候）、時系列比較チャート、エクスポート設定パネル
Layout: 分析フィルタ（期間選択・店舗・部門）、相関分析結果表示、CSV/Excel出力オプション
Performance: P95≤5s SLA表示、処理時間監視、レート制限UI（5回/時間）
Style: データ可視化重視、チャート・グラフ中心、情報密度高め
Palette: {{brand\_colors}}、データ可視化配色
Aspect: 16:9、解像度 1920x1080
Output: PNG
SaveTo: assets/mockups/analytics\_export\_v001.png

```

## 5) OG/Twitterカード
```

# ChatGPT Image Prompt — OG Image

Goal: 社内ダッシュボードの共有用OG画像
Style: ミニマル、ビジネス、ロゴスペース確保、情報は少なめ
Elements: タイトル帯、簡易KPIカード3つのモック
Features: エンタープライズ級品質表示、SLO達成バッジ、パフォーマンス指標
Aspect: 1200x630 (16:9)
Palette: {{brand\_colors}}
Text: 見出し="経営戦略ダッシュボード" / サブ="外部指標 × 売上で意思決定を加速"
Output: PNG
SaveTo: assets/mockups/og\_internal\_dashboard.png

```

## 6) アイコン/イラスト
```

# ChatGPT Image Prompt — Business Icon Set

Goal: ダッシュボードで用いるアイコン（株価/為替/天候/イベント/インバウンド/ニュース/売上/監査ログ/RBAC）
Style: フラット、線幅一定、角丸、ビジネス向け、解像度 512x512 x9種
Features: 権限制御アイコン、監査ログアイコン、分析アイコン追加
Palette: {{brand\_colors}}（2–3色）
Output: PNG（透過）
SaveTo: assets/mockups/iconset\_v001\_{{slug}}.png

```

# Examples（本プロジェクトに即した実装例）

## 1) **ダッシュボードHero（Enterprise Ready版）**  
```

Goal: 経営戦略ダッシュボードのLPヒーロー。目的: 社内展開の認知向上（KPI: 週次利用率 70%）
Content: ロゴ/ブランド色=#0EA5E9,#0F172A,#F8FAFC、主役=KPIカード群、UI要素=フィルタ（期間/店舗）
Features: 99.7%可用性バッジ、P95≤1350ms表示、RBAC対応UI、Enterprise Ready表示
Style: 一般的ビジネス、ミニマル、品質感重視
Palette: ブルー/スレート/ホワイト
Aspect: 16:9
Text: 見出し="意思決定を加速する" / サブ="外部指標×売上を1つに・エンタープライズ級品質" / CTA="ログイン"
SaveTo: assets/mockups/20250826\_hero\_enterprise\_v001.png

```

## 2) **Dashboard Top UI（Full Features版）**  
```

Goal: トップ画面モック（全機能実装済み版）
Modules: KPIカード、売上推移、USDJPY/日経225、天候・イベント有無比較、STEMニュース、相関分析、エクスポート機能
Navigation: ダッシュボード/売上入力/エクスポート/アナリティクス/監査ログ
Layout: 左ナビ＋2–3カラムグリッド、検索/フィルタ上部、RBAC権限制御UI
Features: パフォーマンス監視表示、SLO達成状況、リアルタイム更新インジケーター
Aspect: 1920x1080
Palette: #0EA5E9,#0F172A,#F8FAFC
SaveTo: assets/mockups/20250826\_dashboard\_full\_features\_v001.png

```

## 3) **売上フォーム（RBAC対応版）**  
```

Goal: 税抜売上入力のBefore/After（権限制御対応版）
Frames: 2面（未入力/保存成功）
Features: RBAC権限表示、店舗アクセス制御UI、監査ログ記録表示、リアルタイムバリデーション
Fields: 必須項目表示、税抜計算UI、客単価自動算出表示
Aspect: 1920x1080
Palette: #0EA5E9,#0F172A,#F8FAFC
SaveTo: assets/mockups/20250826\_sales\_form\_rbac\_compare.png

```

## 4) **Performance & Analytics（SLO達成版）**
```

Goal: パフォーマンス監視・分析機能UI
Features: SLO達成状況（99.7%可用性・P95≤1350ms・エラー率0.3%）、相関分析ヒートマップ、負荷テスト結果表示
Charts: 時系列パフォーマンス、曜日×天候相関、応答時間分布、スループット監視
Layout: メトリクス・ダッシュボード、リアルタイム監視、アラート設定UI
Palette: #0EA5E9,#0F172A,#F8FAFC
Aspect: 1920x1080
SaveTo: assets/mockups/20250826\_performance\_analytics\_slo.png

```

# Batch & Variants 指示
- **色違い**：`{{brand_colors}}` を3パターン（ブルー系/グリーン系/モノトーン）  
- **レイアウト違い**：2カラム/3カラム/カード密度高め  
- **光源違い**：拡散光/側光/逆光弱め  
- **比率違い**：16:9 / 1:1 / 4:5
- **機能別バリエーション**：基本版/RBAC対応版/Enterprise版

# 実装済み機能との対応

## ✅ **Core Features（実装済み）**
- **ダッシュボード**: リアルタイム可視化・外部指標統合・レスポンシブ（Task #006完了）
- **売上入力**: 税抜管理・バリデーション・監査証跡（Task #007完了）
- **分析機能**: 相関分析・比較分析・ヒートマップ（Task #011完了）
- **エクスポート**: CSV/Excel・レート制限・監査記録（Task #010完了）
- **監査ログ**: 包括的操作記録・コンプライアンス対応（Task #012完了）

## ✅ **Quality & Performance（実装済み）**
- **RBAC**: 4ロール階層・店舗アクセス制御・Row Level Security（Task #013完了）
- **パフォーマンス**: SLO達成・99.7%可用性・P95≤1350ms（Task #014完了）
- **E2Eテスト**: 包括的テストスイート・CI統合（Task #015完了）
- **認証**: メールマジックリンク・セッション管理（Task #005完了）
- **ドキュメント**: 完全文書化・相互参照・整合性確保（Task #016完了）

# 相互参照・関連ドキュメント

- **📋 プロダクト要求仕様**: [PRD.md](./PRD.md) - 要求仕様・KPI・受入基準・ビジネス成果
- **🏗️ 技術アーキテクチャ**: [Rules_Architecture.md](./Rules_Architecture.md) - アーキテクチャルール・技術決定記録・ADR
- **📊 開発タスク・進捗**: [Tasks.md](./Tasks.md) - バックログ・進捗・マイルストーン・完了状況
- **📝 実装履歴**: [DEVELOPMENT_PROGRESS.md](./DEVELOPMENT_PROGRESS.md) - 完全実装履歴・技術詳細・性能結果
- **🔗 GitHub Repository**: https://github.com/kozuki1126/business-strategy-dashboard
- **📈 Live Progress Tracking**: https://github.com/kozuki1126/business-strategy-dashboard/blob/main/docs/DEVELOPMENT_PROGRESS.md

---

**画像生成品質**: Enterprise Ready・WCAG AA準拠・ブランド統一・高品質モックアップ  
**プロジェクト進捗率**: 94% (16/17タスク完了) → 現在: PostGA UIデザイン・画像生成整備フェーズ進行準備完了  
**最終更新**: 2025-08-26 - Task #016 ドキュメント整備実装完了（Claude Assistant）