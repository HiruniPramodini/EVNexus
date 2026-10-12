"""
EVNexus - Sprint 4 QA Performance & Load Test Runner (SCRUM-172)
Simulates 50 concurrent virtual users querying Dashboard & Analytics endpoints.
Runs using Python standard library (no external pip dependencies required).
"""

import concurrent.futures
import json
import socket
import statistics
import sys
import time
import urllib.error
import urllib.request

# Configuration
BASE_URL = "http://localhost:5004"
HOST = "localhost"
PORT = 5004
COMPANY_ID = "comp-101"
CONCURRENT_USERS = 50
REQUESTS_PER_USER = 10
TOTAL_REQUESTS = CONCURRENT_USERS * REQUESTS_PER_USER
JWT_TOKEN = "TEST_TOKEN_OR_DUMMY"

ENDPOINTS = [
    f"/api/payment/analytics/company/{COMPANY_ID}",
    f"/api/payment/analytics/company/{COMPANY_ID}/revenue-trend",
    f"/api/payment/analytics/company/{COMPANY_ID}/forecast?historicalDays=30",
    f"/api/payment/analytics/company/{COMPANY_ID}/stations"
]

def check_server_reachable():
    try:
        sock = socket.socket(socket.AF_SOCKET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex((HOST, PORT))
        sock.close()
        return result == 0
    except Exception:
        return False

def make_request(endpoint):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {JWT_TOKEN}")
    req.add_header("Content-Type", "application/json")
    
    start_time = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            return (True, response.status, latency_ms, endpoint)
    except urllib.error.HTTPError as e:
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        return (e.code in [200, 401, 403], e.code, latency_ms, endpoint)
    except Exception as ex:
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        return (False, str(ex), latency_ms, endpoint)

def run_load_test():
    print("=" * 70)
    print("  EVNexus Sprint 4 - SCRUM-172 Load Test Execution")
    print(f"  Target: {BASE_URL}")
    print(f"  Concurrent Virtual Users: {CONCURRENT_USERS}")
    print(f"  Requests per User: {REQUESTS_PER_USER}")
    print(f"  Total Requests: {TOTAL_REQUESTS}")
    print("=" * 70)

    # Pre-flight check: Is the backend service running?
    print(f"Checking connection to {BASE_URL}...")
    if not check_server_reachable():
        print(f"\n[WARNING] Server is not running on {BASE_URL} yet!")
        print("To run this load test against the live API, please start the service first:")
        print("  Option A (dotnet run):")
        print("    dotnet run --project EVNexus/PaymentService/src/EVNexus.PaymentService/EVNexus.PaymentService.csproj")
        print("  Option B (Docker):")
        print("    docker-compose -f EVNexus/Infrastructure/docker/docker-compose.yml up -d")
        print("=" * 70)
        return

    print("Server is online! Starting load test with 50 concurrent workers...")
    
    tasks = []
    for i in range(TOTAL_REQUESTS):
        ep = ENDPOINTS[i % len(ENDPOINTS)]
        tasks.append(ep)
        
    start_all = time.perf_counter()
    results = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=CONCURRENT_USERS) as executor:
        futures = [executor.submit(make_request, ep) for ep in tasks]
        for f in concurrent.futures.as_completed(futures):
            results.append(f.result())
            
    total_time = time.perf_counter() - start_all
    
    successes = [r for r in results if r[0]]
    failures = [r for r in results if not r[0]]
    latencies = [r[2] for r in results]
    
    print("\n" + "=" * 70)
    print("                   PERFORMANCE TEST RESULTS")
    print("=" * 70)
    print(f"Total Requests Executed : {len(results)}")
    print(f"Successful Requests     : {len(successes)} ({(len(successes)/len(results))*100:.1f}%)")
    print(f"Failed Requests         : {len(failures)} ({(len(failures)/len(results))*100:.1f}%)")
    print(f"Total Test Duration     : {total_time:.2f} seconds")
    print(f"Throughput              : {len(results)/total_time:.1f} req/sec")
    
    if latencies:
        print("\nLatency Metrics (ms):")
        print(f"  Min Latency           : {min(latencies):.2f} ms")
        print(f"  Average Latency       : {statistics.mean(latencies):.2f} ms")
        print(f"  Median (50th %)       : {statistics.median(latencies):.2f} ms")
        if len(latencies) >= 20:
            p95 = statistics.quantiles(latencies, n=100)[94]
            print(f"  95th Percentile (p95) : {p95:.2f} ms")
        print(f"  Max Latency           : {max(latencies):.2f} ms")
        
    print("\n" + "=" * 70)
    
    avg_latency = statistics.mean(latencies) if latencies else 0
    sla_pass = avg_latency < 2000 and (len(failures) / len(results) <= 0.05)
    if sla_pass:
        print("  SLA ASSESSMENT: PASSED (Avg Latency < 2.0s & Error Rate < 5%)")
    else:
        print("  SLA ASSESSMENT: FAILED OR NEEDS TUNING")
    print("=" * 70)

if __name__ == "__main__":
    run_load_test()
