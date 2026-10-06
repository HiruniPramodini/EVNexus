using System;

namespace EVNexus.PaymentService.Models;

public class OutboxMessage
{
    public long Id { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string AggregateType { get; set; } = string.Empty;
    public string AggregateId { get; set; } = string.Empty;
    public string Payload { get; set; } = string.Empty;
    public string Status { get; set; } = "PENDING";
    public int RetryCount { get; set; } = 0;
    public DateTime AvailableAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PublishedAt { get; set; }
    public string? LastError { get; set; }
}
