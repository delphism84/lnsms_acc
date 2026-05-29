using System.Speech.Synthesis;
using Microsoft.AspNetCore.Mvc;

namespace CareReceiverAgent.Host.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TTSController : ControllerBase
    {
        private static SpeechSynthesizer? _synthesizer;
        private static readonly object _lock = new object();

        private static SpeechSynthesizer GetSynthesizer()
        {
            if (_synthesizer == null)
            {
                lock (_lock)
                {
                    if (_synthesizer == null)
                    {
                        _synthesizer = new SpeechSynthesizer();
                        // 여성 음성 선택 (한국어)
                        try
                        {
                            var voices = _synthesizer.GetInstalledVoices();
                            var femaleVoice = voices.FirstOrDefault(v => 
                                v.VoiceInfo.Gender == VoiceGender.Female && 
                                v.VoiceInfo.Culture.Name.StartsWith("ko"));
                            
                            if (femaleVoice != null)
                            {
                                _synthesizer.SelectVoice(femaleVoice.VoiceInfo.Name);
                            }
                        }
                        catch
                        {
                            // 기본 음성 사용
                        }
                    }
                }
            }
            return _synthesizer;
        }

        [HttpPost("speak")]
        public ActionResult Speak([FromBody] TTSRequest request)
        {
            try
            {
                // TTS가 활성화되어 있는지 확인
                if (!GetTTSEnabled())
                {
                    return Ok(new { success = false, message = "TTS가 비활성화되어 있습니다." });
                }

                var synthesizer = GetSynthesizer();
                synthesizer.SpeakAsync(request.Text);
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        private static bool _ttsEnabled = true; // 기본값: ON
        private static readonly object _ttsLock = new object();

        [HttpGet("enabled")]
        public ActionResult GetEnabled()
        {
            lock (_ttsLock)
            {
                return Ok(new { enabled = _ttsEnabled });
            }
        }

        [HttpPost("enabled")]
        public ActionResult SetEnabled([FromBody] bool enabled)
        {
            lock (_ttsLock)
            {
                _ttsEnabled = enabled;
                return Ok(new { enabled = _ttsEnabled });
            }
        }

        public static bool GetTTSEnabled()
        {
            lock (_ttsLock)
            {
                return _ttsEnabled;
            }
        }
    }

    public class TTSRequest
    {
        public string Text { get; set; } = string.Empty;
    }
}

