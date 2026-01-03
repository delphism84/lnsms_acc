using System.ServiceProcess;
using System.Diagnostics;
using CareReceiverAgent.Host.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace CareReceiverAgent.Host.Services
{
    /// <summary>
    /// Windows 서비스로 실행되는 CareReceiver 서비스
    /// </summary>
    public class CareReceiverService : ServiceBase
    {
        private WebApplication? _webApp;
        private Thread? _webServerThread;
        private int _port = 58000;

            public CareReceiverService()
        {
            ServiceName = "LunarAgentAccService";
            CanStop = true;
            CanPauseAndContinue = false;
            AutoLog = true;
        }

        protected override void OnStart(string[] args)
        {
            try
            {
                // 콘솔 출력 인코딩 설정 (UTF-8)
                Console.OutputEncoding = System.Text.Encoding.UTF8;

                // 기본 문구 초기화 (서비스 시작 시 한 번만 실행, LoadPhrases에서도 자동 복구됨)
                JsonDatabaseService.LoadPhrases();

                // 웹서버 시작
                StartWebServer();

                // 서비스는 백엔드만 실행 (UI는 시작 프로그램에서 별도 실행)
                EventLog.WriteEntry("CareReceiver 서비스가 시작되었습니다.", EventLogEntryType.Information);
            }
            catch (Exception ex)
            {
                EventLog.WriteEntry($"서비스 시작 실패: {ex.Message}", EventLogEntryType.Error);
                throw;
            }
        }

        protected override void OnStop()
        {
            try
            {
                StopWebServer();
                EventLog.WriteEntry("CareReceiver 서비스가 중지되었습니다.", EventLogEntryType.Information);
            }
            catch (Exception ex)
            {
                EventLog.WriteEntry($"서비스 중지 실패: {ex.Message}", EventLogEntryType.Error);
            }
        }

        private void StartWebServer()
        {
            _webServerThread = new Thread(() =>
            {
                try
                {
                    // 포트 설정 로드 및 충돌 처리
                    var portSettings = PortService.LoadSettings();
                    _port = portSettings.Port;

                    // 포트가 사용 중이면 사용 가능한 포트 찾기
                    if (!PortService.IsPortAvailable(_port))
                    {
                        _port = PortService.FindAvailablePort(_port);
                        if (_port == 0)
                        {
                            _port = PortService.FindAvailablePort();
                            if (_port == 0)
                            {
                                _port = 58000;
                            }
                        }
                        PortService.SaveSettings(_port);
                    }

                    var builder = WebApplication.CreateBuilder();

                    // Windows 서비스로 실행
                    builder.Host.UseWindowsService();

                    builder.WebHost.UseUrls($"http://localhost:{_port}");
                    EventLog.WriteEntry($"백엔드 시작: http://localhost:{_port}", EventLogEntryType.Information);

                    // 사용할 포트를 settings.json에 저장
                    PortService.SaveSettings(_port);

                    // 서비스 등록
                    builder.Services.AddSingleton<SerialPortService>();
                    builder.Services.AddSingleton<NotificationService>();

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

                    // Controllers - JSON 옵션 설정 (camelCase 사용)
                    builder.Services.AddControllers()
                        .AddJsonOptions(options =>
                        {
                            options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
                            options.JsonSerializerOptions.WriteIndented = true;
                        });

                    // OpenAPI (개발 환경)
                    builder.Services.AddOpenApi();

                    _webApp = builder.Build();

                    // HTTP 요청 파이프라인 설정
                    if (_webApp.Environment.IsDevelopment())
                    {
                        _webApp.MapOpenApi();
                    }

                    _webApp.UseCors();

                    // 정적 파일 서빙 (wwwroot 폴더)
                    var wwwrootPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");
                    if (Directory.Exists(wwwrootPath))
                    {
                        _webApp.UseStaticFiles(new StaticFileOptions
                        {
                            FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(wwwrootPath),
                            RequestPath = ""
                        });
                    }
                    else
                    {
                        _webApp.UseStaticFiles();
                    }

                    // Controllers
                    _webApp.MapControllers();

                    // SignalR Hub
                    _webApp.MapHub<NotificationHub>("/notificationHub");

                    // 기본 라우트 - 프론트엔드로 리다이렉트
                    if (Directory.Exists(wwwrootPath))
                    {
                        _webApp.MapFallbackToFile("index.html", new StaticFileOptions
                        {
                            FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(wwwrootPath)
                        });
                    }
                    else
                    {
                        _webApp.MapFallbackToFile("index.html");
                    }

                    _webApp.Run();
                }
                catch (Exception ex)
                {
                    EventLog.WriteEntry($"웹서버 시작 실패: {ex.Message}", EventLogEntryType.Error);
                }
            })
            {
                IsBackground = true
            };

            _webServerThread.Start();

            // 웹서버가 시작될 때까지 대기
            Thread.Sleep(2000);
        }

        private void StopWebServer()
        {
            try
            {
                _webApp?.StopAsync().Wait(3000);
                _webServerThread?.Join(3000);
            }
            catch (Exception ex)
            {
                EventLog.WriteEntry($"웹서버 종료 실패: {ex.Message}", EventLogEntryType.Error);
            }
        }
    }
}

