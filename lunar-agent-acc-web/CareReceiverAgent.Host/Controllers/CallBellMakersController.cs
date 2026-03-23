using Microsoft.AspNetCore.Mvc;

namespace CareReceiverAgent.Host.Controllers
{
    /// <summary>
    /// 호출벨 메이커/모델 목록. 추후 BE에서 관리 시 DB/API로 교체, 현재는 기본 필백 정보(스펙 이미지 기준).
    /// </summary>
    [ApiController]
    [Route("api/callbell")]
    public class CallBellMakersController : ControllerBase
    {
        /// <summary>
        /// 호출벨 회사명·모델명 목록 (기본 필백). GET /api/callbell/makers
        /// </summary>
        [HttpGet("makers")]
        public ActionResult GetMakers()
        {
            var makers = new[]
            {
                new
                {
                    id = "4478625",
                    name = "447,8625",
                    models = new[]
                    {
                        new { id = "4478625_fm_direct", name = "FM 다이렉트" },
                        new { id = "4478625_fm_packet", name = "FM 패킷" },
                        new { id = "4478625_am", name = "AM" }
                    }
                },
                new
                {
                    id = "necall",
                    name = "NE CALL",
                    models = new[]
                    {
                        new { id = "ne100", name = "NE-100" },
                        new { id = "ne200", name = "NE-200" },
                        new { id = "ne700", name = "NE-700" }
                    }
                },
                new
                {
                    id = "syscall",
                    name = "씨스콜",
                    models = new[] { new { id = "syscall_default", name = "(기본)" } }
                },
                new
                {
                    id = "linkman",
                    name = "링크멘",
                    models = new[] { new { id = "linkman_default", name = "(기본)" } }
                },
                new
                {
                    id = "easycall",
                    name = "이지콜",
                    models = new[] { new { id = "easycall_default", name = "(기본)" } }
                }
            };
            return Ok(makers);
        }
    }
}
