FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["EVNexus.DashboardService.csproj", "./"]
RUN dotnet restore "EVNexus.DashboardService.csproj"
COPY . .
RUN dotnet publish "EVNexus.DashboardService.csproj" -c Release -o /app/publish /p:UseAppHost=false
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "EVNexus.DashboardService.dll"]
