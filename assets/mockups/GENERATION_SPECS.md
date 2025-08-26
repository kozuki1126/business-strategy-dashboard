# UI Mockup Generation Specifications

## Task #IMG001 Implementation Details

**Status**: Implementation Ready  
**Target**: 5 templates × 3 variations = **15 high-quality mockups**  
**Brand Colors**: #0EA5E9 (blue), #0F172A (dark slate), #F8FAFC (white)  
**Quality Standards**: Enterprise Ready, WCAG AA compliant, 1920×1080 resolution

---

## 🚀 **Template 1: Web Hero Mock (Enterprise Ready版)**

### **Variant 1.1: Enterprise Badge Focus** 
```
Prompt: Create a professional business dashboard landing page hero section. 
Enterprise-grade branding with performance badges prominently displayed.

Content:
- Brand colors: #0EA5E9 (primary blue), #0F172A (dark slate), #F8FAFC (white)
- Hero text: "意思決定を加速する" (main headline)
- Subheading: "外部指標×売上を1つに・エンタープライズ級品質"
- Performance badges: "99.7% Uptime", "P95 ≤ 1350ms", "Enterprise Ready"
- CTA button: "ログイン" (blue button, prominent)

Layout:
- Z-pattern visual flow, hero text left-aligned
- Dashboard preview mockup on right side showing KPI cards
- Performance badges arranged horizontally below hero text
- Wide margins for professional look

Output: 1920×1080, PNG format
SaveTo: assets/mockups/hero/20250826_hero_enterprise_v001.png
```

### **Variant 1.2: RBAC Features Focus**
```
Prompt: Professional dashboard landing hero highlighting role-based access control.
Security and user management features prominently displayed.

Content:
- Same brand colors and base layout as 1.1
- Hero text: "セキュアな意思決定基盤"
- Subheading: "4段階権限制御・監査ログ・コンプライアンス対応"
- Feature badges: "RBAC対応", "監査ログ", "Row Level Security"
- User role indicators visible in dashboard preview

Additional elements:
- Small user avatar with role badge (Manager/Admin/Analyst/Viewer)
- Permission lock icons on certain dashboard elements
- Security-focused iconography

Output: 1920×1080, PNG format
SaveTo: assets/mockups/hero/20250826_hero_rbac_v002.png
```

### **Variant 1.3: Performance Monitoring Focus**
```
Prompt: Business dashboard hero emphasizing real-time performance monitoring.
SLO achievement and technical excellence highlighted.

Content:
- Same brand colors and base layout
- Hero text: "パフォーマンス最優先"
- Subheading: "SLO達成・リアルタイム監視・エンタープライズスケール"
- Performance metrics: "P95 1350ms", "99.7% 可用性", "432% スループット向上"
- Real-time monitoring charts visible in background

Visual elements:
- Performance monitoring dashboard preview with live charts
- Green status indicators and checkmarks
- Subtle animated elements suggestion (static mockup)

Output: 1920×1080, PNG format
SaveTo: assets/mockups/hero/20250826_hero_performance_v003.png
```

---

## 📊 **Template 2: Dashboard UI Mock (Full Features版)**

### **Variant 2.1: Complete Feature Set**
```
Prompt: Comprehensive business dashboard showing all implemented features.
Full navigation, KPI cards, charts, external data integration.

Layout:
- Left sidebar navigation: ダッシュボード/売上入力/エクスポート/アナリティクス/監査ログ
- Header with user info, notifications, filter controls (期間/店舗選択)
- Main grid: 2-3 columns with KPI cards, charts, external indicators

Features visible:
- KPI cards: 売上, 客数, 客単価, 転換率
- Charts: 売上推移 (line chart), 為替USDJPY, 日経225
- External data: 天候情報, 近隣イベント, STEMニュース
- Real-time update indicators

Brand consistency:
- Professional blue/slate color scheme
- Clean spacing, 8px border radius
- High information density with good whitespace

Output: 1920×1080, PNG format
SaveTo: assets/mockups/dashboard/20250826_dashboard_full_features_v001.png
```

### **Variant 2.2: RBAC Permission States**
```
Prompt: Dashboard UI showing role-based access control in action.
Different permission levels and restricted access indicators.

Same base layout as 2.1, but with:
- User role badge: "Manager" visible in header
- Some elements grayed out/disabled with lock icons
- Permission tooltips: "この機能はAdmin権限が必要です"
- Store access restrictions: only specific stores visible in filter
- Export button with role-based limitations

Visual indicators:
- Lock icons on restricted features
- Subtle gray overlays on disabled sections
- Green checkmarks on accessible features
- Role-based color coding (Manager = blue accents)

Output: 1920×1080, PNG format  
SaveTo: assets/mockups/dashboard/20250826_dashboard_rbac_v002.png
```

