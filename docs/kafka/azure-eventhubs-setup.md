# ☁️ Azure Event Hubs as Apache Kafka Broker for EVNexus

## Overview
Azure Event Hubs provides an Apache Kafka 1.0+ compatible endpoint on port **9093**, allowing all existing Kafka Producers and Consumers in EVNexus (.NET, Java, Node.js, Python) to communicate with Azure natively without managing virtual machines, clusters, or Zookeeper/KRaft.

---

## Architecture

```text
┌─────────────────────────────────┐
│           Map Service           │
│       (Charging Sessions)       │
└────────────────┬────────────────┘
                 │
                 │ Produces to: evnexus.charging.sessions
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│        Azure Event Hubs Namespace (Kafka API Endpoint)          │
│              <namespace>.servicebus.windows.net:9093            │
│  ┌───────────────────────────┐   ┌───────────────────────────┐  │
│  │ evnexus.charging.sessions │   │   evnexus.payment.events  │  │
│  │       (3 Partitions)      │   │       (3 Partitions)      │  │
│  └───────────────────────────┘   └───────────────────────────┘  │
│  ┌───────────────────────────┐                                  │
│  │    evnexus.map.stations   │                                  │
│  │       (3 Partitions)      │                                  │
│  └───────────────────────────┘                                  │
└────────────────┬────────────────────────────────┬───────────────┘
                 │                                │
                 │ Consumes session events        │ Consumes payment & metrics
                 ▼                                ▼
┌─────────────────────────────────┐  ┌────────────────────────────┐
│         Payment Service         │  │Dashboard Analytics Service │
│    (Driver Wallet Deduction)    │  │  (Real-Time EV Metrics)    │
│  CG: evnexus-payment-group      │  │  CG: evnexus-dashboard-grp │
└────────────────┬────────────────┘  └────────────────────────────┘
                 │
                 │ Produces to: evnexus.payment.events
                 └────────────────────────────────┘
```

---

## Deployment Methods

### Method 1: GitHub Actions (Automated 1-Click)
1. Navigate to your GitHub repository: `https://github.com/HiruniPramodini/EVNexus/actions`.
2. Select the workflow **"Deploy Azure Event Hubs (Kafka Broker)"**.
3. Click **Run workflow** -> Select branch `feature/map-cicd-pipeline` or `main`.
4. Click **Run workflow**. Azure will provision the Namespace and topics in under 2 minutes.

---

### Method 2: Azure Cloud Shell (Bash / PowerShell)
Open [shell.azure.com](https://shell.azure.com) and run:

```bash
# 1. Clone repository or run script directly
curl -sL https://raw.githubusercontent.com/HiruniPramodini/EVNexus/feature/map-cicd-pipeline/Infrastructure/azure/eventhubs-kafka.bicep -o eventhubs-kafka.bicep

# 2. Deploy via Bicep
az deployment group create \
  --resource-group rg-evnexus-eastasia \
  --template-file eventhubs-kafka.bicep \
  --parameters namespaceName=evnexus-kafka-hub location=eastasia
```

---

### Method 3: Azure Portal (Manual GUI Setup)
1. Log in to [Azure Portal](https://portal.azure.com).
2. In the search bar, search for **Event Hubs** and click **Create**.
3. Fill in:
   - **Subscription:** Your active Azure Subscription
   - **Resource Group:** `rg-evnexus-eastasia` (or your existing group)
   - **Namespace name:** `evnexus-kafka-hub` (or your unique name)
   - **Location:** `East Asia` (recommended, same as Payment Service)
   - **Pricing Tier:** `Standard` *(Important: Standard tier is required for Kafka API)*
4. Click **Review + Create**, then **Create**.
5. Once created, click **Event Hubs** under *Entities* on the left sidebar:
   - Click **+ Event Hub** -> Name: `evnexus.charging.sessions` -> Partition Count: `3` -> Click **Create**.
   - Click **+ Event Hub** -> Name: `evnexus.payment.events` -> Partition Count: `3` -> Click **Create**.
   - Click **+ Event Hub** -> Name: `evnexus.map.stations` -> Partition Count: `3` -> Click **Create**.
6. Under **Shared access policies**, click **RootManageSharedAccessKey** and copy the **Connection string-primary key**.

---

## Microservices Connection Configuration

### .NET (PaymentService & MapService) - `appsettings.json`
```json
{
  "Kafka": {
    "BootstrapServers": "evnexus-kafka-hub.servicebus.windows.net:9093",
    "SecurityProtocol": "SaslSsl",
    "SaslMechanism": "Plain",
    "SaslUsername": "$ConnectionString",
    "SaslPassword": "Endpoint=sb://evnexus-kafka-hub.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=YOUR_AZURE_KEY",
    "Topics": {
      "ChargingSessions": "evnexus.charging.sessions",
      "PaymentEvents": "evnexus.payment.events",
      "MapStations": "evnexus.map.stations"
    },
    "ConsumerGroups": {
      "Payment": "evnexus-payment-group",
      "Dashboard": "evnexus-dashboard-group"
    }
  }
}
```

### Environment Variables for Docker / Azure Container Apps
```bash
KAFKA_BOOTSTRAP_SERVERS=evnexus-kafka-hub.servicebus.windows.net:9093
KAFKA_SECURITY_PROTOCOL=SASL_SSL
KAFKA_SASL_MECHANISM=PLAIN
KAFKA_SASL_USERNAME=$ConnectionString
KAFKA_SASL_PASSWORD=Endpoint=sb://evnexus-kafka-hub.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=YOUR_AZURE_KEY
```

---

## Verification & Health Check
You can test event publication from any machine using `kcat` or standard Kafka command line:
```bash
# Test topic listing
kcat -b evnexus-kafka-hub.servicebus.windows.net:9093 \
     -X security.protocol=SASL_SSL \
     -X sasl.mechanisms=PLAIN \
     -X sasl.username='$ConnectionString' \
     -X sasl.password='<CONNECTION_STRING>' \
     -L
```
