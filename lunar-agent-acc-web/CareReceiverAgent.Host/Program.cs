using CareReceiverAgent.Host.Hubs;
using CareReceiverAgent.Host.Services;
using System.Net;
using System.Threading;
using System.Diagnostics;
using System.Linq;
using System.ServiceProcess;

namespace CareReceiverAgent.Host;

static class Program
{
    private static WebApplication? _webApp;
    private static Thread? _webServerThread;
    private static int _port = 58000;
    private static Mutex? _mutex;
    private const string MutexName = "Global\\LunarAgentAccHost";

    /// <summary>
    ///  The main entry point for the application.
    /// </summary>
    [STAThread]
    static void Main(string[] args)
    {
        // 서비스 설치/삭제 모드 확인
        if (args.Length > 0)
        {
            if (args[0] == "--install-service")
            {
                InstallService();
                return;
            }
            else if (args[0] == "--uninstall-service")
            {
                UninstallService();
                return;
            }
        }

        // 서비스 모드로 실행되는지 확인
        if (IsServiceMode(args))
        {
            // Windows 서비스로 실행
            ServiceBase[] servicesToRun = new ServiceBase[]
            {
                new CareReceiverService()
            };
            ServiceBase.Run(servicesToRun);
            return;
        }

        // 일반 모드 (WinForms)로 실행
        // 뮤텍스로 단일 인스턴스 보장
        bool createdNew;
        _mutex = new Mutex(true, MutexName, out createdNew);

        if (!createdNew)
        {
            // 이미 실행 중인 프로세스가 있으면 종료
            try
            {
                var currentProcess = Process.GetCurrentProcess();
                var currentExePath = currentProcess.MainModule?.FileName;
                
                var existingProcesses = Process.GetProcessesByName(currentProcess.ProcessName)
                    .Where(p => 
                    {
                        try
                        {
                            return p.Id != currentProcess.Id && 
                                   p.MainModule?.FileName == currentExePath;
                        }
                        catch
                        {
                            return false;
                        }
                    })
                    .ToList();

                foreach (var process in existingProcesses)
                {
                    try
                    {
                        Console.WriteLine($"기존 프로세스 종료 시도: PID {process.Id}");
                        process.Kill();
                        if (process.WaitForExit(3000))
                        {
                            Console.WriteLine($"기존 프로세스 종료 완료: PID {process.Id}");
                        }
                        else
                        {
                            Console.WriteLine($"기존 프로세스 종료 타임아웃: PID {process.Id}");
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"프로세스 종료 실패 (PID {process.Id}): {ex.Message}");
                    }
                    finally
                    {
                        process?.Dispose();
                    }
                }

                // 기존 프로세스 종료 후 잠시 대기
                Thread.Sleep(1000);

                // 뮤텍스 재시도
                _mutex?.Dispose();
                _mutex = new Mutex(true, MutexName, out createdNew);
                if (!createdNew)
                {
                    Console.WriteLine("경고: 뮤텍스 획득 실패. 계속 진행합니다.");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"기존 프로세스 확인 실패: {ex.Message}");
            }
        }

        try
        {
            // 콘솔 출력 인코딩 설정 (UTF-8)
            Console.OutputEncoding = System.Text.Encoding.UTF8;
            
            // 기본 문구 초기화 (앱 시작 시 한 번만 실행, LoadPhrases에서도 자동 복구됨)
            JsonDatabaseService.LoadPhrases();
            
            // 웹서버 시작
            StartWebServer();

            // WinForms 애플리케이션 시작
            ApplicationConfiguration.Initialize();
            Application.Run(new Form1(_port));
        }
        finally
        {
            // 뮤텍스 해제
            _mutex?.ReleaseMutex();
            _mutex?.Dispose();
        }
    }

    private static void StartWebServer()
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

