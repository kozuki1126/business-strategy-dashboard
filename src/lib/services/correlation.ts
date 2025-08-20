/**
 * 相関分析サービス
 * 売上と外部要因（天候・イベント・曜日など）の相関を計算
 */

import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database.types';
import { format, parseISO, getDay, subDays, subYears } from 'date-fns';

// 相関分析フィルター
export interface CorrelationFilters {
  startDate: string;
  endDate: string;
  storeId?: string;
  department?: string;
  category?: string;
}

// 相関分析結果
export interface CorrelationResult {
  factor: string;
  correlation: number;
  significance: number;
  sampleSize: number;
  description: string;
}

// ヒートマップデータ
export interface HeatmapData {
  x: string;
  y: string;
  value: number;
  tooltip?: string;
}

// 比較分析データ
export interface ComparisonData {
  date: string;
  current: number;
  previousDay: number;
  previousYear: number;
  dayOfWeek: string;
  weather?: string;
  hasEvent?: boolean;
}

// 相関分析統計
export interface CorrelationStats {
  correlations: CorrelationResult[];
  heatmapData: HeatmapData[];
  comparisonData: ComparisonData[];
  summary: {
    strongestPositive: CorrelationResult | null;
    strongestNegative: CorrelationResult | null;
    totalAnalyzedDays: number;
    averageDailySales: number;
  };
}

type SalesData = Database['public']['Tables']['sales']['Row'];
type WeatherData = Database['public']['Tables']['ext_weather_daily']['Row'];
type EventData = Database['public']['Tables']['ext_events']['Row'];

