using System.Text;
using CareReceiverAgent.Host.Services;
using Microsoft.AspNetCore.Mvc;

namespace CareReceiverAgent.Host.Controllers
{
    /// <summary>
    /// WebView에서 admin.necall.com 직접 호출 시 CORS로 실패하므로,
    /// 로컬 API로 받아 <see cref="AppRuntimeConfig.LnsmsRemoteUploadBase"/> 로 전달합니다.
    /// </summary>
    [ApiController]
    [Route("api/lnsms-remote")]
    public class LnsmsRemoteProxyController : ControllerBase
    {
        private static readonly HttpClient Http = new()
        {
            Timeout = TimeSpan.FromSeconds(120)
        };

        private static string RemoteBase => AppRuntimeConfig.Load().LnsmsRemoteUploadBase.TrimEnd('/');

        private static async Task<IActionResult> ForwardResponse(HttpResponseMessage response)
        {
            var bytes = await response.Content.ReadAsByteArrayAsync();
            var ct = response.Content.Headers.ContentType?.ToString();
            if (string.IsNullOrEmpty(ct))
                ct = "application/json; charset=utf-8";
            return new ContentResult
            {
                StatusCode = (int)response.StatusCode,
                Content = Encoding.UTF8.GetString(bytes),
                ContentType = ct
            };
        }

        [HttpPost("auth/login")]
        public async Task<IActionResult> Login()
        {
            var url = $"{RemoteBase}/api/auth/login";
            using var reader = new StreamReader(Request.Body, Encoding.UTF8);
            var body = await reader.ReadToEndAsync();
            using var content = new StringContent(body, Encoding.UTF8, "application/json");
            var response = await Http.PostAsync(url, content);
            return await ForwardResponse(response);
        }

        [HttpGet("store/{storeid}")]
        public async Task<IActionResult> GetStore(string storeid)
        {
            var url = $"{RemoteBase}/api/store/{Uri.EscapeDataString(storeid)}";
            var response = await Http.GetAsync(url);
            return await ForwardResponse(response);
        }

        [HttpGet("store")]
        public async Task<IActionResult> GetStores([FromQuery] string? userid)
        {
            var url = string.IsNullOrEmpty(userid)
                ? $"{RemoteBase}/api/store"
                : $"{RemoteBase}/api/store?userid={Uri.EscapeDataString(userid)}";
            var response = await Http.GetAsync(url);
            return await ForwardResponse(response);
        }

        [HttpGet("sets")]
        public async Task<IActionResult> GetSets([FromQuery] string? userid)
        {
            var url = string.IsNullOrEmpty(userid)
                ? $"{RemoteBase}/api/sets"
                : $"{RemoteBase}/api/sets?userid={Uri.EscapeDataString(userid)}";
            var response = await Http.GetAsync(url);
            return await ForwardResponse(response);
        }

        [HttpGet("sets/{setid}/config")]
        public async Task<IActionResult> GetSetConfig(string setid, [FromQuery] string? userid)
        {
            var path = $"{RemoteBase}/api/sets/{Uri.EscapeDataString(setid)}/config";
            if (!string.IsNullOrEmpty(userid))
                path += $"?userid={Uri.EscapeDataString(userid)}";
            var response = await Http.GetAsync(path);
            return await ForwardResponse(response);
        }

        [HttpPut("sets/{setid}")]
        public async Task<IActionResult> PutSet(string setid)
        {
            var url = $"{RemoteBase}/api/sets/{Uri.EscapeDataString(setid)}";
            using var reader = new StreamReader(Request.Body, Encoding.UTF8);
            var body = await reader.ReadToEndAsync();
            using var content = new StringContent(body, Encoding.UTF8, "application/json");
            var response = await Http.PutAsync(url, content);
            return await ForwardResponse(response);
        }

        [HttpPost("sets")]
        public async Task<IActionResult> PostSet()
        {
            var url = $"{RemoteBase}/api/sets";
            using var reader = new StreamReader(Request.Body, Encoding.UTF8);
            var body = await reader.ReadToEndAsync();
            using var content = new StringContent(body, Encoding.UTF8, "application/json");
            var response = await Http.PostAsync(url, content);
            return await ForwardResponse(response);
        }
    }
}