                builder.WebHost.UseUrls($"http://localhost:{_port}");
                Console.WriteLine($"백엔드 시작: http://localhost:{_port}");

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
                        RequestPath = "",
                        OnPrepareResponse = ctx =>
                        {
                            // favicon/ico는 캐시가 강하게 남아서 교체 후에도 안 바뀌는 경우가 많음
                            // 재배포 시 바로 최신 아이콘을 보도록 no-cache 처리
                            if (ctx.Context.Request.Path.Value?.EndsWith(".ico", StringComparison.OrdinalIgnoreCase) == true)
                            {
                                var headers = ctx.Context.Response.Headers;
                                headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0";
                                headers["Pragma"] = "no-cache";
                                headers["Expires"] = "0";
                            }
                        }
                    });
                    Console.WriteLine($"정적 파일 경로: {wwwrootPath}");
                }
                else
                {
                    Console.WriteLine($"경고: wwwroot 폴더를 찾을 수 없습니다: {wwwrootPath}");
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
                Console.WriteLine($"웹서버 시작 실패: {ex.Message}");
            }
        })
        {
            IsBackground = true
        };

        _webServerThread.Start();

        // 웹서버가 시작될 때까지 대기
        Thread.Sleep(2000);
    }

    public static void StopWebServer()
    {
        try
        {
            _webApp?.StopAsync().Wait(3000);
            _webServerThread?.Join(3000);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"웹서버 종료 실패: {ex.Message}");
        }
    }

    /// <summary>
    /// 서비스 모드로 실행되는지 확인
    /// </summary>
    private static bool IsServiceMode(string[] args)
    {
        // 명령줄 인자로 서비스 모드 확인
        if (args.Length > 0 && args[0].Equals("--service", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        // Windows 서비스 환경에서 실행 중인지 확인
        // 서비스로 실행 중이면 SessionId가 0이거나 콘솔 창이 없음
        try
        {
            var process = Process.GetCurrentProcess();
            var sessionId = process.SessionId;
            
            // 서비스는 보통 Session 0에서 실행됨 (Windows Vista 이상)
            // 또는 콘솔 창이 없는 경우
            if (sessionId == 0)
            {
                return true;
            }

            // 환경 변수로 확인
            var serviceName = Environment.GetEnvironmentVariable("SERVICE_NAME");
            if (!string.IsNullOrEmpty(serviceName))
            {
                return true;
            }
        }
        catch
        {
            // 확인 실패 시 일반 모드로 실행
        }

        return false;
    }

    private static void InstallService()
    {
        try
        {
            var exePath = Process.GetCurrentProcess().MainModule?.FileName;
            if (string.IsNullOrEmpty(exePath) || !File.Exists(exePath))
            {
                Console.WriteLine("오류: 실행 파일을 찾을 수 없습니다.");
                return;
            }

            const string ServiceName = "LunarAgentAccService";
            var exePathQuoted = $"\"{exePath}\"";

            // 서비스가 이미 설치되어 있는지 확인
            var checkProcess = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "sc",
                    Arguments = $"query {ServiceName}",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    CreateNoWindow = true
                }
            };
            checkProcess.Start();
            var output = checkProcess.StandardOutput.ReadToEnd();
            checkProcess.WaitForExit();

            bool serviceExists = output.Contains("STATE");

            if (serviceExists)
            {
                Console.WriteLine("서비스가 이미 설치되어 있습니다.");
                return;
            }

            // 서비스 설치
            var installProcess = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "sc",
                    Arguments = $"create {ServiceName} binPath= {exePathQuoted} --service start= auto DisplayName= \"장애인호출관리시스템\"",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                }
            };
            installProcess.Start();
            var installOutput = installProcess.StandardOutput.ReadToEnd();
            var installError = installProcess.StandardError.ReadToEnd();
            installProcess.WaitForExit();

            if (installProcess.ExitCode == 0)
            {
                Console.WriteLine("서비스가 성공적으로 설치되었습니다.");

                // 서비스 설명 설정
                var descProcess = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "sc",
                        Arguments = $"description {ServiceName} \"장애인 도움요청 관리 시스템 서비스\"",
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };
                descProcess.Start();
                descProcess.WaitForExit();

                // 서비스 시작
                var startProcess = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "sc",
                        Arguments = $"start {ServiceName}",
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };
                startProcess.Start();
                startProcess.WaitForExit();

                Console.WriteLine("서비스가 시작되었습니다.");
            }
            else
            {
                Console.WriteLine($"서비스 설치 실패: {installError}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"서비스 설치 중 오류 발생: {ex.Message}");
        }
    }

    private static void UninstallService()
    {
        try
        {
            const string ServiceName = "LunarAgentAccService";

            // 서비스 중지
            var stopProcess = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "sc",
                    Arguments = $"stop {ServiceName}",
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };
            stopProcess.Start();
            stopProcess.WaitForExit();
            Thread.Sleep(1000);

            // 서비스 삭제
            var deleteProcess = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "sc",
                    Arguments = $"delete {ServiceName}",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                }
            };
            deleteProcess.Start();
            var output = deleteProcess.StandardOutput.ReadToEnd();
            var error = deleteProcess.StandardError.ReadToEnd();
            deleteProcess.WaitForExit();

            if (deleteProcess.ExitCode == 0)
            {
                Console.WriteLine("서비스가 성공적으로 삭제되었습니다.");
            }
            else
            {
                Console.WriteLine($"서비스 삭제 실패: {error}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"서비스 삭제 중 오류 발생: {ex.Message}");
        }
    }

    private static void CheckAndInstallService()
    {
        try
        {
            const string ServiceName = "LunarAgentAccService";

            // 서비스 등록 상태 확인 (관리자 권한 없이도 가능)
            var checkProcess = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "sc",
                    Arguments = $"query {ServiceName}",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                }
            };
            checkProcess.Start();
            var output = checkProcess.StandardOutput.ReadToEnd();
            var error = checkProcess.StandardError.ReadToEnd();
            checkProcess.WaitForExit();

            bool serviceExists = output.Contains("STATE");

            if (!serviceExists)
            {
                // 서비스가 등록되지 않았으면 자동으로 등록 시도
                Console.WriteLine("서비스가 등록되지 않았습니다. 자동 등록을 시도합니다...");
                
                var exePath = Process.GetCurrentProcess().MainModule?.FileName;
                if (string.IsNullOrEmpty(exePath) || !File.Exists(exePath))
                {
                    Console.WriteLine("경고: 실행 파일을 찾을 수 없어 서비스를 등록할 수 없습니다.");
                    return;
                }

                // 관리자 권한으로 서비스 설치 프로세스 실행
                var startInfo = new ProcessStartInfo
                {
                    FileName = exePath,
                    Arguments = "--install-service",
                    UseShellExecute = true,
                    Verb = "runas", // 관리자 권한 요청
                    WindowStyle = ProcessWindowStyle.Hidden
                };

                try
                {
                    var process = Process.Start(startInfo);
                    if (process != null)
                    {
                        Console.WriteLine("서비스 등록 프로세스를 시작했습니다. 관리자 권한 승인이 필요할 수 있습니다.");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"서비스 등록 프로세스 시작 실패: {ex.Message}");
                }
            }
            else
            {
                Console.WriteLine("서비스가 이미 등록되어 있습니다.");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"서비스 상태 확인 중 오류 발생: {ex.Message}");
        }
    }
}