### **Variant 2.3: Performance Monitoring View**
```
Prompt: Dashboard with performance monitoring panels prominently displayed.
System health, SLO status, real-time performance metrics.

Additional panels for performance:
- Performance SLO status panel: "99.7% 可用性達成" with green indicators
- Response time chart: P95 performance over time
- System health indicators: CPU, Memory, Database response
- ETL job status: last run times, success/failure indicators

Performance-focused elements:
- Real-time status dots (green/yellow/red)
- Performance trend charts
- Alert notification badges
- System status summary cards

Output: 1920×1080, PNG format
SaveTo: assets/mockups/dashboard/20250826_dashboard_performance_v003.png
```

---

## 📝 **Template 3: App UI Mock (Sales Form State Compare)**

### **Variant 3.1: Before/After Validation**
```
Prompt: Split-screen sales form showing before (empty) and after (successful submission).
Tax-exclusive sales input with validation states.

Left side (Before):
- Empty form with all required fields visible
- Field labels: 日付, 店舗, 部門, カテゴリ, 税抜売上, 客数, 取引数
- Form validation hints and requirements
- Submit button in disabled state

Right side (After):
- Same form filled with data
- Success toast notification: "売上データを保存しました"
- Calculated values shown: 税込売上, 客単価
- Green checkmarks on validated fields
- Audit log indicator: "監査ログに記録済み"

Design elements:
- Clean form design with proper spacing
- Blue accent for active fields
- Green success indicators
- Professional business form styling

Output: 1920×1080, PNG format
SaveTo: assets/mockups/forms/20250826_sales_form_rbac_compare_v001.png
```

### **Variant 3.2: Real-time Validation**
```
Prompt: Sales form showing real-time validation and error handling.
Field-by-field validation with immediate feedback.

Form states displayed:
- Valid fields: green border, checkmark icon
- Invalid fields: red border, error message
- Loading/calculating fields: blue loading spinner
- Required field indicators: red asterisk

Validation examples:
- 客数 field: "客数は取引数以上である必要があります" (red error)
- 売上 field: "税込売上: ¥110,000 (自動計算)" (green success)
- 日付 field: "未来の日付は入力できません" (orange warning)

Real-time elements:
- Calculation indicators for 税込売上, 客単価
- Field dependency validation
- Progressive disclosure of form sections

Output: 1920×1080, PNG format
SaveTo: assets/mockups/forms/20250826_sales_form_validation_v002.png
```

### **Variant 3.3: Mobile Responsive View**
```
Prompt: Sales form optimized for mobile/tablet viewing.
Responsive design with touch-friendly elements.

Mobile adaptations:
- Single column layout instead of multi-column
- Larger touch targets for form fields
- Collapsible sections to save space
- Sticky submit button at bottom
- Mobile-optimized date picker and dropdowns

Responsive features:
- Hamburger navigation menu
- Swipe gestures indication
- Touch-friendly button sizes (minimum 44px)
- Optimized typography for mobile reading
- Proper spacing for thumb navigation

Device context:
- Shown in mobile device frame (iPhone/Android style)
- Portrait orientation
- Touch keyboard consideration in layout

Output: 1920×1080, PNG format
SaveTo: assets/mockups/forms/20250826_sales_form_mobile_v003.png
```

---

## 📈 **Template 4: Analytics & Export Mock**

### **Variant 4.1: Correlation Analysis**
```
Prompt: Analytics dashboard focusing on correlation analysis and heatmaps.
Statistical analysis of sales vs external factors.

Main features:
- Correlation heatmap: 曜日×天候 grid with color-coded values
- Filter controls: 期間選択 (7日/30日/3ヶ月/6ヶ月)
- Analysis results: Pearson correlation coefficients
- Comparison charts: 売上 vs 天候/イベント有無

Statistical elements:
- Color-coded heatmap (red/yellow/green for correlation strength)
- Statistical significance indicators
- Sample size and confidence intervals
- Trend analysis charts

Export options panel:
- File format selection: CSV/Excel
- Analysis scope settings
- Export button with processing indicator

Output: 1920×1080, PNG format
SaveTo: assets/mockups/analytics/20250826_analytics_correlation_v001.png
```

