using Microsoft.AspNetCore.Mvc;

namespace CareReceiverAgent.Host.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WindowController : ControllerBase
    {
        private static bool _isSettingsView = false;
        private static bool _testFlagEnabled = false;
        private static bool _isBellAddModalOpen = false;
        private static readonly object _lock = new object();

        [HttpPost("hide")]
        public ActionResult HideWindow()
        {
            Form1.HideWindow();
            return Ok(new { success = true });
        }

        [HttpPost("set-view")]
        public ActionResult SetView([FromBody] SetViewRequest request)
        {
            lock (_lock)
            {
                _isSettingsView = request.view == "settings";
            }
            return Ok(new { success = true, view = request.view });
        }

        [HttpPost("set-test-flag")]
        public ActionResult SetTestFlag([FromBody] SetTestFlagRequest request)
        {
            lock (_lock)
            {
                _testFlagEnabled = request.enabled;
            }
            return Ok(new { success = true, enabled = request.enabled });
        }

        [HttpGet("current-view")]
        public ActionResult GetCurrentView()
        {
            lock (_lock)
            {
                return Ok(new { view = _isSettingsView ? "settings" : "notification" });
            }
        }

        public static bool IsSettingsView()
        {
            lock (_lock)
            {
                return _isSettingsView;
            }
        }

        public static bool ConsumeTestFlag()
        {
            lock (_lock)
            {
                if (_testFlagEnabled)
                {
                    _testFlagEnabled = false; // 1회만 사용하고 초기화
                    return true;
                }
                return false;
            }
        }

        [HttpPost("set-bell-add-modal")]
        public ActionResult SetBellAddModal([FromBody] SetBellAddModalRequest request)
        {
            lock (_lock)
            {
                _isBellAddModalOpen = request.isOpen;
            }
            return Ok(new { success = true, isOpen = request.isOpen });
        }

        public static bool IsBellAddModalOpen()
        {
            lock (_lock)
            {
                return _isBellAddModalOpen;
            }
        }
    }

    public class SetViewRequest
    {
        public string view { get; set; } = "notification";
    }

    public class SetTestFlagRequest
    {
        public bool enabled { get; set; } = false;
    }

    public class SetBellAddModalRequest
    {
        public bool isOpen { get; set; } = false;
    }
}
