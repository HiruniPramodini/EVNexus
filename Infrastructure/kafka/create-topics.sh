#!/bin/bash
# ==============================================================================
# EVNexus Sprint 3 - Kafka Topic Creation Script
# ==============================================================================
echo "Creating EVNexus Kafka event topics..."

docker exec -i evnexus-kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists --topic evnexus.payment.events --partitions 3 --replication-factor 1
docker exec -i evnexus-kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists --topic evnexus.charging.sessions --partitions 3 --replication-factor 1
docker exec -i evnexus-kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists --topic evnexus.map.stations --partitions 3 --replication-factor 1

echo "Listing active Kafka topics:"
docker exec -i evnexus-kafka kafka-topics --bootstrap-server localhost:9092 --list
echo "Kafka topics ready for EVNexus Microservices."
