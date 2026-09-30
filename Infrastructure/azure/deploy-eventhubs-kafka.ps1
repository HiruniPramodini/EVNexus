<#
.SYNOPSIS
    Automated Azure Event Hubs (Kafka API) Provisioning Script for EVNexus Microservices.
.DESCRIPTION
    Creates an Azure Event Hubs namespace with Standard SKU (enabling Apache Kafka on port 9093),
    provisions the 3 required EVNexus topics, creates consumer groups, and outputs Kafka connection settings.
#>

param(
    [string]$ResourceGroupName = "rg-evnexus-eastasia",
    [string]$Location = "eastasia",
    [string]$NamespaceName = "evnexus-kafka-hub"
)

$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  ⚡ EVNexus Azure Event Hubs (Kafka Broker) Provisioning Script" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Resource Group: $ResourceGroupName"
Write-Host "Region:         $Location"
Write-Host "Namespace:      $NamespaceName"
Write-Host ""

# 1. Create or Verify Resource Group
Write-Host "[1/5] Ensuring Resource Group exists..." -ForegroundColor Yellow
az group create --name $ResourceGroupName --location $Location --output none
Write-Host "      ✓ Resource Group '$ResourceGroupName' ready." -ForegroundColor Green

# 2. Deploy Event Hubs Namespace (Kafka Enabled)
Write-Host "[2/5] Creating Azure Event Hubs Namespace with Kafka enabled..." -ForegroundColor Yellow
az eventhubs namespace create `
    --name $NamespaceName `
    --resource-group $ResourceGroupName `
    --location $Location `
    --sku Standard `
    --enable-kafka true `
    --output none
Write-Host "      ✓ Event Hubs Namespace '$NamespaceName' created." -ForegroundColor Green

# 3. Create EVNexus Kafka Topics (Event Hubs)
Write-Host "[3/5] Creating Kafka Topics (Event Hubs with 3 partitions)..." -ForegroundColor Yellow

$topics = @(
    "evnexus.charging.sessions",
    "evnexus.payment.events",
    "evnexus.map.stations"
)

foreach ($topic in $topics) {
    az eventhubs eventhub create `
        --name $topic `
        --namespace-name $NamespaceName `
        --resource-group $ResourceGroupName `
        --partition-count 3 `
        --message-retention 1 `
        --output none
    Write-Host "      ✓ Topic created: $topic" -ForegroundColor Green
}

# 4. Create Consumer Groups
Write-Host "[4/5] Provisioning Consumer Groups for microservices..." -ForegroundColor Yellow

az eventhubs eventhub consumer-group create `
    --name "evnexus-payment-group" `
    --eventhub-name "evnexus.charging.sessions" `
    --namespace-name $NamespaceName `
    --resource-group $ResourceGroupName `
    --output none
Write-Host "      ✓ Consumer group 'evnexus-payment-group' on 'evnexus.charging.sessions'" -ForegroundColor Green

az eventhubs eventhub consumer-group create `
    --name "evnexus-dashboard-group" `
    --eventhub-name "evnexus.charging.sessions" `
    --namespace-name $NamespaceName `
    --resource-group $ResourceGroupName `
    --output none
Write-Host "      ✓ Consumer group 'evnexus-dashboard-group' on 'evnexus.charging.sessions'" -ForegroundColor Green

az eventhubs eventhub consumer-group create `
    --name "evnexus-dashboard-group" `
    --eventhub-name "evnexus.payment.events" `
    --namespace-name $NamespaceName `
    --resource-group $ResourceGroupName `
    --output none
Write-Host "      ✓ Consumer group 'evnexus-dashboard-group' on 'evnexus.payment.events'" -ForegroundColor Green

# 5. Retrieve Connection String
Write-Host "[5/5] Generating Kafka connection credentials..." -ForegroundColor Yellow

$primaryKey = az eventhubs namespace authorization-rule keys list `
    --resource-group $ResourceGroupName `
    --namespace-name $NamespaceName `
    --name RootManageSharedAccessKey `
    --query primaryConnectionString `
    --output tsv

$bootstrapServer = "${NamespaceName}.servicebus.windows.net:9093"

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "  🎉 SUCCESS: Azure Event Hubs (Kafka) is Live & Ready!" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "KAFKA CONFIGURATION SETTINGS FOR EVNEXUS MICROSERVICES:" -ForegroundColor Cyan
Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
Write-Host "Bootstrap Server:     $bootstrapServer" -ForegroundColor White
Write-Host "Security Protocol:    SASL_SSL" -ForegroundColor White
Write-Host "SASL Mechanism:       PLAIN" -ForegroundColor White
Write-Host "SASL Username:        `$ConnectionString" -ForegroundColor White
Write-Host "SASL Password:        $primaryKey" -ForegroundColor White
Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
Write-Host "Active Kafka Topics:  evnexus.charging.sessions" -ForegroundColor White
Write-Host "                      evnexus.payment.events" -ForegroundColor White
Write-Host "                      evnexus.map.stations" -ForegroundColor White
Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
