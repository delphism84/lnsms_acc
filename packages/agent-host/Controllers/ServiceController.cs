using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;
using System.ServiceProcess;

namespace CareReceiverAgent.Host.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ServiceController : ControllerBase
    {
        private const string ServiceName = "LunarAgentAccService";
        private readonly ILogger<ServiceController> _logger;

        public ServiceController(ILogger<ServiceController> logger)
        {
            _logger = logger;
        }

        [HttpGet("status")]
        public ActionResult GetServiceStatus()
        {
            try
            {
                bool isInstalled = IsServiceInstalled();
                bool isRunning = false;

                if (isInstalled)
                {
                    using (var service = new System.ServiceProcess.ServiceController(ServiceName))
                    {
                        isRunning = service.Status == ServiceControllerStatus.Running;
                    }
                }

                return Ok(new
                {
                    isInstalled,
                    isRunning
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "서비스 상태 확인 실패");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost("install")]
        public ActionResult InstallService()
        {
            try
            {
                // 관리자 권한으로 서비스 설치 프로세스 실행
                var exePath = Process.GetCurrentProcess().MainModule?.FileName;
                if (string.IsNullOrEmpty(exePath) || !System.IO.File.Exists(exePath))
                {
                    return BadRequest(new { error = "실행 파일을 찾을 수 없습니다." });
                }

                // 관리자 권한으로 실행되는 별도 프로세스 시작
                var startInfo = new ProcessStartInfo
                {
                    FileName = exePath,
                    Arguments = "--install-service",
                    UseShellExecute = true,
                    Verb = "runas", // 관리자 권한 요청
                    WindowStyle = ProcessWindowStyle.Hidden
                };

                var process = Process.Start(startInfo);
                if (process != null)
                {
                    return Ok(new { success = true, message = "서비스 설치를 시작했습니다. 관리자 권한 승인이 필요할 수 있습니다." });
                }
                else
                {
                    return BadRequest(new { error = "서비스 설치 프로세스를 시작할 수 없습니다." });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "서비스 설치 요청 실패");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost("uninstall")]
        public ActionResult UninstallService()
        {
            try
            {
                // 관리자 권한으로 서비스 삭제 프로세스 실행
                var exePath = Process.GetCurrentProcess().MainModule?.FileName;
                if (string.IsNullOrEmpty(exePath) || !System.IO.File.Exists(exePath))
                {
                    return BadRequest(new { error = "실행 파일을 찾을 수 없습니다." });
                }

                // 관리자 권한으로 실행되는 별도 프로세스 시작
                var startInfo = new ProcessStartInfo
                {
                    FileName = exePath,
                    Arguments = "--uninstall-service",
                    UseShellExecute = true,
                    Verb = "runas", // 관리자 권한 요청
                    WindowStyle = ProcessWindowStyle.Hidden
                };

                var process = Process.Start(startInfo);
                if (process != null)
                {
                    return Ok(new { success = true, message = "서비스 삭제를 시작했습니다. 관리자 권한 승인이 필요할 수 있습니다." });
                }
                else
                {
                    return BadRequest(new { error = "서비스 삭제 프로세스를 시작할 수 없습니다." });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "서비스 삭제 요청 실패");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        private bool IsServiceInstalled()
        {
            try
            {
                var services = System.ServiceProcess.ServiceController.GetServices();
                return services.Any(s => s.ServiceName == ServiceName);
            }
            catch
            {
                return false;
            }
        }
    }
}

