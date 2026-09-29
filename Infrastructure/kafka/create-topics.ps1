# ==============================================================================
# EVNexus Sprint 3 - Kafka Topic Creation Script (PowerShell)
# ==============================================================================
Write-Host "Creating EVNexus Kafka event topics..." -ForegroundColor Cyan

docker exec -i evnexus-kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists --topic evnexus.payment.events --partitions 3 --replication-factor 1
docker exec -i evnexus-kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists --topic evnexus.charging.sessions --partitions 3 --replication-factor 1
docker exec -i evnexus-kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists --topic evnexus.map.stations --partitions 3 --replication-factor 1

Write-Host "`nListing active Kafka topics:" -ForegroundColor Green
docker exec -i evnexus-kafka kafka-topics --bootstrap-server localhost:9092 --list
Write-Host "`nKafka topics initialized successfully for EVNexus Microservices." -ForegroundColor Green
