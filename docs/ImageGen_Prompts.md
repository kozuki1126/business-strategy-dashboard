<!-- filename: ImageGen_Prompts.md -->
---
title: 画像生成プロンプト集（経営戦略ダッシュボード）
version: 0.1.0
date: 2025-08-18
owner: TBD
reviewers: TBD
status: Draft
tags: [mock, hero, dashboard, OG, business]
github_url: https://github.com/kozuki1126/business-strategy-dashboard
---

# Usage
- 目的：ダッシュボードの**UIモック/キービジュアル/OG画像**などを**ChatGPT画像生成**で迅速に作成。  
- 注意：**実在人物/商標/他社ロゴの描画は禁止**。社内利用でも権利表記・出典明記。透かし不要。  
- 保存先：`assets/mockups/`（Git LFS 推奨）、命名例：`YYYYMMDD_title_v001.png`

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
SaveTo: assets/mockups/{{slug}}*hero*{{aspect}}.png

```

## 2) Dashboard UI Mock
```

# ChatGPT Image Prompt — Dashboard UI Mock

Goal: 経営戦略ダッシュボードのトップ画面モック
Modules: KPIカード（売上/客数/客単価）、グラフ（売上推移、為替USDJPY、天候・イベント有無比較）、ニュース/インバウンド統計
Layout: ヘッダー、左ナビ（ダッシュボード/売上入力/エクスポート）、メイングリッド（2–3カラム）
Style: 一般的なビジネス、情報密度中、余白十分、角丸8–12px
Widgets: フィルタ（期間/店舗）、ローディング/エンプティ状態も1枚
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
Palette: {{brand\_colors}}、文字色はAA準拠
Details: 必須項目=date, store\_id, department, product\_category, revenue\_ex\_tax, footfall, transactions
Aspect: 16:9、解像度 1920x1080
Output: PNG
SaveTo: assets/mockups/sales\_form\_state\_compare.png

```

## 4) OG/Twitterカード
```

# ChatGPT Image Prompt — OG Image

Goal: 社内ダッシュボードの共有用OG画像
Style: ミニマル、ビジネス、ロゴスペース確保、情報は少なめ
Elements: タイトル帯、簡易KPIカード3つのモック
Aspect: 1200x630 (16:9)
Palette: {{brand\_colors}}
Text: 見出し="経営戦略ダッシュボード" / サブ="外部指標 × 売上で意思決定を加速"
Output: PNG
SaveTo: assets/mockups/og\_internal\_dashboard.png

```

## 5) アイコン/イラスト
```

# ChatGPT Image Prompt — Business Icon Set

Goal: ダッシュボードで用いるアイコン（株価/為替/天候/イベント/インバウンド/ニュース/売上）
Style: フラット、線幅一定、角丸、ビジネス向け、解像度 512x512 x7種
Palette: {{brand\_colors}}（2–3色）
Output: PNG（透過）
SaveTo: assets/mockups/iconset\_v001\_{{slug}}.png

```

# Examples（本プロジェクトに即した3例）
1) **ダッシュボードHero**  
```

Goal: 経営戦略ダッシュボードのLPヒーロー。目的: 社内展開の認知向上（KPI: 週次利用率 70%）
Content: ロゴ/ブランド色=#0EA5E9,#0F172A,#F8FAFC、主役=KPIカード群、UI要素=フィルタ（期間/店舗）
Style: 一般的ビジネス、ミニマル
Palette: ブルー/スレート/ホワイト
Aspect: 16:9
Text: 見出し="意思決定を加速する" / サブ="外部指標×売上を1つに" / CTA="ログイン"
SaveTo: assets/mockups/20250818\_hero\_v001.png

```

2) **Dashboard Top UI**  
```

Goal: トップ画面モック
Modules: KPIカード、売上推移、USDJPY/日経225、天候・イベント有無比較、STEMニュース
Layout: 左ナビ＋2–3カラムグリッド、検索/フィルタ上部
Aspect: 1920x1080
Palette: #0EA5E9,#0F172A,#F8FAFC
SaveTo: assets/mockups/20250818\_dashboard\_top\_v001.png

```

3) **売上フォーム（State Compare）**  
```

Goal: 税抜売上入力のBefore/After
Frames: 2面（未入力/保存成功）
Aspect: 1920x1080
Palette: #0EA5E9,#0F172A,#F8FAFC
SaveTo: assets/mockups/20250818\_sales\_form\_compare.png

```

# Batch & Variants 指示
- **色違い**：`{{brand_colors}}` を3パターン（ブルー系/グリーン系/モノトーン）  
- **レイアウト違い**：2カラム/3カラム/カード密度高め  
- **光源違い**：拡散光/側光/逆光弱め  
- **比率違い**：16:9 / 1:1 / 4:5

# 参照
- [PRD.md](./PRD.md) / [Rules_Architecture.md](./Rules_Architecture.md) / [Tasks.md](./Tasks.md)