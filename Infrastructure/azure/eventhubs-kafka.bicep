@description('Name of the Azure Event Hubs Namespace (Kafka cluster)')
param namespaceName string = 'evnexus-kafka-${uniqueString(resourceGroup().id)}'

@description('Azure Region / Location for the deployment')
param location string = resourceGroup().location

@description('SKU tier for Event Hubs. Standard is required for Apache Kafka support.')
@allowed([
  'Standard'
  'Premium'
])
param skuTier string = 'Standard'

@description('Messaging partitions count for high-throughput event streaming')
param partitionCount int = 3

@description('Message retention in days')
param messageRetentionInDays int = 1

// -------------------------------------------------------------
// 1. Event Hubs Namespace (Kafka Cluster with Kafka 1.0+ API)
// -------------------------------------------------------------
resource eventHubsNamespace 'Microsoft.EventHub/namespaces@2022-10-01-preview' = {
  name: namespaceName
  location: location
  sku: {
    name: skuTier
    tier: skuTier
    capacity: 1
  }
  properties: {
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
    zoneRedundant: false
    kafkaEnabled: true // Explicitly enable Kafka protocol on port 9093
  }
}

// -------------------------------------------------------------
// 2. Kafka Topics (Event Hubs)
// -------------------------------------------------------------

// Topic 1: evnexus.charging.sessions (Published by MapService, consumed by PaymentService & DashboardService)
resource topicChargingSessions 'Microsoft.EventHub/namespaces/eventhubs@2022-10-01-preview' = {
  parent: eventHubsNamespace
  name: 'evnexus.charging.sessions'
  properties: {
    messageRetentionInDays: messageRetentionInDays
    partitionCount: partitionCount
    status: 'Active'
  }
}

// Topic 2: evnexus.payment.events (Published by PaymentService, consumed by DashboardService)
resource topicPaymentEvents 'Microsoft.EventHub/namespaces/eventhubs@2022-10-01-preview' = {
  parent: eventHubsNamespace
  name: 'evnexus.payment.events'
  properties: {
    messageRetentionInDays: messageRetentionInDays
    partitionCount: partitionCount
    status: 'Active'
  }
}

// Topic 3: evnexus.map.stations (Published by MapService, consumed by DashboardService)
resource topicMapStations 'Microsoft.EventHub/namespaces/eventhubs@2022-10-01-preview' = {
  parent: eventHubsNamespace
  name: 'evnexus.map.stations'
  properties: {
    messageRetentionInDays: messageRetentionInDays
    partitionCount: partitionCount
    status: 'Active'
  }
}

// -------------------------------------------------------------
// 3. Kafka Consumer Groups
// -------------------------------------------------------------
resource cgPaymentService 'Microsoft.EventHub/namespaces/eventhubs/consumergroups@2022-10-01-preview' = {
  parent: topicChargingSessions
  name: 'evnexus-payment-group'
}

resource cgDashboardCharging 'Microsoft.EventHub/namespaces/eventhubs/consumergroups@2022-10-01-preview' = {
  parent: topicChargingSessions
  name: 'evnexus-dashboard-group'
}

resource cgDashboardPayment 'Microsoft.EventHub/namespaces/eventhubs/consumergroups@2022-10-01-preview' = {
  parent: topicPaymentEvents
  name: 'evnexus-dashboard-group'
}

// -------------------------------------------------------------
// 4. Kafka Shared Access Policy (Authorization Rule)
// -------------------------------------------------------------
resource kafkaAuthRule 'Microsoft.EventHub/namespaces/authorizationRules@2022-10-01-preview' = {
  parent: eventHubsNamespace
  name: 'evnexus-kafka-policy'
  properties: {
    rights: [
      'Manage'
      'Send'
      'Listen'
    ]
  }
}

// -------------------------------------------------------------
// Outputs
// -------------------------------------------------------------
output eventHubsNamespaceName string = eventHubsNamespace.name
output kafkaBootstrapServer string = '${eventHubsNamespace.name}.servicebus.windows.net:9093'
output kafkaConnectionString string = listKeys(kafkaAuthRule.id, eventHubsNamespace.apiVersion).primaryConnectionString
