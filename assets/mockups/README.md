# Assets - UI Mockups Directory

## 📁 Directory Structure

```
assets/
└── mockups/
    ├── README.md              # This file
    ├── hero/                 # Web Hero Mock templates
    │   ├── 20250826_hero_enterprise_v001.png
    │   ├── 20250826_hero_rbac_v002.png
    │   └── 20250826_hero_performance_v003.png
    ├── dashboard/            # Dashboard UI Mock templates
    │   ├── 20250826_dashboard_full_features_v001.png
    │   ├── 20250826_dashboard_rbac_v002.png
    │   └── 20250826_dashboard_performance_v003.png
    ├── forms/               # App UI Mock (Sales Form) templates
    │   ├── 20250826_sales_form_rbac_compare_v001.png
    │   ├── 20250826_sales_form_validation_v002.png
    │   └── 20250826_sales_form_mobile_v003.png
    ├── analytics/           # Analytics & Export Mock templates
    │   ├── 20250826_analytics_correlation_v001.png
    │   ├── 20250826_analytics_performance_slo_v002.png
    │   └── 20250826_analytics_export_v003.png
    ├── og/                  # OG/Twitter Card templates
    │   ├── 20250826_og_internal_dashboard_v001.png
    │   ├── 20250826_og_performance_v002.png
    │   └── 20250826_og_rbac_v003.png
    └── icons/               # Business Icon Set
        ├── 20250826_iconset_business_v001.png
        ├── 20250826_iconset_rbac_v002.png
        └── 20250826_iconset_analytics_v003.png
```

## 🎨 Brand Guidelines

### Colors
- **Primary Blue**: #0EA5E9
- **Dark Slate**: #0F172A  
- **Light**: #F8FAFC
- **Supporting**: Tailwind CSS color palette

### Typography
- **Primary**: Inter, Noto Sans JP
- **Style**: Clean, professional, WCAG AA compliant

### Design Principles
- Minimal, professional business design
- High information density with sufficient whitespace
- Corner radius: 8-12px
- Subtle shadows and effects
- Enterprise-grade quality feel

## 📊 Current Project Status (Referenced)

### ✅ Implemented Features
- **Dashboard**: Real-time visualization, external indicators integration, responsive design
- **Sales Management**: Tax-exclusive input, validation, export, audit trail
- **ETL Pipeline**: 4x daily auto execution (JST 06/12/18/22), 6 data sources, notification system
- **Analysis**: Correlation analysis, comparison analysis, heatmap visualization
- **RBAC**: 4-role hierarchy, store access control, Row Level Security
- **Performance**: SLO achievement, 99.7% availability, P95≤1350ms

### 🎯 Quality Standards Achieved
- **Enterprise Performance**: 99.7% uptime, SLO compliance
- **Comprehensive Testing**: E2E, performance, accessibility, visual regression
- **CI/CD Automation**: 6 check gates, auto deployment, quality assurance
- **Security & Compliance**: RBAC, audit logs, authentication, authorization

## 📋 Usage Instructions

### For Image Generation
1. Use prompts from `docs/ImageGen_Prompts.md`
2. Generate 3 variations per template (15 total images)
3. Save with naming convention: `YYYYMMDD_template_variant_v00X.png`
4. Ensure WCAG AA compliance and brand consistency

### For Development Integration
1. Reference mockups for UI implementation
2. Use brand colors and typography consistently  
3. Maintain enterprise-grade quality standards
4. Ensure mobile responsiveness and accessibility

## 🔗 Related Documentation

- **Image Generation Prompts**: [../docs/ImageGen_Prompts.md](../docs/ImageGen_Prompts.md)
- **Product Requirements**: [../docs/PRD.md](../docs/PRD.md)
- **Architecture Rules**: [../docs/Rules_Architecture.md](../docs/Rules_Architecture.md)
- **Development Progress**: [../docs/DEVELOPMENT_PROGRESS.md](../docs/DEVELOPMENT_PROGRESS.md)

---

**Project Progress**: 94% (16/17 tasks completed) → PostGA Phase: UI Design & Mockup Generation  
**Last Updated**: 2025-08-26 - Task #IMG001 Implementation Preparation
