var builder = WebApplication.CreateBuilder(args);

// Configure CORS for Frontend communication
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

var app = builder.Build();

// Global preflight interceptor and CORS response header guarantor
app.Use(async (context, next) =>
{
    if (HttpMethods.IsOptions(context.Request.Method))
    {
        context.Response.Headers["Access-Control-Allow-Origin"] = "*";
        context.Response.Headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH";
        context.Response.Headers["Access-Control-Allow-Headers"] = "*";
        context.Response.StatusCode = StatusCodes.Status200OK;
        await context.Response.CompleteAsync();
        return;
    }

    context.Response.OnStarting(() =>
    {
        context.Response.Headers["Access-Control-Allow-Origin"] = "*";
        context.Response.Headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH";
        context.Response.Headers["Access-Control-Allow-Headers"] = "*";
        return Task.CompletedTask;
    });

    await next();
});

app.UseRouting();
app.UseCors("AllowAll");

app.MapGet("/health", () => Results.Ok(new { status = "Healthy", service = "EVNexus API Gateway" }));

app.MapReverseProxy();

app.Run();