export class CorrelationService {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * 相関分析実行
   */
  async analyzeCorrelations(filters: CorrelationFilters): Promise<CorrelationStats> {
    const startTime = Date.now();

    try {
      // データ取得
      const [salesData, weatherData, eventData] = await Promise.all([
        this.fetchSalesData(filters),
        this.fetchWeatherData(filters),
        this.fetchEventData(filters)
      ]);

      // 日別集計データ作成
      const dailyData = this.createDailyAggregation(salesData, weatherData, eventData);

      // 相関計算
      const correlations = this.calculateCorrelations(dailyData);

      // ヒートマップデータ作成
      const heatmapData = this.createHeatmapData(dailyData);

      // 比較データ作成
      const comparisonData = await this.createComparisonData(dailyData, filters);

      // サマリー作成
      const summary = this.createSummary(correlations, dailyData);

      const processingTime = Date.now() - startTime;
      console.log(`Correlation analysis completed in ${processingTime}ms`);

      return {
        correlations,
        heatmapData,
        comparisonData,
        summary
      };
    } catch (error) {
      console.error('Correlation analysis failed:', error);
      throw new Error(`Correlation analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 売上データ取得
   */
  private async fetchSalesData(filters: CorrelationFilters): Promise<SalesData[]> {
    let query = this.supabase
      .from('sales')
      .select('*')
      .gte('date', filters.startDate)
      .lte('date', filters.endDate)
      .order('date');

    if (filters.storeId) {
      query = query.eq('store_id', filters.storeId);
    }
    if (filters.department) {
      query = query.eq('department', filters.department);
    }
    if (filters.category) {
      query = query.eq('product_category', filters.category);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch sales data: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 天候データ取得
   */
  private async fetchWeatherData(filters: CorrelationFilters): Promise<WeatherData[]> {
    const { data, error } = await this.supabase
      .from('ext_weather_daily')
      .select('*')
      .gte('date', filters.startDate)
      .lte('date', filters.endDate)
      .order('date');

    if (error) {
      throw new Error(`Failed to fetch weather data: ${error.message}`);
    }

    return data || [];
  }

  /**
   * イベントデータ取得
   */
  private async fetchEventData(filters: CorrelationFilters): Promise<EventData[]> {
    const { data, error } = await this.supabase
      .from('ext_events')
      .select('*')
      .gte('date', filters.startDate)
      .lte('date', filters.endDate)
      .order('date');

    if (error) {
      throw new Error(`Failed to fetch event data: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 日別集計データ作成
   */
  private createDailyAggregation(
    salesData: SalesData[],
    weatherData: WeatherData[],
    eventData: EventData[]
  ) {
    // 売上を日別に集計
    const salesByDate = salesData.reduce((acc, sale) => {
      const date = sale.date;
      if (!acc[date]) {
        acc[date] = {
          date,
          totalSales: 0,
          totalFootfall: 0,
          totalTransactions: 0,
          dayOfWeek: getDay(parseISO(date))
        };
      }
      acc[date].totalSales += sale.revenue_ex_tax || 0;
      acc[date].totalFootfall += sale.footfall || 0;
      acc[date].totalTransactions += sale.transactions || 0;
      return acc;
    }, {} as Record<string, any>);

    // 天候データをマージ
    weatherData.forEach(weather => {
      if (salesByDate[weather.date]) {
        salesByDate[weather.date].temperature = weather.temp_avg;
        salesByDate[weather.date].humidity = weather.humidity;
        salesByDate[weather.date].precipitation = weather.precipitation;
        salesByDate[weather.date].weatherCondition = weather.condition;
        salesByDate[weather.date].isRainy = weather.condition?.includes('雨') || false;
        salesByDate[weather.date].isSunny = weather.condition?.includes('晴') || false;
      }
    });

    // イベントデータをマージ
    eventData.forEach(event => {
      if (salesByDate[event.date]) {
        if (!salesByDate[event.date].events) {
          salesByDate[event.date].events = [];
        }
        salesByDate[event.date].events.push(event);
        salesByDate[event.date].hasEvent = true;
      }
    });

    // イベントがない日はfalseを設定
    Object.values(salesByDate).forEach((daily: any) => {
      if (!daily.hasEvent) {
        daily.hasEvent = false;
        daily.events = [];
      }
    });

    return Object.values(salesByDate);
  }

  /**
   * 相関計算
   */
  private calculateCorrelations(dailyData: any[]): CorrelationResult[] {
    const correlations: CorrelationResult[] = [];

    if (dailyData.length < 3) {
      return correlations; // サンプルサイズが小さすぎる
    }

    // 曜日との相関
    const dayOfWeekCorr = this.calculateDayOfWeekCorrelation(dailyData);
    correlations.push(...dayOfWeekCorr);

    // 天候との相関
    const weatherCorr = this.calculateWeatherCorrelation(dailyData);
    correlations.push(...weatherCorr);

    // イベントとの相関
    const eventCorr = this.calculateEventCorrelation(dailyData);
    correlations.push(eventCorr);

    return correlations.filter(corr => !isNaN(corr.correlation));
  }

  /**
   * 曜日相関計算
   */
  private calculateDayOfWeekCorrelation(dailyData: any[]): CorrelationResult[] {
    const correlations: CorrelationResult[] = [];
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

    // 各曜日の売上平均を計算
    const salesByDay = dailyData.reduce((acc, daily) => {
      const dayOfWeek = daily.dayOfWeek;
      if (!acc[dayOfWeek]) acc[dayOfWeek] = [];
      acc[dayOfWeek].push(daily.totalSales);
      return acc;
    }, {} as Record<number, number[]>);

    // 全体平均
    const overallAverage = dailyData.reduce((sum, daily) => sum + daily.totalSales, 0) / dailyData.length;

    // 各曜日の相関（平均からの偏差として）
    for (let day = 0; day <= 6; day++) {
      if (salesByDay[day] && salesByDay[day].length > 0) {
        const dayAverage = salesByDay[day].reduce((sum, sales) => sum + sales, 0) / salesByDay[day].length;
        const correlation = (dayAverage - overallAverage) / overallAverage;
        
        correlations.push({
          factor: `曜日_${dayNames[day]}曜日`,
          correlation: Math.max(-1, Math.min(1, correlation)), // -1から1に正規化
          significance: salesByDay[day].length >= 3 ? 0.95 : 0.5,
          sampleSize: salesByDay[day].length,
          description: `${dayNames[day]}曜日の売上平均は全体平均の${(correlation * 100 + 100).toFixed(1)}%`
        });
      }
    }

    return correlations;
  }

  /**
   * 天候相関計算
   */
  private calculateWeatherCorrelation(dailyData: any[]): CorrelationResult[] {
    const correlations: CorrelationResult[] = [];

    // 気温との相関
    const tempData = dailyData.filter(d => d.temperature !== undefined);
    if (tempData.length >= 3) {
      const tempCorr = this.pearsonCorrelation(
        tempData.map(d => d.totalSales),
        tempData.map(d => d.temperature)
      );
      correlations.push({
        factor: '気温',
        correlation: tempCorr,
        significance: tempData.length >= 10 ? 0.95 : 0.8,
        sampleSize: tempData.length,
        description: `気温と売上の相関係数: ${tempCorr.toFixed(3)}`
      });
    }

    // 湿度との相関
    const humidityData = dailyData.filter(d => d.humidity !== undefined);
    if (humidityData.length >= 3) {
      const humidityCorr = this.pearsonCorrelation(
        humidityData.map(d => d.totalSales),
        humidityData.map(d => d.humidity)
      );
      correlations.push({
        factor: '湿度',
        correlation: humidityCorr,
        significance: humidityData.length >= 10 ? 0.95 : 0.8,
        sampleSize: humidityData.length,
        description: `湿度と売上の相関係数: ${humidityCorr.toFixed(3)}`
      });
    }

    // 降水量との相関
    const precipData = dailyData.filter(d => d.precipitation !== undefined);
    if (precipData.length >= 3) {
      const precipCorr = this.pearsonCorrelation(
        precipData.map(d => d.totalSales),
        precipData.map(d => d.precipitation)
      );
      correlations.push({
        factor: '降水量',
        correlation: precipCorr,
        significance: precipData.length >= 10 ? 0.95 : 0.8,
        sampleSize: precipData.length,
        description: `降水量と売上の相関係数: ${precipCorr.toFixed(3)}`
      });
    }

    // 雨天との相関
    const rainyDays = dailyData.filter(d => d.isRainy === true);
    const sunnyDays = dailyData.filter(d => d.isSunny === true);
    
    if (rainyDays.length > 0 && sunnyDays.length > 0) {
      const rainyAvg = rainyDays.reduce((sum, d) => sum + d.totalSales, 0) / rainyDays.length;
      const sunnyAvg = sunnyDays.reduce((sum, d) => sum + d.totalSales, 0) / sunnyDays.length;
      const overallAvg = dailyData.reduce((sum, d) => sum + d.totalSales, 0) / dailyData.length;
      
      const rainyCorr = (rainyAvg - overallAvg) / overallAvg;
      correlations.push({
        factor: '雨天',
        correlation: Math.max(-1, Math.min(1, rainyCorr)),
        significance: rainyDays.length >= 5 ? 0.9 : 0.7,
        sampleSize: rainyDays.length,
        description: `雨天時の売上は平均の${(rainyCorr * 100 + 100).toFixed(1)}%`
      });
    }

    return correlations;
  }

  /**
   * イベント相関計算
   */
  private calculateEventCorrelation(dailyData: any[]): CorrelationResult {
    const eventDays = dailyData.filter(d => d.hasEvent);
    const noEventDays = dailyData.filter(d => !d.hasEvent);

    if (eventDays.length === 0 || noEventDays.length === 0) {
      return {
        factor: 'イベント',
        correlation: 0,
        significance: 0,
        sampleSize: 0,
        description: 'イベントデータが不十分です'
      };
    }

    const eventAvg = eventDays.reduce((sum, d) => sum + d.totalSales, 0) / eventDays.length;
    const noEventAvg = noEventDays.reduce((sum, d) => sum + d.totalSales, 0) / noEventDays.length;
    const overallAvg = dailyData.reduce((sum, d) => sum + d.totalSales, 0) / dailyData.length;

    const correlation = (eventAvg - noEventAvg) / overallAvg;

    return {
      factor: 'イベント',
      correlation: Math.max(-1, Math.min(1, correlation)),
      significance: Math.min(eventDays.length, noEventDays.length) >= 5 ? 0.9 : 0.7,
      sampleSize: eventDays.length,
      description: `イベント日の売上は非イベント日の${(eventAvg / noEventAvg * 100).toFixed(1)}%`
    };
  }

  /**
   * ピアソン相関係数計算
   */
  private pearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = y.reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * ヒートマップデータ作成
   */
  private createHeatmapData(dailyData: any[]): HeatmapData[] {
    const heatmapData: HeatmapData[] = [];
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const weatherConditions = ['晴', '曇', '雨', 'その他'];

    // 曜日×天候のヒートマップ
    for (let day = 0; day <= 6; day++) {
      for (const condition of weatherConditions) {
        const matchingDays = dailyData.filter(d => 
          d.dayOfWeek === day && 
          (condition === 'その他' ? 
            !d.weatherCondition || (!d.weatherCondition.includes('晴') && !d.weatherCondition.includes('曇') && !d.weatherCondition.includes('雨')) :
            d.weatherCondition?.includes(condition))
        );

        if (matchingDays.length > 0) {
          const avgSales = matchingDays.reduce((sum, d) => sum + d.totalSales, 0) / matchingDays.length;
          const overallAvg = dailyData.reduce((sum, d) => sum + d.totalSales, 0) / dailyData.length;
          
          heatmapData.push({
            x: dayNames[day],
            y: condition,
            value: avgSales / overallAvg, // 正規化
            tooltip: `${dayNames[day]}曜日・${condition}: 平均売上 ${avgSales.toLocaleString()}円 (${matchingDays.length}日)`
          });
        }
      }
    }

    return heatmapData;
  }

  /**
   * 比較データ作成
   */
  private async createComparisonData(dailyData: any[], filters: CorrelationFilters): Promise<ComparisonData[]> {
    const comparisonData: ComparisonData[] = [];
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

    // 前年同期データ取得
    const previousYearStart = format(subYears(parseISO(filters.startDate), 1), 'yyyy-MM-dd');
    const previousYearEnd = format(subYears(parseISO(filters.endDate), 1), 'yyyy-MM-dd');
    
    const previousYearFilters = {
      ...filters,
      startDate: previousYearStart,
      endDate: previousYearEnd
    };

    try {
      const previousYearSales = await this.fetchSalesData(previousYearFilters);
      const previousYearByDate = previousYearSales.reduce((acc, sale) => {
        const date = sale.date;
        if (!acc[date]) acc[date] = 0;
        acc[date] += sale.revenue_ex_tax || 0;
        return acc;
      }, {} as Record<string, number>);

      // 比較データ作成
      for (const daily of dailyData) {
        const currentDate = parseISO(daily.date);
        const previousDay = format(subDays(currentDate, 1), 'yyyy-MM-dd');
        const previousYearDate = format(subYears(currentDate, 1), 'yyyy-MM-dd');

        // 前日データ
        const previousDayData = dailyData.find(d => d.date === previousDay);
        
        comparisonData.push({
          date: daily.date,
          current: daily.totalSales,
          previousDay: previousDayData?.totalSales || 0,
          previousYear: previousYearByDate[previousYearDate] || 0,
          dayOfWeek: dayNames[daily.dayOfWeek],
          weather: daily.weatherCondition,
          hasEvent: daily.hasEvent
        });
      }
    } catch (error) {
      console.warn('Failed to fetch previous year data:', error);
      // 前年データが取得できない場合は前日比較のみ
      for (const daily of dailyData) {
        const currentDate = parseISO(daily.date);
        const previousDay = format(subDays(currentDate, 1), 'yyyy-MM-dd');
        const previousDayData = dailyData.find(d => d.date === previousDay);
        
        comparisonData.push({
          date: daily.date,
          current: daily.totalSales,
          previousDay: previousDayData?.totalSales || 0,
          previousYear: 0,
          dayOfWeek: dayNames[daily.dayOfWeek],
          weather: daily.weatherCondition,
          hasEvent: daily.hasEvent
        });
      }
    }

    return comparisonData.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * サマリー作成
   */
  private createSummary(correlations: CorrelationResult[], dailyData: any[]) {
    const validCorrelations = correlations.filter(c => !isNaN(c.correlation) && isFinite(c.correlation));
    
    let strongestPositive: CorrelationResult | null = null;
    let strongestNegative: CorrelationResult | null = null;

    for (const corr of validCorrelations) {
      if (corr.correlation > 0 && (!strongestPositive || corr.correlation > strongestPositive.correlation)) {
        strongestPositive = corr;
      }
      if (corr.correlation < 0 && (!strongestNegative || corr.correlation < strongestNegative.correlation)) {
        strongestNegative = corr;
      }
    }

    const totalAnalyzedDays = dailyData.length;
    const averageDailySales = totalAnalyzedDays > 0 
      ? dailyData.reduce((sum, d) => sum + d.totalSales, 0) / totalAnalyzedDays 
      : 0;

    return {
      strongestPositive,
      strongestNegative,
      totalAnalyzedDays,
      averageDailySales
    };
  }

  /**
   * パフォーマンステスト
   */
  async performanceTest(filters: CorrelationFilters): Promise<{ responseTime: number; dataSize: number }> {
    const startTime = Date.now();
    
    try {
      const result = await this.analyzeCorrelations(filters);
      const responseTime = Date.now() - startTime;
      const dataSize = result.comparisonData.length;
      
      return { responseTime, dataSize };
    } catch (error) {
      throw error;
    }
  }
}

export default CorrelationService;
