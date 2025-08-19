# Business Strategy Dashboard

経営戦略ダッシュボード & 売上集計システム（社内向け）

## 概要

株価・為替・天候・近隣イベント・インバウンド統計・STEMニュース等の外部指標と、各営業部署/店舗からの売上・客数などの業績データを単一の**経営戦略ダッシュボード**で可視化し、**売上報告ワークフロー（当面はWeb入力）**と**分析/エクスポート**を提供する社内向けWebアプリ。

## ドキュメント

- [PRD.md](./docs/PRD.md) - プロダクト要求仕様書
- [Rules_Architecture.md](./docs/Rules_Architecture.md) - アーキテクチャルール・ADR
- [Tasks.md](./docs/Tasks.md) - タスクプラン・バックログ
- [ImageGen_Prompts.md](./docs/ImageGen_Prompts.md) - UI モック画像生成プロンプト集
- [DEVELOPMENT_PROGRESS.md](./docs/DEVELOPMENT_PROGRESS.md) - 詳細進捗ログ

## 技術スタック

- **Frontend**: Next.js (App Router) + TypeScript + Tailwind CSS
- **Backend**: Supabase (Postgres, Auth, Storage)
- **Database**: PostgreSQL with enhanced constraints and indexes
- **Deployment**: Vercel
- **Charts**: Recharts + ECharts
- **Auth**: Email Magic Link
- **Testing**: Jest + Playwright
- **CI/CD**: GitHub Actions (6 quality gates)

## データベース構成

### 主要テーブル

#### マスタデータ
- `dim_store` - 店舗マスタ（位置情報含む）
- `dim_department` - 部門マスタ

#### 売上データ
- `sales` - 売上実績（税抜管理・監査証跡付き）

#### 外部データ
- `ext_market_index` - 市場指数（TOPIX、日経225、個別銘柄）
- `ext_fx_rate` - 為替レート（USD/JPY、EUR/JPY、CNY/JPY等）
- `ext_weather_daily` - 日次天候データ
- `ext_events` - 近隣イベント情報（5km圏内）
- `ext_inbound` - インバウンド統計（月次・都道府県別）
- `ext_stem_news` - STEM関連ニュース

#### システム
- `audit_log` - 監査ログ（全操作記録）

### データベース機能

#### 制約・バリデーション
- 売上額の正値制約
- 客数・取引数の整合性チェック
- 座標範囲バリデーション
- 湿度・気温の妥当性チェック

#### パフォーマンス最適化
- 複合インデックス（日付・店舗・部門）
- 全文検索インデックス（イベント・ニュース）
- クエリ統計モニタリング

#### ユーティリティ関数
- `calculate_distance()` - 座標間距離計算
- `get_nearby_events()` - 近隣イベント検索
- パフォーマンス監視ビュー

## セットアップ

### 前提条件
- Node.js 18+
- Supabase プロジェクト
- Git

### 環境構築

1. **リポジトリクローン**
```bash
git clone https://github.com/kozuki1126/business-strategy-dashboard.git
cd business-strategy-dashboard
```

2. **依存関係インストール**
```bash
npm install
```

3. **環境変数設定**
```bash
cp .env.local.example .env.local
# Supabase URLとAPIキーを設定
```

4. **データベースセットアップ**
```bash
# マイグレーション実行
npm run db:migrate

# シードデータ投入
npm run db:seed
```

5. **開発サーバー起動**
```bash
npm run dev
```

### テスト実行

```bash
# 単体テスト
npm run test

# 統合テスト
npm run test:integration

# E2Eテスト
npm run test:e2e

# カバレッジ
npm run test:coverage
```

## 開発フェーズ

### ✅ Inception (完了)
- リポジトリ・CI/CD基盤・Next.js環境構築
- データベーススキーマ・認証基盤構築

### 🚧 Alpha (進行中)
- フル機能（権限制御なし）
- 売上入力・ダッシュボード・日4回バッチ・CSV出力
- **現在の進捗**: 17% (3/18タスク完了)

### 🔒 Beta (予定)
- RBAC導入・SSO検討・予測のPoC
- 性能最適化・包括的テスト

### 📋 GA(Internal) (予定)
- 安定運用・監査・レポート
- デザインシステム・ドキュメント整備

## API エンドポイント

### 売上データAPI
```typescript
GET  /api/sales              // 売上データ取得
POST /api/sales              // 売上データ登録
GET  /api/sales/summary      // 店舗別集計
GET  /api/sales/export       // CSV/Excelエクスポート
```

### 外部データAPI
```typescript
GET /api/external/market     // 市場データ取得
GET /api/external/weather    // 天候データ取得
GET /api/external/events     // イベントデータ取得
GET /api/external/news       // STEMニュース取得
```

### 分析API
```typescript
GET /api/analytics/dashboard // ダッシュボードデータ
GET /api/analytics/correlation // 相関分析
GET /api/analytics/performance // 店舗比較分析
```

## データ更新スケジュール

- **売上データ**: リアルタイム入力
- **外部データ**: 日4回更新（06:00/12:00/18:00/22:00 JST）
- **市場データ**: 平日のみ更新
- **天候データ**: 毎日更新
- **イベント情報**: 週次更新

## セキュリティ・監査

### 認証
- Email Magic Link認証
- セッション管理（30分有効）
- 将来的にSSO対応予定

### 監査証跡
- 全操作の記録（ログイン・閲覧・入力・エクスポート）
- IPアドレス・ユーザーエージェント記録
- データ変更履歴追跡

### データ保護
- HTTPS通信必須
- 税抜売上で管理
- エクスポート時の監査ログ記録

## 貢献・開発ルール

### ブランチ戦略
- `main`: 本番デプロイ可能な状態
- `develop`: 開発統合ブランチ
- `feature/*`: 機能開発ブランチ

### CI/CDゲート（必須通過）
1. **lint**: ESLint + TypeScript型チェック
2. **unit**: Jest単体テスト
3. **integration**: DB接続テスト
4. **e2e**: Playwright E2Eテスト
5. **build**: Next.js本番ビルド
6. **coverage**: カバレッジ閾値チェック（80%以上）

### 開発フロー
1. Issue作成・アサイン
2. feature ブランチ作成
3. 実装・テスト
4. PR作成（全CIチェック通過必須）
5. レビュー・マージ
6. 進捗ログ更新

## トラブルシューティング

### よくある問題

#### データベース接続エラー
```bash
# 環境変数確認
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY

# 接続テスト
npm run test:db-connection
```

#### テスト失敗
```bash
# テストデータベースリセット
npm run test:db-reset

# 特定テストのみ実行
npm run test -- --testNamePattern="Database Schema"
```

#### パフォーマンス問題
```bash
# インデックス使用状況確認
npm run db:analyze

# 遅いクエリ確認
npm run db:slow-queries
```

## ライセンス

MIT License

## サポート・連絡先

- **Issues**: [GitHub Issues](https://github.com/kozuki1126/business-strategy-dashboard/issues)
- **進捗確認**: [Development Progress](./docs/DEVELOPMENT_PROGRESS.md)
- **アーキテクチャ**: [Rules & Architecture](./docs/Rules_Architecture.md)
