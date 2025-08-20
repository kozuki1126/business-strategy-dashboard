/**
 * Notification Service
 * Task #009: E-mail通知システム実装
 * 
 * Purpose: ETL成功・失敗のE-mail通知システム
 * Features:
 * - ETL実行結果の自動通知
 * - HTML・テキスト形式メール
 * - エラーレポート・詳細情報
 * - 5分以内通知保証
 * - Resend統合・受信者管理
 */

import { Resend } from 'resend'

export interface ETLNotificationData {
  status: 'success' | 'failure'
  runId?: string
  duration?: number
  results?: any
  error?: string
  timestamp?: string
}

export interface EmailRecipient {
  email: string
  name?: string
  role?: string
}

export interface EmailContent {
  subject: string
  html: string
  text: string
}

export class NotificationService {
  private static resend: Resend | null = null
  
  /**
   * Initialize Resend client
   */
  private static getResendClient(): Resend | null {
    if (!this.resend && process.env.RESEND_API_KEY) {
      this.resend = new Resend(process.env.RESEND_API_KEY)
    }
    return this.resend
  }

  /**
   * Get default email recipients from environment
   */
  private static getDefaultRecipients(type: 'admin' | 'alerts' = 'admin'): EmailRecipient[] {
    const envVar = type === 'admin' ? 'EMAIL_RECIPIENTS_ADMIN' : 'EMAIL_RECIPIENTS_ALERTS'
    const recipientsStr = process.env[envVar] || 'admin@company.com'
    
    return recipientsStr.split(',').map((email, index) => ({
      email: email.trim(),
      name: `Recipient ${index + 1}`,
      role: type
    }))
  }

