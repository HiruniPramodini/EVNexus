FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["EVNexus.AuthService.csproj", "./"]
RUN dotnet restore "EVNexus.AuthService.csproj"
COPY . .
RUN dotnet publish "EVNexus.AuthService.csproj" -c Release -o /app/publish /p:UseAppHost=false
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "EVNexus.AuthService.dll"]
