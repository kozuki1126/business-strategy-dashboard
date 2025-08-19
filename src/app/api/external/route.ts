import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { format, subDays, startOfDay } from 'date-fns'

export interface MarketIndex {
  date: string
  index_code: string
  value: number
  change_percent: number
  change_absolute: number
}

export interface FxRate {
  date: string
  base_currency: string
  target_currency: string
  rate: number
  change_percent: number
}

export interface WeatherData {
  date: string
  location: string
  temperature_high: number
  temperature_low: number
  weather_condition: string
  precipitation: number
  humidity: number
}

export interface EventData {
  date: string
  event_name: string
  event_type: string
  location: string
  estimated_impact: string
  description: string
}

export interface InboundData {
  date: string
  country: string
  arrivals: number
  change_percent: number
}

export interface StemNewsData {
  date: string
  title: string
  category: string
  sentiment: string
  impact_score: number
  source: string
  url?: string
}

export interface ExternalDataResponse {
  market_indices: MarketIndex[]
  fx_rates: FxRate[]
  weather: WeatherData[]
  events: EventData[]
  inbound: InboundData[]
  stem_news: StemNewsData[]
  last_updated: string
}

async function getMarketIndices(days: number = 30): Promise<MarketIndex[]> {
  const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd')
  
  const { data, error } = await supabase
    .from('ext_market_index')
    .select('*')
    .gte('date', startDate)
    .order('date', { ascending: false })
    .limit(100)

  if (error) throw error

  return (data || []).map(row => ({
    date: row.date,
    index_code: row.index_code,
    value: row.value,
    change_percent: row.change_percent || 0,
    change_absolute: row.change_absolute || 0
  }))
}

async function getFxRates(days: number = 30): Promise<FxRate[]> {
  const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd')
  
  const { data, error } = await supabase
    .from('ext_fx_rate')
    .select('*')
    .gte('date', startDate)
    .order('date', { ascending: false })
    .limit(50)

  if (error) throw error

  return (data || []).map(row => ({
    date: row.date,
    base_currency: row.base_currency,
    target_currency: row.target_currency,
    rate: row.rate,
    change_percent: row.change_percent || 0
  }))
}

async function getWeatherData(days: number = 7): Promise<WeatherData[]> {
  const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd')
  
  const { data, error } = await supabase
    .from('ext_weather_daily')
    .select('*')
    .gte('date', startDate)
    .order('date', { ascending: false })
    .limit(30)

  if (error) throw error

  return (data || []).map(row => ({
    date: row.date,
    location: row.location,
    temperature_high: row.temperature_high || 0,
    temperature_low: row.temperature_low || 0,
    weather_condition: row.weather_condition || 'Unknown',
    precipitation: row.precipitation || 0,
    humidity: row.humidity || 0
  }))
}

async function getEvents(days: number = 30): Promise<EventData[]> {
  const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd')
  const endDate = format(new Date(), 'yyyy-MM-dd')
  
  const { data, error } = await supabase
    .from('ext_events')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })
    .limit(20)

  if (error) throw error

  return (data || []).map(row => ({
    date: row.date,
    event_name: row.event_name,
    event_type: row.event_type,
    location: row.location || '',
    estimated_impact: row.estimated_impact || 'Medium',
    description: row.description || ''
  }))
}

async function getInboundData(days: number = 30): Promise<InboundData[]> {
  const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd')
  
  const { data, error } = await supabase
    .from('ext_inbound')
    .select('*')
    .gte('date', startDate)
    .order('date', { ascending: false })
    .limit(50)

  if (error) throw error

  return (data || []).map(row => ({
    date: row.date,
    country: row.country,
    arrivals: row.arrivals || 0,
    change_percent: row.change_percent || 0
  }))
}

async function getStemNews(days: number = 7): Promise<StemNewsData[]> {
  const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd')
  
  const { data, error } = await supabase
    .from('ext_stem_news')
    .select('*')
    .gte('date', startDate)
    .order('date', { ascending: false })
    .limit(15)

  if (error) throw error

  return (data || []).map(row => ({
    date: row.date,
    title: row.title,
    category: row.category,
    sentiment: row.sentiment || 'neutral',
    impact_score: row.impact_score || 0,
    source: row.source || 'Unknown',
    url: row.url || undefined
  }))
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30', 10)
    const category = searchParams.get('category') // Optional: filter by specific category

    // Validate days parameter
    if (days < 1 || days > 365) {
      return NextResponse.json(
        { error: 'Days parameter must be between 1 and 365' },
        { status: 400 }
      )
    }

    let response: Partial<ExternalDataResponse> = {
      last_updated: new Date().toISOString()
    }

    // Fetch data based on category filter, or all if no filter
    if (!category || category === 'market') {
      const [market_indices, fx_rates] = await Promise.all([
        getMarketIndices(days),
        getFxRates(days)
      ])
      response.market_indices = market_indices
      response.fx_rates = fx_rates
    }

    if (!category || category === 'weather') {
      response.weather = await getWeatherData(Math.min(days, 14)) // Weather limited to 2 weeks
    }

    if (!category || category === 'events') {
      response.events = await getEvents(days)
    }

    if (!category || category === 'inbound') {
      response.inbound = await getInboundData(days)
    }

    if (!category || category === 'news') {
      response.stem_news = await getStemNews(Math.min(days, 14)) // News limited to 2 weeks
    }

    // If no category specified, fetch all data
    if (!category) {
      const [
        market_indices,
        fx_rates,
        weather,
        events,
        inbound,
        stem_news
      ] = await Promise.all([
        getMarketIndices(days),
        getFxRates(days),
        getWeatherData(Math.min(days, 14)),
        getEvents(days),
        getInboundData(days),
        getStemNews(Math.min(days, 14))
      ])

      response = {
        market_indices,
        fx_rates,
        weather,
        events,
        inbound,
        stem_news,
        last_updated: new Date().toISOString()
      }
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=600, stale-while-revalidate=1200' // 10min cache, 20min stale
      }
    })

  } catch (error) {
    console.error('External data API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch external data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Helper function to get latest values for dashboard summary
export async function getLatestExternalData() {
  try {
    const today = format(new Date(), 'yyyy-MM-dd')
    
    // Get latest market data
    const { data: latestMarket } = await supabase
      .from('ext_market_index')
      .select('*')
      .order('date', { ascending: false })
      .limit(10)

    // Get latest FX rates
    const { data: latestFx } = await supabase
      .from('ext_fx_rate')
      .select('*')
      .order('date', { ascending: false })
      .limit(5)

    // Get today's weather
    const { data: todayWeather } = await supabase
      .from('ext_weather_daily')
      .select('*')
      .eq('date', today)
      .limit(5)

    return {
      market: latestMarket || [],
      fx: latestFx || [],
      weather: todayWeather || []
    }
  } catch (error) {
    console.error('Error fetching latest external data:', error)
    return {
      market: [],
      fx: [],
      weather: []
    }
  }
}
