'use client'

import { useMemo } from 'react'
import { Database } from '@/types/database.types'
import { format } from 'date-fns'
import { TrendingUp, TrendingDown, Minus, Cloud, Calendar, MapPin } from 'lucide-react'

interface ExternalIndicatorsProps {
  marketData: Database['public']['Tables']['ext_market_index']['Row'][]
  weatherData: Database['public']['Tables']['ext_weather_daily']['Row'][]
  events: Database['public']['Tables']['ext_events']['Row'][]
  loading?: boolean
}

export function ExternalIndicators({ 
  marketData, 
  weatherData, 
  events, 
  loading 
}: ExternalIndicatorsProps) {
  const processedData = useMemo(() => {
    // Process market data - get latest for each symbol
    const latestMarket = marketData.reduce((acc, item) => {
      if (!acc[item.symbol] || new Date(item.date) > new Date(acc[item.symbol].date)) {
        acc[item.symbol] = item
      }
      return acc
    }, {} as Record<string, any>)

    // Process weather data - get latest for each location
    const latestWeather = weatherData.reduce((acc, item) => {
      if (!acc[item.location] || new Date(item.date) > new Date(acc[item.location].date)) {
        acc[item.location] = item
      }
      return acc
    }, {} as Record<string, any>)

    // Process events - get today's and upcoming events
    const today = new Date().toISOString().split('T')[0]
    const upcomingEvents = events
      .filter(event => event.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5)

    return {
      market: Object.values(latestMarket),
      weather: Object.values(latestWeather),
      events: upcomingEvents
    }
  }, [marketData, weatherData, events])

  const getTrendIcon = (changePercent: number | null) => {
    if (!changePercent) return <Minus className="h-4 w-4 text-gray-400" />
    if (changePercent > 0) return <TrendingUp className="h-4 w-4 text-green-500" />
    if (changePercent < 0) return <TrendingDown className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  const getTrendColor = (changePercent: number | null) => {
    if (!changePercent) return 'text-gray-600'
    if (changePercent > 0) return 'text-green-600'
    if (changePercent < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  const getWeatherIcon = (condition: string | null) => {
    if (!condition) return '🌤️'
    
    const conditionLower = condition.toLowerCase()
    if (conditionLower.includes('sunny') || conditionLower.includes('晴')) return '☀️'
    if (conditionLower.includes('cloudy') || conditionLower.includes('曇')) return '☁️'
    if (conditionLower.includes('rain') || conditionLower.includes('雨')) return '🌧️'
    if (conditionLower.includes('snow') || conditionLower.includes('雪')) return '❄️'
    if (conditionLower.includes('fog') || conditionLower.includes('霧')) return '🌫️'
    if (conditionLower.includes('partly') || conditionLower.includes('一部')) return '⛅'
    
    return '🌤️'
  }

  const formatMarketSymbol = (symbol: string) => {
    const symbolMap: Record<string, string> = {
      'TOPIX': 'TOPIX',
      'NIKKEI225': '日経225',
      '7203': 'トヨタ(7203)',
      '6758': 'ソニー(6758)', 
      '9984': 'ソフトバンク(9984)'
    }
    return symbolMap[symbol] || symbol
  }

  const formatEventType = (type: string | null) => {
    if (!type) return 'イベント'
    
    const typeMap: Record<string, string> = {
      'festival': '祭り',
      'concert': 'コンサート',
      'sports': 'スポーツ',
      'exhibition': '展示会',
      'conference': '会議',
      'food': 'フード',
      'cultural': '文化',
      'fireworks': '花火'
    }
    return typeMap[type] || type
  }

  if (loading) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">外部指標</h3>
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex justify-between items-center">
              <div className="animate-pulse bg-gray-200 h-4 w-24 rounded"></div>
              <div className="animate-pulse bg-gray-200 h-4 w-16 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">外部指標</h3>
      
      <div className="space-y-6">
        {/* Market Indicators */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            📈 市場指標
          </h4>
          <div className="space-y-2">
            {processedData.market.length > 0 ? (
              processedData.market.map((item) => (
                <div key={item.symbol} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {getTrendIcon(item.change_percent)}
                    <span className="text-sm text-gray-600">
                      {formatMarketSymbol(item.symbol)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-gray-900">
                      {new Intl.NumberFormat('ja-JP', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }).format(item.value)}
                    </span>
                    {item.change_percent && (
                      <span className={`ml-2 text-xs ${getTrendColor(item.change_percent)}`}>
                        {item.change_percent > 0 ? '+' : ''}
                        {item.change_percent.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">市場データなし</p>
            )}
          </div>
        </div>

        {/* Weather Information */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <Cloud className="h-4 w-4 mr-1" />
            天候情報
          </h4>
          <div className="space-y-2">
            {processedData.weather.length > 0 ? (
              processedData.weather.map((item) => (
                <div key={item.location} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {getWeatherIcon(item.weather_condition)}
                    </span>
                    <span className="text-sm text-gray-600">{item.location}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {item.temperature_max && item.temperature_min ? (
                        `${item.temperature_max}°/${item.temperature_min}°C`
                      ) : (
                        item.weather_condition || '不明'
                      )}
                    </div>
                    {item.precipitation_mm !== null && item.precipitation_mm > 0 && (
                      <div className="text-xs text-blue-600">
                        降水量: {item.precipitation_mm}mm
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">天候データなし</p>
            )}
          </div>
        </div>

        {/* Upcoming Events */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <Calendar className="h-4 w-4 mr-1" />
            近隣イベント
          </h4>
          <div className="space-y-2">
            {processedData.events.length > 0 ? (
              processedData.events.map((event) => (
                <div key={event.id} className="border-l-2 border-blue-200 pl-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 line-clamp-1">
                        {event.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          {format(new Date(event.date), 'MM/dd')}
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          {formatEventType(event.event_type)}
                        </span>
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          <span className="text-xs text-gray-500 line-clamp-1">
                            {event.location}
                          </span>
                        </div>
                      )}
                    </div>
                    {event.expected_attendance && (
                      <div className="text-xs text-gray-500 ml-2">
                        予想{new Intl.NumberFormat('ja-JP').format(event.expected_attendance)}人
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">予定イベントなし</p>
            )}
          </div>
        </div>

        {/* Data Freshness */}
        <div className="pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-500 space-y-1">
            {processedData.market.length > 0 && (
              <div>
                市場データ最終更新: {format(new Date(processedData.market[0]?.date || new Date()), 'MM/dd HH:mm')}
              </div>
            )}
            {processedData.weather.length > 0 && (
              <div>
                天候データ最終更新: {format(new Date(processedData.weather[0]?.date || new Date()), 'MM/dd HH:mm')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}