using System.Collections.Generic;

namespace EVNexus.PaymentService.Models;

public class PaginatedResponse<T>
{
    public bool Success { get; set; } = true;
    public IEnumerable<T> Data { get; set; } = new List<T>();
    public PaginationMetadata Pagination { get; set; } = new PaginationMetadata();
}

public class PaginationMetadata
{
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}