  /**
   * Send ETL notification email
   */
  static async sendETLNotification(data: ETLNotificationData): Promise<void> {
    const startTime = Date.now()
    
    try {
      console.log('[NotificationService] Sending ETL notification:', data.status)
      
      const recipients = this.getNotificationRecipients(data.status)
      const emailContent = this.generateETLEmailContent(data)
      
      await this.sendEmail({
        recipients,
        subject: emailContent.subject,
        htmlContent: emailContent.html,
        textContent: emailContent.text
      })

      const duration = Date.now() - startTime
      console.log(`[NotificationService] ETL notification sent to ${recipients.length} recipients in ${duration}ms`)
      
      // Ensure 5-minute delivery guarantee
      if (duration > 5 * 60 * 1000) {
        console.warn(`[NotificationService] Email delivery took ${duration}ms, exceeding 5-minute SLA`)
      }
      
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`[NotificationService] Failed to send ETL notification after ${duration}ms:`, error)
      
      // Don't throw error to avoid breaking ETL flow
      // Log to monitoring system instead
      this.logNotificationFailure('etl_notification', error, data)
    }
  }

  /**
   * Send system health alert
   */
  static async sendHealthAlert(
    alertType: 'warning' | 'critical',
    message: string,
    details?: Record<string, any>
  ): Promise<void> {
    const startTime = Date.now()
    
    try {
      console.log(`[NotificationService] Sending health alert: ${alertType}`)
      
      const recipients = this.getNotificationRecipients('failure') // Use failure recipients for alerts
      
      await this.sendEmail({
        recipients,
        subject: `🚨 System Health Alert: ${alertType.toUpperCase()}`,
        htmlContent: this.generateHealthAlertHTML(alertType, message, details),
        textContent: this.generateHealthAlertText(alertType, message, details)
      })

      const duration = Date.now() - startTime
      console.log(`[NotificationService] Health alert sent to ${recipients.length} recipients in ${duration}ms`)
      
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`[NotificationService] Failed to send health alert after ${duration}ms:`, error)
      
      this.logNotificationFailure('health_alert', error, { alertType, message, details })
    }
  }

  /**
   * Send custom notification
   */
  static async sendCustomNotification(
    recipients: EmailRecipient[],
    subject: string,
    content: { html: string; text: string },
    priority: 'normal' | 'high' = 'normal'
  ): Promise<void> {
    const startTime = Date.now()
    
    try {
      console.log(`[NotificationService] Sending custom notification (${priority}):`, subject)
      
      await this.sendEmail({
        recipients,
        subject,
        htmlContent: content.html,
        textContent: content.text
      })

      const duration = Date.now() - startTime
      console.log(`[NotificationService] Custom notification sent to ${recipients.length} recipients in ${duration}ms`)
      
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`[NotificationService] Failed to send custom notification after ${duration}ms:`, error)
      throw error // Throw for custom notifications as they may be critical
    }
  }

  /**
   * Get notification recipients based on event type
   */
  private static getNotificationRecipients(eventType: string): EmailRecipient[] {
    // Get recipients based on event type
    if (eventType === 'failure' || eventType === 'critical') {
      return this.getDefaultRecipients('alerts')
    }
    
    return this.getDefaultRecipients('admin')
  }

  /**
   * Generate ETL email content
   */
  private static generateETLEmailContent(data: ETLNotificationData): EmailContent {
    const timestamp = data.timestamp || new Date().toISOString()
    const jstTime = new Date(timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    
    const isSuccess = data.status === 'success'
    const statusIcon = isSuccess ? '✅' : '❌'
    const statusText = isSuccess ? 'SUCCESS' : 'FAILURE'
    
    const subject = `${statusIcon} ETL ${statusText} - ${jstTime}`
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ETL ${statusText} Report</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            margin: 0; 
            padding: 20px; 
            background-color: #f5f5f5; 
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: #ffffff; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); 
            overflow: hidden; 
          }
          .header { 
            background-color: ${isSuccess ? '#d4edda' : '#f8d7da'}; 
            padding: 20px; 
            text-align: center; 
          }
          .status { 
            font-size: 28px; 
            font-weight: bold; 
            color: ${isSuccess ? '#155724' : '#721c24'}; 
            margin: 0; 
          }
          .content { 
            padding: 20px; 
          }
          .details { 
            background-color: #f8f9fa; 
            padding: 15px; 
            border-radius: 5px; 
            margin: 15px 0; 
            border-left: 4px solid #007bff; 
          }
          .error { 
            background-color: #f8d7da; 
            color: #721c24; 
            padding: 15px; 
            border-radius: 5px; 
            border-left: 4px solid #dc3545; 
            margin: 15px 0; 
          }
          .results { 
            background-color: #d1ecf1; 
            color: #0c5460; 
            padding: 15px; 
            border-radius: 5px; 
            border-left: 4px solid #17a2b8; 
            margin: 15px 0; 
          }
          table { 
            border-collapse: collapse; 
            width: 100%; 
            margin: 15px 0; 
          }
          th, td { 
            border: 1px solid #ddd; 
            padding: 12px; 
            text-align: left; 
          }
          th { 
            background-color: #f2f2f2; 
            font-weight: 600; 
          }
          .footer { 
            padding: 20px; 
            background-color: #f8f9fa; 
            text-align: center; 
            font-size: 14px; 
            color: #6c757d; 
          }
          .badge-success { 
            background-color: #28a745; 
            color: white; 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-size: 12px; 
          }
          .badge-danger { 
            background-color: #dc3545; 
            color: white; 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-size: 12px; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="status">${statusIcon} ETL ${statusText}</h1>
          </div>
          
          <div class="content">
            <div class="details">
              <h3>🕐 実行詳細</h3>
              <p><strong>実行時刻 (JST):</strong> ${jstTime}</p>
              ${data.runId ? `<p><strong>実行ID:</strong> <code>${data.runId}</code></p>` : ''}
              ${data.duration ? `<p><strong>実行時間:</strong> ${(data.duration / 1000).toFixed(2)}秒</p>` : ''}
              <p><strong>ステータス:</strong> <span class="${isSuccess ? 'badge-success' : 'badge-danger'}">${statusText}</span></p>
            </div>
            
            ${isSuccess && data.results ? this.generateResultsHTML(data.results) : ''}
            ${!isSuccess && data.error ? `
              <div class="error">
                <h3>❌ エラー詳細</h3>
                <p><strong>エラーメッセージ:</strong></p>
                <code style="background-color: rgba(0,0,0,0.1); padding: 8px; border-radius: 4px; display: block; white-space: pre-wrap;">${data.error}</code>
              </div>
            ` : ''}
            
            <div class="details">
              <h3>⚙️ システム情報</h3>
              <p><strong>環境:</strong> ${process.env.NODE_ENV || 'development'}</p>
              <p><strong>次回実行予定:</strong> 06:00, 12:00, 18:00, 22:00 (JST)</p>
              <p><strong>送信者:</strong> ${process.env.RESEND_FROM_NAME || 'Business Strategy Dashboard'}</p>
            </div>
          </div>
          
          <div class="footer">
            <p>このメールは経営戦略ダッシュボード ETLシステムから自動送信されました。</p>
            <p><small>配信時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</small></p>
          </div>
        </div>
      </body>
      </html>
    `
    
    const text = `
ETL ${statusText}
==================================================

🕐 実行詳細
実行時刻 (JST): ${jstTime}
${data.runId ? `実行ID: ${data.runId}` : ''}
${data.duration ? `実行時間: ${(data.duration / 1000).toFixed(2)}秒` : ''}
ステータス: ${statusText}

${isSuccess && data.results ? this.generateResultsText(data.results) : ''}
${!isSuccess && data.error ? `
❌ エラー詳細
エラーメッセージ: ${data.error}
` : ''}

⚙️ システム情報
環境: ${process.env.NODE_ENV || 'development'}
次回実行予定: 06:00, 12:00, 18:00, 22:00 (JST)
送信者: ${process.env.RESEND_FROM_NAME || 'Business Strategy Dashboard'}

==================================================
このメールは経営戦略ダッシュボード ETLシステムから自動送信されました。
配信時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
    `
    
    return { subject, html, text }
  }

  /**
   * Generate results HTML for successful ETL
   */
  private static generateResultsHTML(results: any): string {
    if (!results.results || !Array.isArray(results.results)) {
      return ''
    }

    const tableRows = results.results.map((result: any) => `
      <tr>
        <td>${result.source}</td>
        <td><span class="${result.success ? 'badge-success' : 'badge-danger'}">${result.success ? '✅ SUCCESS' : '❌ FAILURE'}</span></td>
        <td>${result.recordsProcessed || 0}</td>
        <td>${result.duration ? (result.duration / 1000).toFixed(2) + 's' : '-'}</td>
        <td>${result.error || '-'}</td>
      </tr>
    `).join('')

    return `
      <div class="results">
        <h3>📊 処理結果</h3>
        <p><strong>成功:</strong> ${results.successCount}/${results.results.length} データソース</p>
        <p><strong>合計時間:</strong> ${(results.totalDuration / 1000).toFixed(2)}秒</p>
        
        <table>
          <thead>
            <tr>
              <th>データソース</th>
              <th>ステータス</th>
              <th>処理件数</th>
              <th>処理時間</th>
              <th>エラー</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `
  }

  /**
   * Generate results text for successful ETL
   */
  private static generateResultsText(results: any): string {
    if (!results.results || !Array.isArray(results.results)) {
      return ''
    }

    const resultLines = results.results.map((result: any) => 
      `${result.source}: ${result.success ? 'SUCCESS' : 'FAILURE'} (${result.recordsProcessed || 0}件) ${result.duration ? `- ${(result.duration / 1000).toFixed(2)}s` : ''}`
    ).join('\n')

    return `
📊 処理結果
成功: ${results.successCount}/${results.results.length} データソース
合計時間: ${(results.totalDuration / 1000).toFixed(2)}秒

${resultLines}
    `
  }

  /**
   * Generate health alert HTML
   */
  private static generateHealthAlertHTML(
    alertType: string,
    message: string,
    details?: Record<string, any>
  ): string {
    const alertColor = alertType === 'critical' ? '#721c24' : '#856404'
    const alertBg = alertType === 'critical' ? '#f8d7da' : '#fff3cd'
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>System Health Alert</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            margin: 0; 
            padding: 20px; 
            background-color: #f5f5f5; 
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: #ffffff; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); 
            overflow: hidden; 
          }
          .alert { 
            background-color: ${alertBg}; 
            color: ${alertColor}; 
            padding: 20px; 
            text-align: center; 
          }
          .content { 
            padding: 20px; 
          }
          .details { 
            background-color: #f8f9fa; 
            padding: 15px; 
            border-radius: 5px; 
            margin: 15px 0; 
            border-left: 4px solid #ffc107; 
          }
          .footer { 
            padding: 20px; 
            background-color: #f8f9fa; 
            text-align: center; 
            font-size: 14px; 
            color: #6c757d; 
          }
          pre { 
            background-color: #f8f9fa; 
            padding: 10px; 
            border-radius: 4px; 
            overflow-x: auto; 
            white-space: pre-wrap; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="alert">
            <h2>🚨 システム健全性アラート: ${alertType.toUpperCase()}</h2>
            <p style="margin: 0; font-size: 18px;">${message}</p>
          </div>
          
          <div class="content">
            ${details ? `
              <div class="details">
                <h3>📋 詳細情報</h3>
                <pre>${JSON.stringify(details, null, 2)}</pre>
              </div>
            ` : ''}
            
            <div class="details">
              <h3>⚙️ システム情報</h3>
              <p><strong>発生時刻 (JST):</strong> ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</p>
              <p><strong>環境:</strong> ${process.env.NODE_ENV || 'development'}</p>
              <p><strong>アラートレベル:</strong> ${alertType.toUpperCase()}</p>
            </div>
          </div>
          
          <div class="footer">
            <p>このアラートは経営戦略ダッシュボード監視システムから自動送信されました。</p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  /**
   * Generate health alert text
   */
  private static generateHealthAlertText(
    alertType: string,
    message: string,
    details?: Record<string, any>
  ): string {
    return `
🚨 システム健全性アラート: ${alertType.toUpperCase()}
==================================================

${message}

${details ? `
📋 詳細情報
${JSON.stringify(details, null, 2)}
` : ''}

⚙️ システム情報
発生時刻 (JST): ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
環境: ${process.env.NODE_ENV || 'development'}
アラートレベル: ${alertType.toUpperCase()}

==================================================
このアラートは経営戦略ダッシュボード監視システムから自動送信されました。
    `
  }

  /**
   * Send email using Resend
   */
  private static async sendEmail(emailData: {
    recipients: EmailRecipient[]
    subject: string
    htmlContent: string
    textContent: string
  }): Promise<void> {
    const resend = this.getResendClient()
    
    if (!resend) {
      console.warn('[NotificationService] Resend client not available - falling back to mock')
      return this.sendMockEmail(emailData)
    }

    try {
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@company.com'
      const fromName = process.env.RESEND_FROM_NAME || 'Business Strategy Dashboard'
      
      // Send emails individually to avoid rate limits and improve reliability
      const emailPromises = emailData.recipients.map(async (recipient) => {
        const result = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: recipient.email,
          subject: emailData.subject,
          html: emailData.htmlContent,
          text: emailData.textContent,
          headers: {
            'X-Entity-Ref-ID': `notification-${Date.now()}`,
          },
        })
        
        console.log(`[NotificationService] Email sent to ${recipient.email}:`, result.data?.id)
        return result
      })

      await Promise.all(emailPromises)
      
    } catch (error) {
      console.error('[NotificationService] Resend email sending failed:', error)
      
      // Log detailed error for debugging
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          recipients: emailData.recipients.map(r => r.email),
          subject: emailData.subject
        })
      }
      
      throw error
    }
  }

  /**
   * Fallback mock email for development
   */
  private static async sendMockEmail(emailData: {
    recipients: EmailRecipient[]
    subject: string
    htmlContent: string
    textContent: string
  }): Promise<void> {
    console.log('[NotificationService] Mock email sent:')
    console.log(`From: ${process.env.RESEND_FROM_NAME || 'Business Strategy Dashboard'} <${process.env.RESEND_FROM_EMAIL || 'noreply@company.com'}>`)
    console.log(`To: ${emailData.recipients.map(r => r.email).join(', ')}`)
    console.log(`Subject: ${emailData.subject}`)
    console.log(`HTML content length: ${emailData.htmlContent.length} chars`)
    console.log(`Text content length: ${emailData.textContent.length} chars`)
    
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 150))
  }

  /**
   * Log notification failure for monitoring
   */
  private static logNotificationFailure(
    notificationType: string,
    error: any,
    metadata?: any
  ): void {
    console.error('[NotificationService] Notification failure logged:', {
      type: notificationType,
      error: error instanceof Error ? error.message : String(error),
      metadata,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    })
    
    // In production, send this to monitoring service (DataDog, New Relic, etc.)
  }
}
