using System.Collections.Generic;

namespace CareReceiverAgent.Host.Models
{
    /// <summary>리모콘 한 줄: 명칭·벨코드 1:1·사용 여부.</summary>
    public class RemoteControlEntry
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        /// <summary>수신 벨 코드(정규화 후 소문자 등, 저장은 UI/서버 규칙 따름).</summary>
        public string BellCode { get; set; } = "";
        public bool Enabled { get; set; } = true;
    }

    public class RemoteControlSettings
    {
        public List<RemoteControlEntry> Remotes { get; set; } = new List<RemoteControlEntry>();
    }
}