### **Variant 4.2: Performance & SLO Dashboard**
```
Prompt: Analytics view emphasizing system performance and SLO achievement.
Real-time performance monitoring and historical analysis.

Performance panels:
- SLO achievement status: 99.7% availability (green indicator)
- Response time distribution: P50/P90/P95/P99 charts
- Error rate monitoring: 0.3% error rate with trends
- Throughput analysis: 45.2 req/s performance

Monitoring elements:
- Real-time performance graphs
- SLO threshold lines on charts
- Alert thresholds and warning zones
- Historical performance trends (30-day view)

Analysis tools:
- Performance comparison periods
- Load testing results integration
- Capacity planning indicators
- Performance anomaly detection

Output: 1920×1080, PNG format
SaveTo: assets/mockups/analytics/20250826_analytics_performance_slo_v002.png
```

### **Variant 4.3: Export & Compliance**
```
Prompt: Export functionality with compliance and audit trail features.
Professional data export interface with security considerations.

Export interface:
- Data type selection: 売上/外部データ/統合データ
- Export format options: CSV/Excel with preview
- Date range selector with presets
- Store/department filtering options

Compliance features:
- Export request logging display
- Rate limiting indicator: "5回/時間 制限"
- Security warning: "機密データの取り扱いにご注意ください"
- Audit trail: "エクスポート操作は監査ログに記録されます"

Processing states:
- Export generation progress bar
- File size estimation
- Download ready notification
- Export history with timestamps

Output: 1920×1080, PNG format
SaveTo: assets/mockups/analytics/20250826_analytics_export_v003.png
```

---

## 🏷️ **Template 5: OG/Twitter Card**

### **Variant 5.1: Internal Dashboard OG**
```
Prompt: Open Graph image for internal dashboard sharing.
Clean, professional representation of the business dashboard.

Dimensions: 1200×630 (OG standard)
Content:
- Main headline: "経営戦略ダッシュボード"
- Subheading: "外部指標 × 売上で意思決定を加速"
- Simplified KPI card mockup (3 cards showing key metrics)
- Company/project branding area

Design:
- Minimal, professional layout
- High contrast text for social sharing
- Brand colors prominently featured
- Clean typography optimized for small display

Output: 1200×630, PNG format
SaveTo: assets/mockups/og/20250826_og_internal_dashboard_v001.png
```

### **Variant 5.2: Performance Achievement OG**
```
Prompt: OG image highlighting system performance achievements.
Emphasis on SLO success and enterprise-grade quality.

Content:
- Headline: "99.7% 可用性達成"
- Performance metrics: "P95 ≤ 1350ms", "エラー率 0.3%"
- Subheading: "エンタープライズ級システム性能"
- Performance chart background element

Achievement focus:
- Green checkmarks and success indicators
- Performance badge styling
- Trophy or achievement iconography
- Statistical data visualization

Output: 1200×630, PNG format
SaveTo: assets/mockups/og/20250826_og_performance_v002.png
```

### **Variant 5.3: RBAC Security OG**
```
Prompt: OG image focusing on security and role-based access features.
Professional security and compliance messaging.

Content:
- Headline: "セキュアな経営情報基盤"
- Security features: "RBAC", "監査ログ", "Row Level Security"
- Subheading: "4段階権限制御・コンプライアンス対応"
- Security shield or lock iconography

Security elements:
- Shield icons and security badging
- Professional blue/slate color scheme
- Lock and key visual metaphors
- Clean, trustworthy design aesthetic

Output: 1200×630, PNG format
SaveTo: assets/mockups/og/20250826_og_rbac_v003.png
```

---

## 📋 **Implementation Checklist**

### ✅ **Preparation Complete**
- [x] Assets directory structure created
- [x] Brand guidelines established
- [x] 15 mockup specifications written
- [x] Naming convention defined
- [x] Quality standards documented

### 🎯 **Ready for Generation**
- [ ] Template 1: Web Hero Mock (3 variants)
- [ ] Template 2: Dashboard UI Mock (3 variants)  
- [ ] Template 3: App UI Mock (3 variants)
- [ ] Template 4: Analytics Mock (3 variants)
- [ ] Template 5: OG Cards (3 variants)

### 📊 **Acceptance Criteria**
- **Given**: Image generation prompts prepared
- **When**: Images generated using specifications
- **Then**: 15 high-quality mockups completed, WCAG AA compliant, brand consistent

---

**Task Status**: ✅ **Implementation Ready**  
**Total Specifications**: 15 detailed image generation prompts  
**Next Step**: Execute image generation when technical constraints resolved  
**Acceptance**: Given prompts When 画像生成 Then 高品質mockup 3枚/template完成
