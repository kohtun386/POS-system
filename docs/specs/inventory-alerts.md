# Inventory Alert System

**Last updated:** 2026-07-15 (aligned with VISION.md v3.1.0 Simplified Inventory)

> **Tier requirement:** Low stock alerts and inventory tracking features are **Growth+ tier** only (VISION.md §10.4). Free tier shops can toggle `track_inventory` for basic stock counts but do not receive alerts. Purchase Log and Stock Overview are also Growth+ features (VISION.md v3.1.0 §10.2). See [VISION.md §10](../vision/VISION.md) for full tier gating details.

This document describes the comprehensive inventory alert system implemented for the POS system, providing automated email and SMS notifications for various inventory conditions.

## 🎯 Features

### Core Functionality

- **Low Stock Alerts**: Notify when inventory falls below minimum threshold
- **Out of Stock Alerts**: Immediate notifications when inventory reaches zero
- **Reorder Point Alerts**: Notifications when inventory reaches reorder point
- **Expiry Warnings**: Alerts for products nearing expiration
- **Batch Expiry**: Notifications for expiring product batches

### Alert Management

- **Multiple Recipients**: Support for multiple alert recipients with different roles
- **Customizable Templates**: Email and SMS templates with variable substitution
- **Configurable Thresholds**: Adjustable alert thresholds and cooldown periods
- **Alert History**: Complete tracking of all sent alerts
- **Service Integration**: Support for multiple email/SMS providers

## 🏗️ Architecture

### Database Schema

The system uses the following main tables:

- `alert_recipients`: Stores recipient information and alert preferences
- `alert_templates`: Email and SMS message templates
- `alert_configurations`: Alert type settings and thresholds
- `alert_history`: Complete audit trail of all alerts
- `alert_schedules`: Scheduling information for automated checks
- `notification_service_config`: Email/SMS service configurations

### Core Components

#### 1. Alert Service (`src/lib/alertService.ts`)

Main service class that handles:

- Inventory level checking
- Alert processing and sending
- Template processing with variable substitution
- Cooldown management
- Service integration (SendGrid, Twilio, AWS SES)

#### 2. Database Services (`src/lib/services.ts`)

Service functions for:

- Alert recipients management
- Template management
- Configuration management
- Alert history tracking
- Service configuration management

#### 3. UI Components

- `AlertManager`: Main management interface
- `RecipientModal`: Add/edit alert recipients
- `TemplateModal`: Create/edit alert templates
- `ConfigurationCard`: Configure alert settings
- `ServiceModal`: Manage notification services

#### 4. Alert Scheduler (`src/lib/alertScheduler.ts`)

- Automated alert checking
- Configurable intervals
- Manual check capabilities

## 🚀 Setup Instructions

### 1. Database Setup

Run the SQL migration to create the alert system tables:

```sql
-- Migration: supabase/migrations/20260703000001_inventory_alerts_schema.sql
-- Applied automatically via `supabase db push` or branch creation
```

### 2. Service Configuration

Configure your email/SMS services through the UI or directly in the database:

#### SendGrid (Email)

```json
{
  "serviceName": "sendgrid",
  "serviceType": "email",
  "configData": {
    "apiKey": "your-sendgrid-api-key",
    "fromEmail": "alerts@yourstore.com"
  },
  "isActive": true,
  "isDefault": true
}
```

#### Twilio (SMS)

```json
{
  "serviceName": "twilio",
  "serviceType": "sms",
  "configData": {
    "accountSid": "your-twilio-account-sid",
    "authToken": "your-twilio-auth-token",
    "fromNumber": "+1234567890"
  },
  "isActive": true,
  "isDefault": true
}
```

### 3. Default Templates

The system comes with pre-configured templates for common alert types. You can customize these through the UI.

### 4. Integration

Add the alert scheduler to your main application:

```tsx
import { useAlertScheduler } from './lib/alertScheduler';

function App() {
  // Run alert checks every 30 minutes
  useAlertScheduler(30);

  return (
    // Your app components
  );
}
```

## 📋 Usage Guide

### Managing Recipients

1. Navigate to **Inventory Alerts > Recipients**
2. Click **Add Recipient**
3. Fill in contact information and select alert types
4. Set role and active status

