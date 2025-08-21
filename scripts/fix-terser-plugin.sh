#!/bin/bash

# TerserPlugin問題完全解決スクリプト
# このスクリプトは、Next.js 15でのTerserPlugin関連の問題を完全に解決します

echo "🚨 TerserPlugin問題解決スクリプト開始..."

# 1. Node.js環境確認
echo "📋 Node.js環境確認..."
node --version
npm --version

# 2. キャッシュクリア
echo "🧹 Next.js & npm キャッシュクリア..."
rm -rf .next
rm -rf node_modules
rm -rf package-lock.json
npm cache clean --force

# 3. 依存関係の再インストール
echo "📦 依存関係の完全再インストール..."
npm install

# 4. TypeScript型チェック
echo "🔍 TypeScript型チェック..."
npm run lint:types

# 5. ビルドテスト
echo "🏗️ ビルドテスト実行..."
npm run build

# 6. 結果確認
if [ $? -eq 0 ]; then
    echo "✅ ビルド成功！TerserPlugin問題は解決されました。"
    echo "📊 バンドルサイズ確認..."
    ls -la .next/static/chunks/ | head -10
else
    echo "❌ ビルド失敗。詳細なエラーログを確認してください。"
    echo "🔧 追加のトラブルシューティング手順："
    echo "  1. package.json の依存関係を確認"
    echo "  2. next.config.mjs の設定を確認"
    echo "  3. Node.js バージョンが 20+ であることを確認"
    echo "  4. npm update を実行"
fi

echo "🎯 スクリプト完了"
