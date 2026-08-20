FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["EVNexus.MapService.csproj", "./"]
RUN dotnet restore "EVNexus.MapService.csproj"
COPY . .
RUN dotnet publish "EVNexus.MapService.csproj" -c Release -o /app/publish /p:UseAppHost=false
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "EVNexus.MapService.dll"]