### Creating Templates

1. Go to **Inventory Alerts > Templates**
2. Click **Add Template**
3. Select alert type and channel (email/SMS)
4. Use variables like `{{product_name}}`, `{{current_stock}}`, etc.
5. Preview the template before saving

### Configuring Alerts

1. Visit **Inventory Alerts > Configuration**
2. Enable/disable alert types
3. Adjust thresholds and frequencies
4. Set cooldown periods to prevent spam

### Monitoring Alerts

1. Check **Inventory Alerts > History** for sent alerts
2. Use **Overview** tab for system status
3. Run manual checks as needed

## 🔧 Configuration Options

### Alert Types

| Alert Type | Trigger Condition | Min Tier |
|------------|-------------------|----------|
| **Low Stock** | `current_stock <= min_stock * threshold_percentage` | Growth+ |
| **Out of Stock** | `current_stock = 0` | Growth+ |
| **Reorder Point** | `current_stock <= min_stock` | Growth+ |
| **Expiry Warning** | Based on product expiry dates | Growth+ |
| **Batch Expiry** | Based on batch expiry dates | Growth+ |

**Free tier:** Basic stock count tracking only (if `track_inventory` enabled). No alerts.

### Threshold Settings

- **Check Frequency**: How often to check inventory (minutes)
- **Cooldown Period**: Minimum time between alerts for same product (minutes)
- **Threshold Value**: Percentage of min_stock for low stock alerts

### Template Variables

Available variables for templates:

- `{{product_name}}` - Product name
- `{{product_sku}}` - Product SKU
- `{{product_category}}` - Product category
- `{{current_stock}}` - Current stock level
- `{{min_stock}}` - Minimum stock level
- `{{recipient_name}}` - Recipient name
- `{{store_name}}` - Store name
- `{{alert_type}}` - Type of alert
- `{{threshold_value}}` - Threshold percentage

## 🔒 Security Considerations

### API Keys

- Store service API keys securely
- Use environment variables for sensitive data
- Regularly rotate API keys

### Access Control

- Alert management restricted to admin/manager roles (not cashier)
- `platform_admin` bypasses RLS via Edge Functions (VISION.md §4.3)
- `shop_memberships.role` is the canonical authorization source
- Audit alert history regularly

### Data Privacy

- Ensure recipient contact information is protected
- Comply with email/SMS regulations (CAN-SPAM, TCPA)
- Implement opt-out mechanisms

## 🐛 Troubleshooting

### Common Issues

#### Alerts Not Sending

1. Check service configuration is active
2. Verify API keys are correct
3. Ensure recipients have valid contact information
4. Check alert configurations are enabled

#### Template Variables Not Working

1. Verify variable syntax: `{{variable_name}}`
2. Check template is active
3. Ensure template matches alert type

#### High Alert Volume

1. Increase cooldown periods
2. Adjust threshold values
3. Review alert configurations
4. Check for duplicate recipients

### Debugging

Enable console logging to see alert processing:

```javascript
// Check browser console for alert processing logs
console.log("Alert check results:", results);
```

## 📈 Performance Considerations

### Database Optimization

- Indexes are created on frequently queried columns
- Use pagination for alert history
- Regular cleanup of old alert history

### Service Limits

- Respect email/SMS service rate limits
- Implement retry logic for failed sends
- Monitor service usage and costs

### Scalability

- Consider using message queues for high-volume systems
- Implement caching for frequently accessed data
- Use background jobs for alert processing

## 🔄 Future Enhancements

### Planned Features

- **Webhook Support**: Real-time inventory updates
- **Advanced Scheduling**: Custom alert schedules
- **Analytics Dashboard**: Alert performance metrics
- **Multi-language Support**: Localized templates
- **Mobile App Integration**: Push notifications

### Integration Opportunities

- **ERP Systems**: Sync with external inventory systems
- **Supplier Portals**: Automatic reorder requests
- **Analytics Platforms**: Alert performance tracking
- **CRM Systems**: Customer notification integration

## 📞 Support

For technical support or feature requests, please refer to the main project documentation or contact the development team.

---

**Note**: This alert system is designed to be highly configurable and extensible. The modular architecture allows for easy addition of new alert types, notification channels, and service providers.
