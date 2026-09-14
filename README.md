# ⚡ EVNexus

## Multi-Tenant EV Charging Management & Intelligent Charging Platform

EVNexus is a **multi-tenant electric vehicle (EV) charging management platform** designed to connect EV charging companies and EV drivers through a unified digital ecosystem.

The platform enables charging companies to manage charging stations, monitor charging activity, and access analytics, while EV drivers can discover charging stations, check availability, start and complete charging sessions, and make payments using an internal wallet.

EVNexus also incorporates **AI-based peak-hour forecasting** to predict charging demand and identify expected busy and free periods for individual charging stations over the next seven days.

---

# 📌 Table of Contents

* [About the Project](#-about-the-project)
* [Key Features](#-key-features)
* [System Architecture](#-system-architecture)
* [Microservices](#-microservices)
* [Technology Stack](#-technology-stack)
* [Repository Structure](#-repository-structure)
* [Communication Architecture](#-communication-architecture)
* [AI Forecasting](#-ai-forecasting)
* [Database Architecture](#-database-architecture)
* [Authentication & Authorization](#-authentication--authorization)
* [Payment Flow](#-payment-flow)
* [Kafka Event Flow](#-kafka-event-flow)
* [API Gateway](#-api-gateway)
* [Frontend](#-frontend)
* [Docker](#-docker)
* [CI/CD](#-cicd)
* [Monitoring & Observability](#-monitoring--observability)
* [Branching Strategy](#-branching-strategy)
* [Getting Started](#-getting-started)
* [Environment Variables](#-environment-variables)
* [Development Workflow](#-development-workflow)
* [Testing](#-testing)
* [Future Improvements](#-future-improvements)
* [Contributors](#-contributors)

---

# 🚗 About the Project

Traditional EV charging platforms often operate independently, requiring drivers to use different applications for different charging providers.

EVNexus addresses this problem by providing a **single multi-tenant platform** where multiple charging companies can participate in the same ecosystem.

The system is designed around two primary user types:

### 👤 EV Drivers

Drivers can:

* Register an account
* Log in securely
* Manage their profile
* Discover nearby EV charging stations
* View charging station details
* View station availability
* View connector and charging information
* View predicted busy/free periods
* Start charging sessions
* Complete charging sessions
* Pay using an internal wallet
* View wallet balance
* View payment history
* View charging history

### 🏢 Charging Companies

Charging companies can:

* Register their organization
* Authenticate securely
* Manage company profiles
* Add charging stations
* Update charging station information
* Remove charging stations
* Manage charging station availability
* Monitor charging activity
* View charging sessions
* View dashboard analytics
* Analyze charging trends
* View predicted charging demand
* Identify peak charging periods

---

# ✨ Key Features

## 🔐 Authentication & Authorization

* Driver registration and login
* Company registration and login
* JWT-based authentication
* Role-based access control
* Email verification
* Secure password handling
* Multi-tenant authorization
* Tenant isolation

## 🗺️ Charging Station & Map Management

* Charging station registration
* Station information management
* Geographic coordinates
* Connector type information
* Charging capacity
* Charging prices
* Station availability
* Charging session management
* Map-based station discovery

## 💳 Internal Wallet & Payments

EVNexus uses an **internal wallet system** for charging payments.

Drivers can:

* View wallet balance
* Add funds
* Pay for charging sessions
* View transaction history
* Track charging-related payments

Payment operations use an idempotent `sessionId` mechanism to help prevent duplicate payment processing.

## 📊 Dashboard Analytics

The dashboard provides charging companies with:

* Charging activity information
* Charging session statistics
* Usage trends
* Peak-hour analysis
* Charging demand information
* AI-generated seven-day demand forecasts

## 🤖 AI-Based Demand Forecasting

EVNexus uses AI-based forecasting to predict future charging demand.

The system can forecast expected demand for individual charging stations for the **next seven days**.

The forecasting functionality is integrated into the **Dashboard Analytics Service**.

The predictions can be used to identify:

* Expected peak periods
* Expected off-peak periods
* Busy charging periods
* Free/low-demand periods
* Charging demand trends

## 🏢 Multi-Tenant Architecture

EVNexus supports multiple charging companies within the same platform.

Tenant isolation ensures that:

* Companies can access only their own charging data
* Company-owned charging stations remain tenant-specific
* Dashboard information is isolated by tenant
* Authorization is enforced across services

---

# 🏗️ System Architecture

EVNexus follows a **microservices architecture**.

```text
                         ┌──────────────────────┐
                         │      React Frontend  │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │     API Gateway      │
                         └──────────┬───────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
      ┌───────────────┐     ┌───────────────┐     ┌────────────────┐
      │ Authentication│     │ Map Service   │     │ Payment Service│
      │    Service    │     │               │     │                │
      └───────┬───────┘     └───────┬───────┘     └───────┬────────┘
              │                     │                     │
              ▼                     ▼                     ▼
       ┌────────────┐        ┌────────────┐        ┌────────────┐
       │  auth_db   │        │   map_db   │        │ payment_db │
       └────────────┘        └────────────┘        └────────────┘
                                                           │
                                                           │
                                                           ▼
                                                   ┌──────────────┐
                                                   │    Kafka     │
                                                   └──────┬───────┘
                                                          │
                                                          ▼
                                             ┌────────────────────────┐
                                             │ Dashboard Analytics    │
                                             │        Service          │
                                             └───────────┬────────────┘
                                                         │
                                                         ▼
                                                  ┌──────────────┐
                                                  │ dashboard_db │
                                                  └──────────────┘
```

---

# 🔧 Microservices

EVNexus is divided into the following core services.

## 1. Authentication Service

Responsible for:

* Driver registration
* Driver authentication
* Company registration
* Company authentication
* Profile management
* Email verification
* JWT token generation
* Role management
* Tenant identification

---

## 2. Map Service

Responsible for:

* Charging station management
* Station coordinates
* Station information
* Charging connector information
* Station pricing
* Charging session management
* Station availability
* Tenant-specific station data

### Database Tables

The Map Service uses:

```text
stations
charging_sessions
```

---

## 3. Payment Service

Responsible for:

* Internal wallet management
* Wallet balance
* Charging payments
* Payment transactions
* Payment validation
* Idempotent payment processing
* Payment history

The service publishes completed charging-session/payment events to Kafka.

---

## 4. Dashboard Analytics Service

Responsible for:

* Charging analytics
* Usage statistics
* Charging trends
* Peak-hour analysis
* AI-based demand forecasting
* Seven-day charging demand predictions

The AI forecasting functionality is part of the Dashboard Analytics Service rather than being deployed as a separate microservice.

---

## 5. API Gateway

The API Gateway provides a single entry point for the frontend.

Responsibilities include:

* Routing requests
* Forwarding requests to microservices
* Centralized API access
* Simplifying frontend-to-backend communication
* Supporting the microservice architecture

---

# 💻 Technology Stack

## Backend

* **C#**
* **.NET 8**
* **ASP.NET Core Web API**
* **ADO.NET**
* **Dapper**
* JWT Authentication
* REST APIs

## Frontend

* **React**
* JavaScript
* HTML
* CSS

## Database

* **MySQL**
* Azure Database for MySQL
* Separate databases per service

## Messaging

* **Apache Kafka**

Kafka is used for asynchronous communication between services, particularly for completed charging-session/payment events.

## AI / Machine Learning

* Python
* Machine Learning models
* Time-series / demand forecasting techniques
* Seven-day charging demand prediction

## DevOps

* Docker
* Docker Compose
* GitHub Actions
* Azure App Service

## Cloud

* Microsoft Azure
* Azure App Service
* Azure Database for MySQL
* Azure Application Insights

## Testing

* xUnit
* Unit Testing
* Integration Testing
* API Testing

---

# 📁 Repository Structure

The repository follows a service-oriented structure.

```text
EVNexus/
│
├── AuthenticationService/
│   ├── src/
│   │   └── EVNexus.AuthService/
│   └── tests/
│       └── EVNexus.AuthService.Tests/
│
├── MapService/
│   ├── src/
│   │   └── EVNexus.MapService/
│   └── tests/
│       └── EVNexus.MapService.Tests/
│
├── PaymentService/
│   ├── src/
│   │   └── EVNexus.PaymentService/
│   └── tests/
│       └── EVNexus.PaymentService.Tests/
│
├── DashboardService/
│   ├── src/
│   │   └── EVNexus.DashboardService/
│   └── tests/
│       └── EVNexus.DashboardService.Tests/
│
├── ApiGateway/
│   └── src/
│       └── EVNexus.ApiGateway/
│
├── Frontend/
│   └── ...
│
├── Infrastructure/
│   └── docker/
│       └── docker-compose.yml
│
├── .github/
│   └── workflows/
│       ├── auth-ci.yml
│       └── ...
│
└── README.md
```

> Directory names may evolve as individual services are developed.

---

# 🔄 Communication Architecture

EVNexus uses both **synchronous REST communication** and **asynchronous Kafka messaging**.

### REST Communication

REST APIs are used when an immediate response is required.

Example:

```text
Frontend
   │
   ▼
API Gateway
   │
   ▼
Map Service
   │
   ▼
MySQL
```

### Kafka Communication

Kafka is used for asynchronous event-driven communication.

Example:

```text
Payment Service
      │
      │ Charging Session Completed
      ▼
    Kafka
      │
      ▼
Dashboard Analytics Service
```

This reduces direct coupling between services and allows analytics processing to occur asynchronously.

---

# 🤖 AI Forecasting

EVNexus incorporates AI-based charging demand forecasting into the Dashboard Analytics Service.

The system uses historical charging activity to generate demand predictions.

### Forecasting Process

```text
Historical Charging Data
          │
          ▼
     Data Processing
          │
          ▼
     Feature Creation
          │
          ▼
   Forecasting Model
          │
          ▼
 Seven-Day Prediction
          │
          ▼
 Dashboard Analytics
```

The resulting predictions can help charging companies understand future charging demand and identify potential peak periods.

---

# 🗄️ Database Architecture

EVNexus follows a **database-per-service approach**.

```text
Azure MySQL Server
│
├── auth_db
│
├── map_db
│
├── payment_db
│
└── dashboard_db
```

Each microservice owns its respective database.

This provides:

* Service-level data ownership
* Better isolation
* Reduced database coupling
* Independent service development
* Improved scalability

### Map Service Example

```text
map_db
│
├── stations
│
└── charging_sessions
```

The `stations` table contains information such as:

* Station ID
* Tenant ID
* Station name
* Address
* Latitude
* Longitude
* Connector type
* Charging capacity
* Pricing
* Peak/off-peak pricing
* Availability

The `charging_sessions` table stores charging session information such as:

* Session ID
* Station ID
* Driver ID
* Start time
* End time
* Status
* Energy consumed
* Total cost

---

# 🔐 Authentication & Authorization

EVNexus uses **JWT-based authentication**.

The authentication flow is:

```text
User
 │
 ▼
Login
 │
 ▼
Authentication Service
 │
 ▼
Validate Credentials
 │
 ▼
Generate JWT
 │
 ▼
Frontend
 │
 ▼
API Gateway
 │
 ▼
Microservice
 │
 ▼
JWT Validation
```

JWT tokens contain information required to authenticate and authorize requests.

Role-based authorization is used to distinguish between:

```text
DRIVER
COMPANY
```

Tenant information is also used to enforce company-level data isolation.

---

# 💳 Payment Flow

EVNexus uses an internal wallet rather than an external payment gateway.

A simplified charging payment flow is:

```text
Driver
  │
  ▼
Start Charging
  │
  ▼
Map Service
  │
  ▼
Charging Session
  │
  ▼
Complete Charging
  │
  ▼
Calculate Cost
  │
  ▼
Payment Service
  │
  ▼
Validate Wallet Balance
  │
  ▼
Process Payment
  │
  ▼
Update Wallet
  │
  ▼
Publish Event
```

An idempotent `sessionId` is used to help prevent duplicate payment processing.

---

# 📨 Kafka Event Flow

Kafka provides asynchronous communication between the Payment Service and Dashboard Analytics Service.

```text
┌─────────────────────┐
│   Payment Service   │
└──────────┬──────────┘
           │
           │ Completed Session Event
           ▼
┌─────────────────────┐
│        Kafka        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────┐
│ Dashboard Analytics Service │
└──────────────┬──────────────┘
               │
               ▼
         Update Analytics
               │
               ▼
        Forecasting Model
```

This allows dashboard analytics to consume charging activity without requiring the Payment Service to directly call the Dashboard Service for every completed session.

---

# 🌐 API Gateway

The API Gateway acts as the central entry point for client requests.

```text
                 React Frontend
                       │
                       ▼
                ┌─────────────┐
                │ API Gateway │
                └──────┬──────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
        Auth          Map        Payment
        Service      Service      Service
                       │
                       ▼
                  Dashboard
                   Service
```

The gateway helps hide internal service endpoints from the frontend and provides a consistent API entry point.

---

# 🎨 Frontend

The EVNexus frontend is developed using **React**.

The application provides separate experiences for:

### Driver

* Registration
* Login
* Driver dashboard
* Map
* Charging station discovery
* Station details
* Charging sessions
* Wallet
* Payments
* Charging history

### Company

* Company registration
* Login
* Company dashboard
* Charging station management
* Charging activity
* Analytics
* Demand forecasting
* Peak-hour analysis

---

# 🐳 Docker

EVNexus uses Docker to provide consistent development and deployment environments.

The infrastructure includes Docker Compose configuration for running the services together.

Example:

```text
Infrastructure/
└── docker/
    └── docker-compose.yml
```

The project uses containerized services such as:

```text
Authentication Service
Map Service
Payment Service
Dashboard Service
API Gateway
```

Docker helps ensure that services can be built and run consistently across development and deployment environments.

---

# 🔄 CI/CD

EVNexus uses **GitHub Actions** for continuous integration and deployment.

## Continuous Integration

CI workflows are responsible for:

* Restoring dependencies
* Building the application
* Running automated tests
* Validating service changes
* Checking Docker builds where applicable

Example CI flow:

```text
Developer
   │
   ▼
Create Feature Branch
   │
   ▼
Pull Request
   │
   ▼
GitHub Actions
   │
   ├── Restore
   ├── Build
   ├── Test
   └── Docker Check
   │
   ▼
Code Review
   │
   ▼
Merge
```

## Continuous Deployment

Deployment workflows package and deploy approved services to Azure.

```text
main
 │
 ▼
GitHub Actions
 │
 ├── Build
 ├── Test
 └── Package
 │
 ▼
Azure App Service
```

Running tests again before deployment provides an additional deployment gate and prevents an invalid production artifact from being deployed.

---

# 📈 Monitoring & Observability

EVNexus uses **Azure Application Insights** for application monitoring and observability.

Monitoring can be used to track:

* Application availability
* Requests
* Response times
* Exceptions
* Failures
* Service health
* Application performance

The goal is to make it easier to identify and troubleshoot problems after deployment.

---

# 🌿 Branching Strategy

EVNexus follows a Git-based branching strategy.

```text
main
 │
 └── Production-ready code
       
develop
 │
 └── Integration branch
       
feature branches
 │
 └── Individual development work
```

### Typical Workflow

```text
feature/<feature-name>
          │
          ▼
       develop
          │
          ▼
         main
```

Developers should work on feature branches and create pull requests before merging changes into shared branches.

---

# 🚀 Getting Started

## Prerequisites

Install the following before running EVNexus:

* Git
* .NET 8 SDK
* Node.js
* npm
* MySQL
* Docker Desktop
* Docker Compose

For AI/ML functionality:

* Python 3.x
* Required Python ML dependencies

---

## Clone the Repository

```bash
git clone https://github.com/HiruniPramodini/EVNexus.git
```

Navigate to the project:

```bash
cd EVNexus
```

---

# ▶️ Running the Backend

Each microservice can be run independently.

Example for Map Service:

```cmd
dotnet run --project MapService\src\EVNexus.MapService\EVNexus.MapService.csproj
```

The development Map Service is configured to use:

```text
http://localhost:5032
```

Swagger:

```text
http://localhost:5032/swagger
```

Other services should be started using their respective `.csproj` files and configured ports.

---

# ▶️ Running the Frontend

Navigate to the frontend directory:

```bash
cd Frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend will display the development URL provided by Vite.

---

# 🐳 Running with Docker

From the repository root:

```bash
docker compose -f Infrastructure/docker/docker-compose.yml up --build
```

To stop the containers:

```bash
docker compose -f Infrastructure/docker/docker-compose.yml down
```

---

# 🔑 Environment Variables

Sensitive configuration such as database credentials, JWT secrets, and deployment credentials should **not be committed to GitHub**.

Typical configuration includes:

```text
ConnectionStrings__DefaultConnection
JWT_SECRET
JWT_ISSUER
JWT_AUDIENCE
MYSQL_HOST
MYSQL_PORT
MYSQL_DATABASE
MYSQL_USER
MYSQL_PASSWORD
KAFKA_BOOTSTRAP_SERVERS
```

For local development, use appropriate environment configuration or .NET User Secrets where possible.

For Azure deployments, sensitive values should be configured through **Azure App Service Configuration** rather than stored directly in source code.

> Never commit passwords, database credentials, API keys, JWT secrets, or other sensitive credentials to the repository.

---

# 🧪 Testing

Testing is an important part of the EVNexus development workflow.

Testing activities include:

### Unit Testing

Individual classes and business logic are tested independently.

Example:

```text
AuthenticationService.Tests
```

### Integration Testing

Integration tests verify interactions between application components and external dependencies such as databases.

### API Testing

REST endpoints can be tested using:

* Swagger
* Postman
* Automated API tests

### CI Testing

Automated tests are executed through GitHub Actions before changes are merged.

---

# 🔄 Development Workflow

A typical development workflow is:

```text
1. Pull latest develop
        ↓
2. Create feature branch
        ↓
3. Implement feature
        ↓
4. Write/update tests
        ↓
5. Run tests locally
        ↓
6. Commit changes
        ↓
7. Push feature branch
        ↓
8. Create Pull Request
        ↓
9. CI validation
        ↓
10. Code review
        ↓
11. Merge into develop
        ↓
12. Release/deployment process
```

Developers should keep commits focused and descriptive.

Example:

```text
feat: add charging station creation endpoint
fix: resolve wallet balance validation
test: add payment service unit tests
docs: update MapService setup instructions
```

---

# 🔮 Future Improvements

Potential future enhancements include:

* Mobile application for EV drivers
* Real-time charger availability
* IoT charger integration
* Real-time charging telemetry
* Advanced demand forecasting
* Dynamic pricing
* Route optimization
* Smart charging recommendations
* More advanced ML models
* Automated anomaly detection
* EV fleet management
* Notification services
* Advanced company analytics
* Horizontal service scaling
* Kubernetes-based deployment
* Distributed tracing
* Centralized logging

---

# 👥 Contributors

EVNexus is developed as a collaborative software engineering project.

### Team

* **A.G.H. Pramodini** — Team Leader
* **N.P.K.N. Pathirana**
* **K.T.L. Perera**
* **Asmal J.M.**

---

# 📄 Project Summary

EVNexus combines:

```text
Microservices
     +
Multi-Tenancy
     +
EV Charging Management
     +
Internal Wallet & Payments
     +
Kafka Event-Driven Communication
     +
AI Demand Forecasting
     +
Docker
     +
GitHub Actions CI/CD
     +
Microsoft Azure
```

to provide a unified and intelligent platform for EV charging companies and EV drivers.

---

## ⚡ EVNexus

**Multi-Tenant EV Charging Management & Intelligent Charging Platform**

Built with **.NET 8, React, MySQL, Kafka, Docker, GitHub Actions, Azure, and AI/ML.**
