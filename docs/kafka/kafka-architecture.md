# 📨 EVNexus Sprint 3 - Kafka Event-Driven Architecture

## Overview
EVNexus integrates Apache Kafka for asynchronous, event-driven messaging across decoupled microservices.

## Architecture & Topology

```text
┌───────────────────────────┐
│        Map Service        │
│   (Charging Sessions)     │
└─────────────┬─────────────┘
              │ 
              │ Topic: evnexus.charging.sessions
              ▼
┌──────────────────────────────────────────────────────────┐
│                   Apache Kafka Broker                    │
│      (Port: 9092 / 29092 - KRaft Combined Mode)          │
└─────────────┬──────────────────────────────┬─────────────┘
              │                              │
              │ evnexus.charging.sessions    │ evnexus.payment.events
              ▼                              ▼
┌───────────────────────────┐  ┌───────────────────────────┐
│      Payment Service      │  │Dashboard Analytics Service│
│ (Driver Wallet Deduction) │  │  (Real-Time EV Metrics)   │
└─────────────┬─────────────┘  └───────────────────────────┘
              │
              │ Topic: evnexus.payment.events
              └──────────────────────────────┘
```

## Topics
| Topic Name | Producer | Consumer(s) | Description |
|---|---|---|---|
| `evnexus.charging.sessions` | MapService | PaymentService, DashboardService | Emitted when driver completes EV charging |
| `evnexus.payment.events` | PaymentService | DashboardService | Emitted when wallet deduction / topup succeeds |
| `evnexus.map.stations` | MapService | DashboardService | Emitted when station status changes (Available/Occupied) |

## Docker Compose Setup
Run local Kafka event broker:
```bash
docker compose -f Infrastructure/docker/docker-compose.yml up -d kafka
```

Initialize topics:
```bash
# Windows PowerShell
./Infrastructure/kafka/create-topics.ps1

# Linux / Mac Bash
chmod +x ./Infrastructure/kafka/create-topics.sh
./Infrastructure/kafka/create-topics.sh
```
