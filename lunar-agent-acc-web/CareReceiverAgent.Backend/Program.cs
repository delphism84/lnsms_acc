using CareReceiverAgent.Backend.Hubs;
using CareReceiverAgent.Backend.Services;
using System.Net;
using static CareReceiverAgent.Backend.Services.PortService;

var builder = WebApplication.CreateBuilder(args);

// 포트 설정 로드 및 충돌 처리
var portSettings = PortService.LoadSettings();
int port = portSettings.Port;

// 포트가 사용 중이면 사용 가능한 포트 찾기
if (!PortService.IsPortAvailable(port))
{
    Console.WriteLine($"포트 {port}가 사용 중입니다. 사용 가능한 포트를 찾는 중...");
    port = PortService.FindAvailablePort(port);
    
    if (port == 0)
    {
        // 시스템이 자동 할당하도록 0 사용
        port = 0;
        Console.WriteLine("포트 범위에서 사용 가능한 포트를 찾지 못했습니다. 시스템이 자동 할당합니다.");
    }
    else
    {
        Console.WriteLine($"새 포트: {port}");
    }
    
    // 새 포트를 설정 파일에 저장
    PortService.SaveSettings(port);
}

// 포트 설정 (포트가 0이면 사용 가능한 포트를 찾아서 사용)
if (port == 0)
{
    port = PortService.FindAvailablePort();
    if (port == 0)
    {
        // 포트 범위에서 찾지 못하면 기본값 사용
        port = 58000;
        Console.WriteLine($"경고: 사용 가능한 포트를 찾지 못해 기본 포트 {port} 사용");
    }
    else
    {
        Console.WriteLine($"사용 가능한 포트 발견: {port}");
    }
    PortService.SaveSettings(port);
}

builder.WebHost.UseUrls($"http://localhost:{port}");
Console.WriteLine($"백엔드 시작: http://localhost:{port}");

// 사용할 포트를 항상 settings.json에 저장
PortService.SaveSettings(port);

// 서비스 등록
builder.Services.AddSingleton<SerialPortService>();
builder.Services.AddSingleton<NotificationService>();
// JsonDatabaseService는 static 메서드만 사용하므로 등록 불필요

// 백그라운드 서비스
builder.Services.AddHostedService<SerialPortBackgroundService>();

// SignalR
builder.Services.AddSignalR();

// CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Controllers
builder.Services.AddControllers();

// OpenAPI (개발 환경)
builder.Services.AddOpenApi();

var app = builder.Build();

// HTTP 요청 파이프라인 설정
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();

// 정적 파일 서빙 (wwwroot 폴더)
var wwwrootPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");
if (Directory.Exists(wwwrootPath))
{
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(wwwrootPath),
        RequestPath = ""
    });
    Console.WriteLine($"정적 파일 경로: {wwwrootPath}");
}
else
{
    Console.WriteLine($"경고: wwwroot 폴더를 찾을 수 없습니다: {wwwrootPath}");
    // 기본 UseStaticFiles 사용
    app.UseStaticFiles();
}

// Controllers
app.MapControllers();

// SignalR Hub
app.MapHub<NotificationHub>("/notificationHub");

// 기본 라우트 - 프론트엔드로 리다이렉트
if (Directory.Exists(wwwrootPath))
{
    app.MapFallbackToFile("index.html", new StaticFileOptions
    {
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(wwwrootPath)
    });
}
else
{
    app.MapFallbackToFile("index.html");
}

app.Run();
