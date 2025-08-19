/**
 * Notification Service
 * Task #008: ETL スケジューラ実装
 * 
 * Purpose: ETL成功・失敗のE-mail通知システム
 * Features:
 * - ETL実行結果の自動通知
 * - HTML・テキスト形式メール
 * - エラーレポート・詳細情報
 * - 5分以内通知保証
 */

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

export class NotificationService {
  private static readonly DEFAULT_RECIPIENTS: EmailRecipient[] = [
    { email: 'admin@company.com', name: 'System Admin', role: 'admin' },
    { email: 'dev@company.com', name: 'Development Team', role: 'dev' }
  ]

  /**
   * Send ETL notification email
   */
  static async sendETLNotification(data: ETLNotificationData): Promise<void> {
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

      console.log(`[NotificationService] ETL notification sent to ${recipients.length} recipients`)
    } catch (error) {
      console.error('[NotificationService] Failed to send ETL notification:', error)
      // Don't throw error to avoid breaking ETL flow
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
    try {
      console.log(`[NotificationService] Sending health alert: ${alertType}`)
      
      const recipients = this.getNotificationRecipients('failure') // Use failure recipients for alerts
      
      await this.sendEmail({
        recipients,
        subject: `🚨 System Health Alert: ${alertType.toUpperCase()}`,
        htmlContent: this.generateHealthAlertHTML(alertType, message, details),
        textContent: this.generateHealthAlertText(alertType, message, details)
      })

      console.log(`[NotificationService] Health alert sent to ${recipients.length} recipients`)
    } catch (error) {
      console.error('[NotificationService] Failed to send health alert:', error)
    }
  }

  /**
   * Get notification recipients based on event type
   */
  private static getNotificationRecipients(eventType: string): EmailRecipient[] {
    // For now, return default recipients
    // In production, this could be configured per event type or role
    return this.DEFAULT_RECIPIENTS
  }

  /**
   * Generate ETL email content
   */
  private static generateETLEmailContent(data: ETLNotificationData): {
    subject: string
    html: string
    text: string
  } {
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
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { background-color: ${isSuccess ? '#d4edda' : '#f8d7da'}; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .status { font-size: 24px; font-weight: bold; color: ${isSuccess ? '#155724' : '#721c24'}; }
          .details { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; }
          .error { background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 5px; }
          .results { background-color: #d1ecf1; color: #0c5460; padding: 10px; border-radius: 5px; }
          table { border-collapse: collapse; width: 100%; margin: 10px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="status">${statusIcon} ETL ${statusText}</div>
        </div>
        
        <div class="details">
          <h3>実行詳細</h3>
          <p><strong>実行時刻 (JST):</strong> ${jstTime}</p>
          ${data.runId ? `<p><strong>実行ID:</strong> ${data.runId}</p>` : ''}
          ${data.duration ? `<p><strong>実行時間:</strong> ${(data.duration / 1000).toFixed(2)}秒</p>` : ''}
        </div>
        
        ${isSuccess && data.results ? this.generateResultsHTML(data.results) : ''}
        ${!isSuccess && data.error ? `<div class="error"><h3>エラー詳細</h3><p>${data.error}</p></div>` : ''}
        
        <div class="details">
          <h3>システム情報</h3>
          <p><strong>環境:</strong> ${process.env.NODE_ENV || 'development'}</p>
          <p><strong>次回実行予定:</strong> 06:00, 12:00, 18:00, 22:00 (JST)</p>
        </div>
        
        <p><small>このメールは経営戦略ダッシュボード ETLシステムから自動送信されました。</small></p>
      </body>
      </html>
    `
    
    const text = `
ETL ${statusText}

実行時刻 (JST): ${jstTime}
${data.runId ? `実行ID: ${data.runId}` : ''}
${data.duration ? `実行時間: ${(data.duration / 1000).toFixed(2)}秒` : ''}

${isSuccess && data.results ? this.generateResultsText(data.results) : ''}
${!isSuccess && data.error ? `エラー詳細: ${data.error}` : ''}

環境: ${process.env.NODE_ENV || 'development'}
次回実行予定: 06:00, 12:00, 18:00, 22:00 (JST)

このメールは経営戦略ダッシュボード ETLシステムから自動送信されました。
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
        <td>${result.success ? '✅' : '❌'}</td>
        <td>${result.recordsProcessed || 0}</td>
        <td>${result.duration ? (result.duration / 1000).toFixed(2) + 's' : '-'}</td>
        <td>${result.error || '-'}</td>
      </tr>
    `).join('')

    return `
      <div class="results">
        <h3>処理結果</h3>
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
      `${result.source}: ${result.success ? 'SUCCESS' : 'FAILURE'} (${result.recordsProcessed || 0}件)`
    ).join('\n')

    return `
処理結果:
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
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .alert { background-color: ${alertBg}; color: ${alertColor}; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .details { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="alert">
          <h2>🚨 システム健全性アラート: ${alertType.toUpperCase()}</h2>
          <p>${message}</p>
        </div>
        
        ${details ? `<div class="details"><h3>詳細情報</h3><pre>${JSON.stringify(details, null, 2)}</pre></div>` : ''}
        
        <div class="details">
          <p><strong>発生時刻 (JST):</strong> ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</p>
          <p><strong>環境:</strong> ${process.env.NODE_ENV || 'development'}</p>
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
システム健全性アラート: ${alertType.toUpperCase()}

${message}

${details ? `詳細情報:\n${JSON.stringify(details, null, 2)}` : ''}

発生時刻 (JST): ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
環境: ${process.env.NODE_ENV || 'development'}
    `
  }

  /**
   * Send email (mock implementation - replace with actual email service)
   */
  private static async sendEmail(emailData: {
    recipients: EmailRecipient[]
    subject: string
    htmlContent: string
    textContent: string
  }): Promise<void> {
    try {
      // Mock implementation for now
      // Replace with actual email service (Resend, SendGrid, etc.)
      
      console.log('[NotificationService] Mock email sent:')
      console.log(`To: ${emailData.recipients.map(r => r.email).join(', ')}`)
      console.log(`Subject: ${emailData.subject}`)
      console.log('Content length:', emailData.htmlContent.length)
      
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // In production, replace with:
      /*
      const resend = new Resend(process.env.RESEND_API_KEY)
      
      for (const recipient of emailData.recipients) {
        await resend.emails.send({
          from: 'noreply@company.com',
          to: recipient.email,
          subject: emailData.subject,
          html: emailData.htmlContent,
          text: emailData.textContent
        })
      }
      */
      
    } catch (error) {
      console.error('[NotificationService] Email sending failed:', error)
      throw error
    }
  }
}
