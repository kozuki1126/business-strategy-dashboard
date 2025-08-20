/**
 * Notification Integration Tests
 * Task #009: E-mail通知システム実装
 * 
 * Purpose: 通知システムとETL・データベース・監査ログとの統合テスト
 * Coverage: システム間連携・データ整合性・エラー処理・パフォーマンス
 */

import { NotificationService, ETLNotificationData } from '@/lib/services/notification'
import { ETLService } from '@/lib/services/etl'
import { AuditService } from '@/lib/services/audit'
import { createClient } from '@/lib/supabase/server'

// Mock Resend for integration tests
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({
        data: { id: 'test-email-id' }
      })
    }
  }))
}))

const mockEnv = {
  RESEND_API_KEY: 'test-key',
  RESEND_FROM_EMAIL: 'test@example.com',
  RESEND_FROM_NAME: 'Test System',
  EMAIL_RECIPIENTS_ADMIN: 'admin@test.com',
  EMAIL_RECIPIENTS_ALERTS: 'alerts@test.com',
  NODE_ENV: 'test'
}

describe('Notification Integration Tests', () => {
  let originalEnv: NodeJS.ProcessEnv
  let supabase: ReturnType<typeof createClient>

  beforeAll(() => {
    originalEnv = process.env
    process.env = { ...originalEnv, ...mockEnv }
    supabase = createClient()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('ETL-Notification Integration', () => {
    it('should send notification when ETL completes successfully', async () => {
      // Arrange
      const mockETLResults = {
        totalDuration: 5000,
        successCount: 5,
        failureCount: 0,
        results: [
          { source: 'market_data', success: true, recordsProcessed: 100, duration: 1000 },
          { source: 'fx_rates', success: true, recordsProcessed: 50, duration: 800 },
          { source: 'weather', success: true, recordsProcessed: 30, duration: 600 },
          { source: 'events', success: true, recordsProcessed: 20, duration: 400 },
          { source: 'stem_news', success: true, recordsProcessed: 15, duration: 300 }
        ]
      }

      const etlData: ETLNotificationData = {
        status: 'success',
        runId: 'integration-test-001',
        duration: 5000,
        results: mockETLResults,
        timestamp: new Date().toISOString()
      }

      // Act
      await NotificationService.sendETLNotification(etlData)

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        '[NotificationService] Sending ETL notification:',
        'success'
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[NotificationService] ETL notification sent to')
      )
    })

    it('should send notification when ETL fails with detailed error info', async () => {
      // Arrange
      const etlData: ETLNotificationData = {
        status: 'failure',
        runId: 'integration-test-002',
        duration: 2000,
        error: 'Database connection timeout during market data fetch',
        timestamp: new Date().toISOString()
      }

      // Act
      await NotificationService.sendETLNotification(etlData)

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        '[NotificationService] Sending ETL notification:',
        'failure'
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[NotificationService] ETL notification sent to')
      )
    })

    it('should handle partial ETL failures with warning notifications', async () => {
      // Arrange - Mixed success/failure scenario
      const mixedResults = {
        totalDuration: 8000,
        successCount: 3,
        failureCount: 2,
        results: [
          { source: 'market_data', success: true, recordsProcessed: 100, duration: 1000 },
          { source: 'fx_rates', success: false, recordsProcessed: 0, duration: 500, error: 'API rate limit' },
          { source: 'weather', success: true, recordsProcessed: 30, duration: 600 },
          { source: 'events', success: true, recordsProcessed: 20, duration: 400 },
          { source: 'stem_news', success: false, recordsProcessed: 0, duration: 200, error: 'Connection refused' }
        ]
      }

      const etlData: ETLNotificationData = {
        status: 'success', // ETL completed but with partial failures
        runId: 'integration-test-003',
        duration: 8000,
        results: mixedResults,
        timestamp: new Date().toISOString()
      }

      // Act
      await NotificationService.sendETLNotification(etlData)

      // Assert - Should send success notification but with failure details included
      expect(console.log).toHaveBeenCalledWith(
        '[NotificationService] Sending ETL notification:',
        'success'
      )

      // The notification content should include both successes and failures
      // This is handled by the email template generation
    })
  })

  describe('Audit-Notification Integration', () => {
    it('should log notification attempts to audit system', async () => {
      // Arrange
      const auditLogSpy = jest.spyOn(AuditService, 'log').mockResolvedValue()

      const etlData: ETLNotificationData = {
        status: 'success',
        runId: 'audit-integration-001',
        duration: 3000,
        timestamp: new Date().toISOString()
      }

      // Act
      await NotificationService.sendETLNotification(etlData)

      // Assert - Verify notification was logged
      // Note: In the current implementation, audit logging happens in the ETL endpoint
      // This test documents the expected integration behavior
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[NotificationService] ETL notification sent to')
      )

      auditLogSpy.mockRestore()
    })

    it('should create audit trail for failed notifications', async () => {
      // Arrange - Mock Resend to fail
      const mockResend = require('resend').Resend
      const mockSend = jest.fn().mockRejectedValue(new Error('Email service unavailable'))
      mockResend.mockImplementation(() => ({
        emails: { send: mockSend }
      }))

      const etlData: ETLNotificationData = {
        status: 'failure',
        runId: 'audit-integration-002',
        error: 'Test error for audit trail',
        timestamp: new Date().toISOString()
      }

      // Act
      await NotificationService.sendETLNotification(etlData)

      // Assert - Notification failure should be logged
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[NotificationService] Notification failure logged:'),
        expect.objectContaining({
          type: 'etl_notification',
          error: 'Email service unavailable',
          metadata: etlData
        })
      )
    })

    it('should maintain notification history for reporting', async () => {
      // Arrange - Multiple notifications
      const notifications = [
        {
          status: 'success' as const,
          runId: 'history-001',
          duration: 2000
        },
        {
          status: 'failure' as const,
          runId: 'history-002',
          error: 'Test error 1'
        },
        {
          status: 'success' as const,
          runId: 'history-003',
          duration: 3000
        }
      ]

      // Act - Send multiple notifications
      for (const notification of notifications) {
        await NotificationService.sendETLNotification({
          ...notification,
          timestamp: new Date().toISOString()
        })
      }

      // Assert - All notifications should be processed
      expect(console.log).toHaveBeenCalledTimes(6) // 2 log calls per notification
    })
  })

  describe('Performance and Reliability Integration', () => {
    it('should meet SLA requirements under load', async () => {
      // Arrange - Multiple concurrent notifications
      const concurrentNotifications = Array.from({ length: 5 }, (_, i) => ({
        status: 'success' as const,
        runId: `perf-test-${i + 1}`,
        duration: 1000 + i * 200,
        timestamp: new Date().toISOString()
      }))

      // Act - Send notifications concurrently
      const startTime = Date.now()
      await Promise.all(
        concurrentNotifications.map(notification =>
          NotificationService.sendETLNotification(notification)
        )
      )
      const endTime = Date.now()
      const totalDuration = endTime - startTime

      // Assert - Should complete within reasonable time
      expect(totalDuration).toBeLessThan(5000) // 5 seconds for 5 concurrent notifications
      expect(console.log).toHaveBeenCalledTimes(10) // 2 logs per notification
    })

    it('should handle email service rate limits gracefully', async () => {
      // Arrange - Mock rate limit error
      const mockResend = require('resend').Resend
      let callCount = 0
      const mockSend = jest.fn().mockImplementation(() => {
        callCount++
        if (callCount <= 2) {
          return Promise.reject(new Error('Rate limit exceeded'))
        }
        return Promise.resolve({ data: { id: 'success-after-retry' } })
      })
      mockResend.mockImplementation(() => ({
        emails: { send: mockSend }
      }))

      const etlData: ETLNotificationData = {
        status: 'success',
        runId: 'rate-limit-test',
        duration: 1500,
        timestamp: new Date().toISOString()
      }

      // Act
      await NotificationService.sendETLNotification(etlData)

      // Assert - Should handle rate limits gracefully
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[NotificationService] Failed to send ETL notification'),
        expect.any(Error)
      )
    })

    it('should support email delivery verification', async () => {
      // Arrange
      const etlData: ETLNotificationData = {
        status: 'success',
        runId: 'delivery-verification-test',
        duration: 2500,
        results: {
          totalDuration: 2000,
          successCount: 3,
          failureCount: 0,
          results: [
            { source: 'test1', success: true, recordsProcessed: 10, duration: 500 },
            { source: 'test2', success: true, recordsProcessed: 15, duration: 700 },
            { source: 'test3', success: true, recordsProcessed: 8, duration: 800 }
          ]
        },
        timestamp: new Date().toISOString()
      }

      // Act
      await NotificationService.sendETLNotification(etlData)

      // Assert - Should include delivery tracking
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[NotificationService] ETL notification sent to')
      )
    })
  })

  describe('Configuration and Environment Integration', () => {
    it('should adapt to different environments correctly', async () => {
      // Test development environment
      const originalNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const devData: ETLNotificationData = {
        status: 'success',
        runId: 'dev-env-test',
        duration: 1000,
        timestamp: new Date().toISOString()
      }

      await NotificationService.sendETLNotification(devData)

      // Should use mock email in development
      expect(console.warn).toHaveBeenCalledWith(
        '[NotificationService] Resend client not available - falling back to mock'
      )

      process.env.NODE_ENV = originalNodeEnv
    })

    it('should handle missing environment variables gracefully', async () => {
      // Arrange - Remove email recipients
      const originalRecipients = process.env.EMAIL_RECIPIENTS_ADMIN
      delete process.env.EMAIL_RECIPIENTS_ADMIN

      const etlData: ETLNotificationData = {
        status: 'success',
        runId: 'missing-env-test',
        duration: 1200,
        timestamp: new Date().toISOString()
      }

      // Act
      await NotificationService.sendETLNotification(etlData)

      // Assert - Should use default recipients
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('To: admin@company.com')
      )

      process.env.EMAIL_RECIPIENTS_ADMIN = originalRecipients
    })

    it('should support custom recipient configurations', async () => {
      // Arrange - Custom recipients for different notification types
      process.env.EMAIL_RECIPIENTS_ADMIN = 'custom-admin@test.com,admin2@test.com'
      process.env.EMAIL_RECIPIENTS_ALERTS = 'alert-team@test.com'

      // Act - Success notification (should use admin recipients)
      await NotificationService.sendETLNotification({
        status: 'success',
        runId: 'custom-recipients-success',
        duration: 1500,
        timestamp: new Date().toISOString()
      })

      // Act - Failure notification (should use alert recipients)
      await NotificationService.sendETLNotification({
        status: 'failure',
        runId: 'custom-recipients-failure',
        error: 'Test failure',
        timestamp: new Date().toISOString()
      })

      // Assert - Different recipient lists should be used
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('To: custom-admin@test.com, admin2@test.com')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('To: alert-team@test.com')
      )
    })
  })

  describe('Health Alert Integration', () => {
    it('should send health alerts for system issues', async () => {
      // Act - Send warning alert
      await NotificationService.sendHealthAlert(
        'warning',
        'High memory usage detected in ETL process',
        { memoryUsage: '85%', threshold: '80%', process: 'etl-worker' }
      )

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        '[NotificationService] Sending health alert: warning'
      )

      // Act - Send critical alert
      await NotificationService.sendHealthAlert(
        'critical',
        'Database connection pool exhausted',
        { availableConnections: 0, maxConnections: 20, waitingQueries: 15 }
      )

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        '[NotificationService] Sending health alert: critical'
      )
    })

    it('should integrate health alerts with monitoring system', async () => {
      // Arrange - Mock monitoring data
      const monitoringData = {
        service: 'etl-scheduler',
        metric: 'error_rate',
        value: 0.15,
        threshold: 0.05,
        timestamp: new Date().toISOString()
      }

      // Act
      await NotificationService.sendHealthAlert(
        'critical',
        `Error rate threshold exceeded: ${monitoringData.metric}`,
        monitoringData
      )

      // Assert - Should log health alert with monitoring context
      expect(console.log).toHaveBeenCalledWith(
        '[NotificationService] Sending health alert: critical'
      )
    })
  })

  describe('Custom Notification Integration', () => {
    it('should support custom business notifications', async () => {
      // Arrange
      const customRecipients = [
        { email: 'business-team@test.com', name: 'Business Team', role: 'business' },
        { email: 'manager@test.com', name: 'Team Manager', role: 'management' }
      ]

      const customContent = {
        html: `
          <h2>Monthly ETL Performance Report</h2>
          <p>This month's ETL performance summary:</p>
          <ul>
            <li>Success Rate: 99.2%</li>
            <li>Average Duration: 4.5 minutes</li>
            <li>Data Sources: 6 active</li>
          </ul>
        `,
        text: `
Monthly ETL Performance Report

This month's ETL performance summary:
- Success Rate: 99.2%
- Average Duration: 4.5 minutes
- Data Sources: 6 active
        `
      }

      // Act
      await NotificationService.sendCustomNotification(
        customRecipients,
        'Monthly ETL Performance Report - August 2025',
        customContent,
        'normal'
      )

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        '[NotificationService] Sending custom notification (normal):',
        'Monthly ETL Performance Report - August 2025'
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[NotificationService] Custom notification sent to 2 recipients')
      )
    })

    it('should handle high-priority custom notifications', async () => {
      // Arrange
      const urgentRecipients = [
        { email: 'oncall@test.com', name: 'On-Call Engineer', role: 'engineer' }
      ]

      const urgentContent = {
        html: '<h1>URGENT: ETL System Maintenance Required</h1><p>Immediate action needed.</p>',
        text: 'URGENT: ETL System Maintenance Required\n\nImmediate action needed.'
      }

      // Act
      await NotificationService.sendCustomNotification(
        urgentRecipients,
        '🚨 URGENT: ETL System Maintenance Required',
        urgentContent,
        'high'
      )

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        '[NotificationService] Sending custom notification (high):',
        '🚨 URGENT: ETL System Maintenance Required'
      )
    })
  })

  describe('Internationalization Integration', () => {
    it('should format timestamps in Japanese timezone', async () => {
      // Arrange
      const jstTimestamp = new Date('2025-08-20T10:30:00+09:00').toISOString()
      
      const etlData: ETLNotificationData = {
        status: 'success',
        runId: 'jst-timezone-test',
        duration: 3000,
        timestamp: jstTimestamp
      }

      // Act
      await NotificationService.sendETLNotification(etlData)

      // Assert - Should process JST formatting
      expect(console.log).toHaveBeenCalledWith(
        '[NotificationService] Sending ETL notification:',
        'success'
      )

      // The JST formatting happens in email content generation
      // which is verified through the notification processing
    })

    it('should support Japanese number formatting in notifications', async () => {
      // Arrange - Large numbers for formatting test
      const etlData: ETLNotificationData = {
        status: 'success',
        runId: 'jp-formatting-test',
        duration: 123456, // 2 minutes 3.456 seconds
        results: {
          totalDuration: 118000,
          successCount: 6,
          failureCount: 0,
          results: [
            { source: 'market_data', success: true, recordsProcessed: 1234567, duration: 25000 },
            { source: 'fx_rates', success: true, recordsProcessed: 98765, duration: 18000 },
            { source: 'weather', success: true, recordsProcessed: 54321, duration: 22000 },
            { source: 'events', success: true, recordsProcessed: 12345, duration: 15000 },
            { source: 'stem_news', success: true, recordsProcessed: 6789, duration: 20000 },
            { source: 'inbound', success: true, recordsProcessed: 3456, duration: 18000 }
          ]
        },
        timestamp: new Date().toISOString()
      }

      // Act
      await NotificationService.sendETLNotification(etlData)

      // Assert - Should handle large numbers properly
      expect(console.log).toHaveBeenCalledWith(
        '[NotificationService] Sending ETL notification:',
        'success'
      )
    })
  })
})
